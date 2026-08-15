import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChime } from '../../audio/chime';

// Minimal fake WebAudio graph -- enough for chime.js's call sequence, not a
// faithful audio implementation.
// Records what it was wired to, so tests can assert the shape of the graph and not just
// that the right nodes got created -- a voice connected to the wrong bus is still a
// perfectly well-formed set of nodes.
class FakeNode {
  constructor() { this.connections = []; }
  connect(dest) { this.connections.push(dest); return dest; }
}

// Every route from `node` down to the speaker, each as an array of the nodes it passes
// through. Branches carry their own `seen` so a send and its dry path both show up.
const pathsToDestination = (node, destination, seen = new Set()) => {
  if (node === destination) return [[node]];
  if (seen.has(node)) return [];
  const walked = new Set(seen).add(node);
  return node.connections.flatMap(
    (next) => pathsToDestination(next, destination, walked).map((path) => [node, ...path])
  );
};
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
class FakeCompressor extends FakeNode {
  constructor() {
    super();
    ['threshold', 'knee', 'ratio', 'attack', 'release'].forEach((p) => { this[p] = { value: 0 }; });
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
    this.compressors = [];
  }
  createBuffer(channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createConvolver() { const node = new FakeNode(); node.buffer = null; return node; }
  createDynamicsCompressor() {
    const compressor = new FakeCompressor();
    this.compressors.push(compressor);
    return compressor;
  }
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

  it('unlock() creates and resumes the context, and pushes a sample through it', () => {
    const chime = createChime();
    chime.unlock();
    const ctx = instances[0];
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    // iOS wants the gesture itself to start a source, not just resume the context.
    expect(ctx.bufferSources).toHaveLength(1);
    expect(ctx.bufferSources[0].start).toHaveBeenCalled();
  });

  it('unlock() leaves an already running context alone and reuses it', () => {
    const chime = createChime();
    chime.unlock();
    const ctx = instances[0];
    ctx.resume.mockClear();
    chime.unlock();
    expect(ctx.resume).not.toHaveBeenCalled();
    expect(ctorSpy).toHaveBeenCalledTimes(1);
  });

  it('unlock() does not throw when WebAudio is unavailable', () => {
    delete window.AudioContext;
    const chime = createChime();
    expect(() => chime.unlock()).not.toThrow();
  });

  it('swallows errors when WebAudio is unavailable', () => {
    delete window.AudioContext;
    const chime = createChime();
    expect(() => chime.play()).not.toThrow();
  });

  it('plays a rising three-note figure, each note doubled an octave up, with wooden clicks', () => {
    const chime = createChime();
    chime.play();
    const ctx = instances[0];

    // Fundamental + x2 partial per note, three notes.
    const freqs = ctx.oscillators.map((o) => o.frequency.value);
    expect(freqs).toEqual([659.3, 1318.6, 987.8, 1975.6, 1318.5, 2637]);
    ctx.oscillators.forEach((o) => expect(o.start).toHaveBeenCalledTimes(1));

    // One bandpassed noise click per note.
    expect(ctx.bufferSources).toHaveLength(3);
    const clickFreqs = ctx.filters.filter((f) => f.Q.value > 0).map((f) => f.frequency.value);
    expect(clickFreqs).toEqual([659.3 * 2.5, 987.8 * 2.5, 1318.5 * 2.5]);
  });

  // The whole point of the rewrite: a phone speaker radiates nothing down where these
  // used to sit, so nothing may drop back below the driver's usable range.
  it('keeps every voice inside the band a phone speaker can reproduce', () => {
    const chime = createChime();
    chime.play();
    [0, 1, 2, 3, 4].forEach((i) => chime.pip(i));
    const ctx = instances[0];

    ctx.oscillators.forEach((o) => expect(o.frequency.value).toBeGreaterThanOrEqual(650));
  });

  // The compressor is the whole loudness argument for the rewrite, and it is invisible
  // unless the dry voices actually run through it -- wiring them to the master gain
  // instead leaves it processing nothing but the reverb tail.
  it('routes every voice through the compressor rather than around it', () => {
    const chime = createChime();
    chime.play();
    chime.pip(0);
    const ctx = instances[0];
    const compressor = ctx.compressors[0];

    const voices = [...ctx.oscillators, ...ctx.bufferSources];
    expect(voices).not.toHaveLength(0);
    voices.forEach((voice) => {
      const paths = pathsToDestination(voice, ctx.destination);
      expect(paths).not.toHaveLength(0);
      paths.forEach((path) => expect(path).toContain(compressor));
    });
  });

  // Compressing without making the level back up would land quieter than no compressor
  // at all, which is the opposite of the point.
  it('makes up the compressed level on the way to the speaker', () => {
    const chime = createChime();
    chime.play();
    const ctx = instances[0];

    const [makeup] = ctx.compressors[0].connections;
    expect(makeup.gain.value).toBeGreaterThan(1);
    expect(makeup.connections).toEqual([ctx.destination]);
  });

  it('plays a rising pip per warning index, clamped to the five-note run', () => {
    const chime = createChime();
    [0, 1, 2, 3, 4, 99].forEach((i) => chime.pip(i));
    const ctx = instances[0];

    // Fundamental + x2 partial per pip.
    const fundamentals = ctx.oscillators.map((o) => o.frequency.value).filter((_, i) => i % 2 === 0);
    expect(fundamentals).toEqual([784, 830.6, 880, 932.3, 987.8, 987.8]);
  });

  // A phone on silent should stay silent. The only session type that would override the
  // ring/silent switch is 'playback', which also pauses the user's music -- so the chime
  // claims no session at all and inherits the ambient default the switch mutes.
  it('leaves the audio session alone so iOS silent mode is respected', () => {
    const audioSession = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: audioSession, configurable: true });
    try {
      const chime = createChime();
      chime.pip(0);
      chime.play();
      chime.unlock();
      expect(audioSession.type).toBe('auto');
    } finally {
      delete navigator.audioSession;
    }
  });

  it('works on browsers with no audioSession support', () => {
    expect(navigator.audioSession).toBeUndefined();
    const chime = createChime();
    expect(() => chime.pip(0)).not.toThrow();
    expect(instances[0].oscillators.length).toBeGreaterThan(0);
  });

  it('creates the AudioContext lazily on first pip too', () => {
    const chime = createChime();
    expect(ctorSpy).not.toHaveBeenCalled();
    chime.pip(0);
    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(instances[0].resume).toHaveBeenCalled();
  });
});
