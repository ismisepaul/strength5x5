import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChime } from '../../audio/chime';

// Minimal fake WebAudio graph -- enough for chime.js's call sequence, not a
// faithful audio implementation.
class FakeNode {
  connect() { return this; }
}
class FakeGain extends FakeNode {
  constructor() {
    super();
    this.gain = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  }
}
class FakeOscillator extends FakeNode {
  constructor() {
    super();
    this.frequency = { value: 0 };
    this.start = vi.fn();
    this.stop = vi.fn();
  }
}
class FakeFilter extends FakeNode {
  constructor() {
    super();
    this.frequency = { value: 0 };
    this.Q = { value: 0 };
  }
}
class FakeBufferSource extends FakeNode {
  constructor() {
    super();
    this.buffer = null;
    this.start = vi.fn();
    this.stop = vi.fn();
  }
}
class FakeAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = 'suspended';
    this.destination = new FakeNode();
    this.resume = vi.fn(() => { this.state = 'running'; });
    this.oscillators = [];
    this.filters = [];
    this.bufferSources = [];
  }
  createBuffer(channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createConvolver() { const node = new FakeNode(); node.buffer = null; return node; }
  createGain() { return new FakeGain(); }
  createOscillator() {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createBiquadFilter() {
    const filter = new FakeFilter();
    this.filters.push(filter);
    return filter;
  }
  createBufferSource() {
    const src = new FakeBufferSource();
    this.bufferSources.push(src);
    return src;
  }
}

describe('createChime', () => {
  let ctorSpy;
  let instances;

  beforeEach(() => {
    instances = [];
    ctorSpy = vi.fn(function AudioContext() {
      const ctx = new FakeAudioContext();
      instances.push(ctx);
      return ctx;
    });
    window.AudioContext = ctorSpy;
  });

  afterEach(() => {
    delete window.AudioContext;
  });

  it('creates the AudioContext lazily, once, on first play', () => {
    const chime = createChime();
    expect(ctorSpy).not.toHaveBeenCalled();
    chime.play();
    chime.play();
    expect(ctorSpy).toHaveBeenCalledTimes(1);
  });

  it('resumes a suspended context on play', () => {
    const chime = createChime();
    chime.play();
    expect(instances[0].resume).toHaveBeenCalled();
  });

  it('resume() only calls ctx.resume() once a context exists and is suspended', () => {
    const chime = createChime();
    chime.resume(); // no context yet -- must not throw
    chime.play();
    const ctx = instances[0];
    ctx.resume.mockClear();
    ctx.state = 'running';
    chime.resume();
    expect(ctx.resume).not.toHaveBeenCalled();
    ctx.state = 'suspended';
    chime.resume();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('swallows errors when WebAudio is unavailable', () => {
    delete window.AudioContext;
    const chime = createChime();
    expect(() => chime.play()).not.toThrow();
  });

  it('plays two marimba strikes an octave apart, 100ms apart, with wooden clicks', () => {
    const chime = createChime();
    chime.play();
    const ctx = instances[0];

    // Fundamental + x4 harmonic oscillator per note, two notes.
    const freqs = ctx.oscillators.map((o) => o.frequency.value);
    expect(freqs).toEqual([339.5, 1358, 679, 2716]);
    ctx.oscillators.forEach((o) => expect(o.start).toHaveBeenCalledTimes(1));

    // One bandpassed noise click per note.
    expect(ctx.bufferSources).toHaveLength(2);
    const clickFreqs = ctx.filters.filter((f) => f.Q.value > 0).map((f) => f.frequency.value);
    expect(clickFreqs).toEqual([339.5 * 3, 679 * 3]);
  });

  it('plays a rising pip per warning index, clamped to the five-note run', () => {
    const chime = createChime();
    [0, 1, 2, 3, 4, 99].forEach((i) => chime.pip(i));
    const ctx = instances[0];

    const freqs = ctx.oscillators.map((o) => o.frequency.value);
    expect(freqs).toEqual([392, 415.3, 440, 466.2, 493.9, 493.9]);
  });

  it('creates the AudioContext lazily on first pip too', () => {
    const chime = createChime();
    expect(ctorSpy).not.toHaveBeenCalled();
    chime.pip(0);
    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(instances[0].resume).toHaveBeenCalled();
  });
});
