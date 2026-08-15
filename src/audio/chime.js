// The two sounds the rest timer makes: the five-second warning pips, and the chime
// that marks the next set starting. Both are tuned for a phone lying on the floor of a
// noisy gym, which is what drives every choice below.
//
//   1. Pitch. A phone speaker is a few millimetres across and radiates almost nothing
//      below ~500Hz, so the previous 339.5Hz chime and 392Hz pips never really left the
//      device -- what survived was the click transient, not the note. Every voice here
//      now sits between 650Hz and 2.6kHz, where a small driver is efficient and the ear
//      is sensitive, and each note carries an upper partial so there is still energy in
//      band if the speaker rolls off early.
//   2. Level. The old pips ran at 0.09 gain through a 2200Hz lowpass, quiet by design so
//      they would sit under a conversation. Under an actual conversation they vanished.
//      Everything is louder now and runs through a compressor, which is what buys real
//      loudness on a speaker with no headroom.
//   3. The iOS ring/silent switch. A plain WebAudio context lands in the "ambient" audio
//      session, which that switch mutes outright -- so a phone on silent played nothing
//      at all, however loud the graph was. Declaring a "transient" session (Safari 16.4+)
//      plays through the switch and ducks the user's music rather than stopping it.
//
// The AudioContext and its graph are built lazily on first use, so constructing a chime
// has no side effects until the user actually needs sound.

// One pip per second of the five-second warning, rising G5 -> B5 so the last pip (the
// one about to hit zero) sits highest. Same run as before, an octave up.
const PIP_FREQUENCIES = [784, 830.6, 880, 932.3, 987.8];

// The set-start chime: a rising E5 -> B5 -> E6 figure struck 90ms apart. A leap rather
// than the pips' step-wise run, so it reads as "go" instead of "still counting".
const CHIME_NOTES = [659.3, 987.8, 1318.5];

// Enough lead time for a resume() kicked off in the same tick to land before the first
// note is due. A suspended context's clock is frozen, so this is measured from wherever
// it stopped, not from wall time.
const LEAD = 0.06;

export const createChime = () => {
  let audioCtx = null;
  let reverb = null;
  let master = null;

  // Safari-only, 16.4+. Without it an iPhone on silent stays silent no matter what we
  // schedule; "transient" is the type meant for short alerts, and unlike "playback" it
  // mixes with and ducks whatever the user is listening to instead of pausing it.
  const declareAudioSession = () => {
    if (navigator.audioSession) { navigator.audioSession.type = 'transient'; }
  };

  const ensureContext = () => {
    if (audioCtx) return audioCtx;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    declareAudioSession();

    const duration = 2;
    const rate = audioCtx.sampleRate;
    const length = rate * duration;
    const impulse = audioCtx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
      }
    }
    const convolver = audioCtx.createConvolver();
    convolver.buffer = impulse;

    // Every voice lands here: compressor -> master -> speaker. The notes overlap and the
    // clicks are pure transient, so flattening the peaks before the makeup gain is worth
    // several dB of perceived loudness that the phone would otherwise spend on headroom.
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.2;

    master = audioCtx.createGain();
    master.gain.value = 0.95;
    compressor.connect(master);
    master.connect(audioCtx.destination);

    // Connected once here rather than per strike, so the tail is a send and not a
    // second dry path.
    convolver.connect(compressor);
    reverb = convolver;

    return audioCtx;
  };

  // One struck note: oscillator -> lowpass -> envelope -> dry + reverb send.
  const strike = (ctx, t, { freq, dur, gain, attack, cutoff, send }) => {
    const osc = ctx.createOscillator();
    const lowpass = ctx.createBiquadFilter();
    const envelope = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = cutoff;

    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(gain, t + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(lowpass); lowpass.connect(envelope); envelope.connect(master);
    if (send > 0 && reverb) {
      const sendGain = ctx.createGain();
      sendGain.gain.value = send;
      envelope.connect(sendGain);
      sendGain.connect(reverb);
    }

    osc.start(t); osc.stop(t + dur + 0.05);
  };

  // The wooden "click" under each strike: a brief bandpassed noise burst. On a small
  // speaker this transient does more for audibility than the note it sits under, so it
  // is bandpassed high where the driver is at its most efficient.
  const click = (ctx, t, { dur, gain, freq, q }) => {
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = freq;
    bandpass.Q.value = q;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, t);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(bandpass); bandpass.connect(envelope); envelope.connect(master);
    src.start(t); src.stop(t + dur);
  };

  const play = () => {
    try {
      const ctx = ensureContext();
      if (ctx.state === 'suspended') { ctx.resume(); }

      const start = ctx.currentTime + LEAD;
      CHIME_NOTES.forEach((freq, i) => {
        const t = start + i * 0.09;
        const last = i === CHIME_NOTES.length - 1;
        // The top note rings on -- it is the one that has to carry across the room.
        strike(ctx, t, { freq, dur: last ? 0.9 : 0.55, gain: last ? 0.5 : 0.42, attack: 0.004, cutoff: 5200, send: 0.12 });
        strike(ctx, t, { freq: freq * 2, dur: 0.16, gain: 0.12, attack: 0.002, cutoff: 7000, send: 0.05 });
        click(ctx, t, { dur: 0.02, gain: 0.12, freq: freq * 2.5, q: 2 });
      });
    } catch (e) { /* WebAudio may fail silently */ }
  };

  // A single warning pip, `index` counting up from 0 as the last five seconds tick down.
  // Quieter and shorter than the chime so the two never get confused, but no longer
  // trying to be discreet about it.
  const pip = (index) => {
    try {
      const ctx = ensureContext();
      if (ctx.state === 'suspended') { ctx.resume(); }

      const freq = PIP_FREQUENCIES[Math.min(Math.max(index, 0), PIP_FREQUENCIES.length - 1)];
      const t = ctx.currentTime + LEAD;
      strike(ctx, t, { freq, dur: 0.18, gain: 0.3, attack: 0.004, cutoff: 6000, send: 0.05 });
      strike(ctx, t, { freq: freq * 2, dur: 0.09, gain: 0.1, attack: 0.002, cutoff: 7000, send: 0 });
      click(ctx, t, { dur: 0.015, gain: 0.07, freq: freq * 2.5, q: 2 });
    } catch (e) { /* WebAudio may fail silently */ }
  };

  // Browsers hold a fresh AudioContext suspended until a user gesture resumes it, and on
  // iOS the gesture also has to be what pushes the first sample through. Called from the
  // taps that start or skip a rest timer, so the pips a minute later are not themselves
  // the gesture trying to unlock the device.
  const unlock = () => {
    try {
      const ctx = ensureContext();
      if (ctx.state === 'suspended') { ctx.resume(); }
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) { /* WebAudio may fail silently */ }
  };

  return { play, pip, unlock };
};
