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
class FakeAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = 'suspended';
    this.destination = new FakeNode();
    this.resume = vi.fn(() => { this.state = 'running'; });
  }
  createBuffer(channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createConvolver() { return { ...new FakeNode(), buffer: null }; }
  createGain() { return new FakeGain(); }
  createOscillator() { return new FakeOscillator(); }
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
});
