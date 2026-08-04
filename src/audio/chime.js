// A short reverbed two-tone chime for the rest timer expiring. The AudioContext and
// its impulse response are created lazily on first play, not at construction, so
// creating a chime instance has no side effects until the user actually needs sound.
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

  const play = () => {
    try {
      const ctx = ensureContext();
      if (ctx.state === 'suspended') { ctx.resume(); }

      const now = ctx.currentTime;
      const mainGain = ctx.createGain();
      const dryGain = ctx.createGain();
      const reverbGain = ctx.createGain();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();

      osc1.type = 'sine'; osc2.type = 'sine';
      osc1.frequency.value = 1358; osc2.frequency.value = 2844;
      osc1.connect(mainGain); osc2.connect(mainGain);
      mainGain.connect(dryGain); mainGain.connect(reverbGain);
      dryGain.connect(ctx.destination);

      if (reverb) {
        reverbGain.connect(reverb);
        reverb.connect(ctx.destination);
      }

      dryGain.gain.setValueAtTime(0.8, now);
      reverbGain.gain.setValueAtTime(0.2, now);
      mainGain.gain.setValueAtTime(0, now);
      mainGain.gain.linearRampToValueAtTime(0.6, now + 0.005);
      mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.start(now); osc2.start(now);
      osc1.stop(now + 0.5); osc2.stop(now + 0.5);
    } catch (e) { /* WebAudio may fail silently */ }
  };

  // Browsers suspend a freshly-created AudioContext until a user gesture resumes it;
  // called on the timer-skip tap so a later chime isn't the very gesture that unlocks it.
  const resume = () => {
    if (audioCtx?.state === 'suspended') { audioCtx.resume(); }
  };

  return { play, resume };
};
