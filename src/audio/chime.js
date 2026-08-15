// A soft wooden marimba chime for the rest timer expiring -- two notes an octave
// apart, struck 100ms apart, replacing the old two-sine chime that sat at 1358/2844Hz
// (right in the band the ear is most sensitive to) -- plus the quiet five-second
// warning pips that lead into it. The AudioContext and its impulse response are
// created lazily on first play, not at construction, so creating a chime instance
// has no side effects until the user actually needs sound.
// One quiet pip per second of the five-second warning, rising G4 -> B4 so the last
// pip (about to hit zero) sits highest.
const PIP_FREQUENCIES = [392, 415.3, 440, 466.2, 493.9];

export const createChime = () => {
  let audioCtx = null;
  let reverb = null;

  const ensureContext = () => {
    if (audioCtx) return audioCtx;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

    osc.connect(lowpass); lowpass.connect(envelope); envelope.connect(ctx.destination);
    if (send > 0 && reverb) {
      const sendGain = ctx.createGain();
      sendGain.gain.value = send;
      envelope.connect(sendGain);
      sendGain.connect(reverb);
      reverb.connect(ctx.destination);
    }

    osc.start(t); osc.stop(t + dur + 0.05);
  };

  // The wooden "click" under each strike: a brief bandpassed noise burst.
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

    src.connect(bandpass); bandpass.connect(envelope); envelope.connect(ctx.destination);
    src.start(t); src.stop(t + dur);
  };

  const play = () => {
    try {
      const ctx = ensureContext();
      if (ctx.state === 'suspended') { ctx.resume(); }

      const now = ctx.currentTime;
      [[339.5, now], [679, now + 0.1]].forEach(([freq, t]) => {
        strike(ctx, t, { freq, dur: 0.5, gain: 0.32, attack: 0.003, cutoff: 2600, send: 0.1 });
        strike(ctx, t, { freq: freq * 4, dur: 0.11, gain: 0.05, attack: 0.002, cutoff: 4000, send: 0.05 });
        click(ctx, t, { dur: 0.02, gain: 0.05, freq: freq * 3, q: 2 });
      });
    } catch (e) { /* WebAudio may fail silently */ }
  };

  // A single warning pip, `index` counting up from 0 as the last five seconds tick
  // down -- quiet enough to sit under a conversation, patterned enough to place
  // without looking.
  const pip = (index) => {
    try {
      const ctx = ensureContext();
      if (ctx.state === 'suspended') { ctx.resume(); }
      const freq = PIP_FREQUENCIES[Math.min(Math.max(index, 0), PIP_FREQUENCIES.length - 1)];
      strike(ctx, ctx.currentTime + 0.02, { freq, dur: 0.1, gain: 0.09, attack: 0.008, cutoff: 2200, send: 0.06 });
    } catch (e) { /* WebAudio may fail silently */ }
  };

  // Browsers suspend a freshly-created AudioContext until a user gesture resumes it;
  // called on the timer-skip tap so a later chime isn't the very gesture that unlocks it.
  const resume = () => {
    if (audioCtx?.state === 'suspended') { audioCtx.resume(); }
  };

  return { play, pip, resume };
};
