import type { ServiceId } from '../data/career';

// Runtime telemetry per service, modelled on how each runtime really behaves:
// G1 sawtooth and promotions, V8 scavenges, Vert.x per-loop delay, CPython GC.

export interface Sample {
  t: number;
  v: Record<string, number>;
  /** Per-event-loop delay in ms (reactor layers). */
  loops: number[];
  /** Fill level 0..1 for each compartment of the service's chambers layer. */
  parts: number[];
  /** Turbine speed, revolutions per second. */
  spin: number;
  /** Loop marker speed, revolutions per second. */
  loopSpeed: number;
  /** Coroutine state label (migrator). */
  label: number;
  /** Index of a currently blocked event loop, or -1. */
  blockedLoop: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const noise = (amp: number) => (Math.random() - 0.5) * 2 * amp;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

type Model = (t: number) => Sample;

const base = (t: number): Sample => ({ t, v: {}, loops: [], parts: [], spin: 0.5, loopSpeed: 0.8, label: 0, blockedLoop: -1 });

function jvmModel(opts: { edenCap: number; oldCap: number; rps: [number, number]; allocPerReq: number }) {
  let eden = 40, surv = 12, old = opts.oldCap * 0.35, meta = 78, compiled = 0;
  return (t: number) => {
    const rps = Math.max(5, opts.rps[0] + opts.rps[1] * Math.sin(t / 9) + noise(opts.rps[1] * 0.25));
    eden += rps * opts.allocPerReq;
    let pause = 0;
    if (eden > opts.edenCap * 0.86) {
      // G1 young collection: Eden empties, survivors copy, a little gets promoted.
      old += rnd(1, 5);
      surv = rnd(6, 20);
      eden = rnd(3, 9);
      pause = rnd(2.5, 9);
    }
    if (old > opts.oldCap * 0.9) {
      // Mixed collection reclaims old regions.
      old = opts.oldCap * rnd(0.32, 0.42);
      pause = Math.max(pause, rnd(11, 21));
    }
    meta = Math.min(meta + rnd(0, 0.02), 96);
    compiled = Math.min(1500, compiled + rnd(4, 16) * (1 - compiled / 1600));
    return { rps, heap: eden + surv + old, pause, compiled, parts: [eden / opts.edenCap, surv / 32, old / opts.oldCap, meta / 128] };
  };
}

function fleet(): Model {
  // Same scale as the real service: 5 vehicles, 4 ticks a second, one position per tick.
  const jvm = jvmModel({ edenCap: 256, oldCap: 320, rps: [240, 70], allocPerReq: 0.05 });
  return (t) => {
    const j = jvm(t);
    const s = base(t);
    s.v = { heapMb: j.heap, gcPauseMs: j.pause, reqPerSec: clamp(4 + noise(0.3), 0, 10), virtualThreads: 20 + noise(1), jitCompiled: j.compiled };
    s.parts = j.parts;
    s.loops = [0, 1, 2, 3].map(() => rnd(0.05, 0.4));
    s.spin = 0.4 + j.rps / 300;
    return s;
  };
}

function notify(): Model {
  let young = 4, old = 38, compiled = 0;
  const code = 6, large = 3;
  return (t) => {
    const nps = Math.max(2, 26 + 10 * Math.sin(t / 7) + noise(4));
    young += nps * 0.07;
    if (young > 15) { young = rnd(1, 3); old += rnd(0.1, 0.7); }
    if (old > 72) old = rnd(36, 42);
    compiled = Math.min(420, compiled + rnd(1, 6) * (1 - compiled / 450));
    const spike = Math.random() < 0.04 ? rnd(6, 17) : 0;
    const s = base(t);
    s.v = {
      loopDelayMs: Math.max(0.3, 1.1 + noise(0.3) + spike),
      heapMb: young + old + code + large,
      cacheHit: clamp(93 + noise(3), 80, 99.6),
      notifPerSec: nps,
      compiled,
    };
    s.parts = [young / 16, old / 96, code / 16, large / 16];
    s.spin = 0.35 + nps / 50;
    s.loopSpeed = 0.9;
    return s;
  };
}

function gateway(): Model {
  const jvm = jvmModel({ edenCap: 300, oldCap: 512, rps: [420, 90], allocPerReq: 0.035 });
  const warnings: number[] = [];
  return (t) => {
    const j = jvm(t);
    const loops = Array.from({ length: 8 }, () => rnd(0.08, 0.6));
    let blockedLoop = -1;
    if (Math.random() < 0.05) {
      blockedLoop = Math.floor(rnd(0, 8));
      loops[blockedLoop] = rnd(4, 14);
      if (loops[blockedLoop] > 10) warnings.push(t);
    }
    while (warnings.length && t - warnings[0] > 60) warnings.shift();
    const s = base(t);
    s.v = { reqPerSec: j.rps, jwtPerSec: j.rps * rnd(0.9, 0.96), blocked: warnings.length, heapMb: j.heap, jitCompiled: j.compiled };
    s.loops = loops;
    s.blockedLoop = blockedLoop;
    s.parts = [j.heap / 900, clamp(0.42 + noise(0.06), 0, 1), 0.58];
    s.spin = 0.4 + j.rps / 400;
    return s;
  };
}

function migrator(): Model {
  const jvm = jvmModel({ edenCap: 192, oldCap: 256, rps: [30, 10], allocPerReq: 0.6 });
  let seq: number[] = [];
  let label = 0;
  return (t) => {
    const j = jvm(t);
    if (!seq.length) {
      const attempts = Math.random() < 0.55 ? 1 : Math.random() < 0.7 ? 2 : 3;
      seq = [0, 1];
      for (let a = 1; a < attempts; a++) seq.push(2, 1);
      seq.push(3, 3);
    }
    label = seq.shift()!;
    const s = base(t);
    s.v = {
      coroutines: Math.max(2, 22 + 18 * Math.sin(t / 6) ** 2 + noise(4)),
      heapMb: j.heap,
      greenRate: clamp(91 + noise(3), 80, 99),
      avgAttempts: clamp(1.7 + noise(0.25), 1, 4),
      jitCompiled: j.compiled,
    };
    s.parts = j.parts;
    s.label = label;
    s.spin = 0.35 + j.rps / 120;
    return s;
  };
}

function speech(): Model {
  return (t) => {
    const busy = Math.random();
    const s = base(t);
    s.v = {
      latencyMs: 175 + noise(35) + (busy < 0.1 ? rnd(60, 150) : 0),
      gcGen0: Math.random() < 0.6 ? Math.round(rnd(0, 4)) : 0,
      rtf: clamp(0.085 + noise(0.022), 0.04, 0.2),
      reqPerSec: clamp(3.6 + noise(1.3), 0.5, 8),
    };
    s.parts = [0.72, clamp(0.45 + noise(0.22), 0.1, 0.95), 0.2, clamp(0.4 + noise(0.05), 0, 1)];
    s.loopSpeed = 1.8;
    s.spin = 0.18;
    return s;
  };
}

const HISTORY = 72;
const STEP_MS = 500;

export class Telemetry {
  private models: Partial<Record<ServiceId, Model>> = {
    'fleet-tracker': fleet(), notify: notify(), 'edge-gateway': gateway(), migrator: migrator(), speech: speech(),
  };
  private history = new Map<ServiceId, Sample[]>();
  private listeners = new Map<ServiceId, Set<(s: Sample) => void>>();
  private t = 0;

  constructor() {
    // Warm up so charts open already full of history.
    for (let i = 0; i < HISTORY; i++) this.step();
    window.setInterval(() => this.step(), STEP_MS);
  }

  private step() {
    this.t += STEP_MS / 1000;
    for (const [id, model] of Object.entries(this.models) as [ServiceId, Model][]) {
      const sample = model(this.t);
      const h = this.history.get(id) ?? [];
      h.push(sample);
      if (h.length > HISTORY) h.shift();
      this.history.set(id, h);
      this.listeners.get(id)?.forEach((fn) => fn(sample));
    }
  }

  historyOf(id: ServiceId): Sample[] {
    return this.history.get(id) ?? [];
  }

  subscribe(id: ServiceId, fn: (s: Sample) => void) {
    const set = this.listeners.get(id) ?? new Set();
    set.add(fn);
    this.listeners.set(id, set);
    return () => set.delete(fn);
  }
}
