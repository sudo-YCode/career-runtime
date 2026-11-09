import { s, frameLoop, reducedMotion } from '../util/dom';
import type { P2 } from './iso';
import { edgeOf } from './shapes';
import type { Hue, ServiceId } from '../data/career';

export type Target = ServiceId | 'hub';
export type ModState = 'ok' | 'down' | 'booting' | 'failed' | 'replaying';
export type Tone = 'red' | 'amber' | 'green' | 'cyan';
export type BreakerState = 'open' | 'half' | 'closed';

/** Everything chaos mode needs to know about one module (or the hub) in the overview scene. */
export interface FxTarget {
  el: SVGGElement;
  hue: Hue | null;
  /** Where the status badge floats, where sparks fly from, and the floor point under it. */
  badge: P2;
  burst: P2;
  floor: P2;
  /** Screen angle (degrees) where its cable meets the ring. */
  phi: number;
  /** Cable group and its curve in screen space: port on the module, control point, end on the ring. */
  cable?: { el: SVGGElement; curve: [P2, P2, P2] };
}

/** The ring's top surface: the point for screen angle φ is (rx·cos φ, ry·sin φ − lift). */
export interface RingTop { rx: number; ry: number; lift: number; hub: P2; }

export interface ChaosFx {
  state(id: Target, st: ModState): void;
  isDown(id: Target): boolean;
  badge(id: Target, text: string | null, tone?: Tone): void;
  breaker(id: Target, st: BreakerState | null): void;
  sparks(id: Target): void;
  /** Show n waiting events (lag) queued on the ring in front of the target. */
  queue(id: Target, n: number): void;
  /** Send the event at the head of the queue into the target. Call queue() with the new count after. */
  drain(id: Target): void;
  reset(): void;
}

const MAX_BEADS = 16;
const SPARK_COLORS = ['#ff5a3c', '#ffb347', '#ffd166', '#ffffff', '#ff8a5c'];
const RAD = Math.PI / 180;

interface Mover { el: SVGGElement; t: number; dur: number; at(k: number): P2; }
interface Spark { el: SVGCircleElement; x: number; y: number; vx: number; vy: number; age: number; life: number; }
interface Shock { el: SVGEllipseElement; t: number; }

export function chaosFx(svg: SVGSVGElement, targets: Map<Target, FxTarget>, ring: RingTop, beadLayer: SVGGElement, topLayer: SVGGElement): ChaosFx {
  /** Badges and lag labels keep a readable on-screen size however small the scene is drawn. */
  const textScale = () => {
    const w = svg.getBoundingClientRect().width || 1400;
    const vb = svg.viewBox.baseVal.width || 1400;
    return Math.min(3.4, Math.max(1, (vb / w) * 11.5 / 15));
  };
  const queues = new Map<Target, { beads: SVGGElement[]; label: SVGTextElement }>();
  const badges = new Map<Target, { g: SVGGElement; pill: SVGRectElement; text: SVGTextElement }>();
  const down = new Set<Target>();
  let movers: Mover[] = [];
  let sparks: Spark[] = [];
  let shocks: Shock[] = [];

  const ringAt = (phi: number): P2 => [ring.rx * Math.cos(phi * RAD), ring.ry * Math.sin(phi * RAD) - ring.lift];
  const tangent = (phi: number) => Math.atan2(ring.ry * Math.cos(phi * RAD), -ring.rx * Math.sin(phi * RAD)) / RAD;
  /** Ring angle of the k-th waiting event: a line upstream of the service, or spread round the ring for the hub. */
  const slot = (id: Target, k: number) => (id === 'hub' ? -84 + k * (360 / MAX_BEADS) : targets.get(id)!.phi - 7 - k * 5.4);

  const place = (el: SVGGElement, phi: number) => {
    const [x, y] = ringAt(phi);
    el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${tangent(phi).toFixed(1)}deg)`;
  };

  const bead = (hue: Hue | null) => s('g', { class: 'bead' }, [
    s('rect', { x: -8.5, y: -4, width: 17, height: 8, rx: 4, style: `stroke:${hue ? edgeOf(hue.id) : 'var(--cyan)'}` }),
    s('line', { x1: -4.5, x2: 4.5, y1: 0, y2: 0, style: `stroke:${hue ? hue.base : 'var(--cyan)'}` }),
  ]);

  function queueOf(id: Target) {
    let q = queues.get(id);
    if (!q) {
      q = { beads: [], label: s('text', { class: 'lag-label', 'text-anchor': 'middle' }) };
      topLayer.append(q.label);
      queues.set(id, q);
    }
    return q;
  }

  function queue(id: Target, n: number) {
    const q = queueOf(id);
    const want = Math.min(Math.max(n, 0), MAX_BEADS);
    const hue = targets.get(id)?.hue ?? null;
    while (q.beads.length < want) {
      const b = bead(hue);
      place(b, slot(id, q.beads.length));
      beadLayer.append(b);
      q.beads.push(b);
    }
    while (q.beads.length > want) q.beads.pop()!.remove();
    q.beads.forEach((b, k) => place(b, slot(id, k)));

    if (n <= 0) { q.label.classList.remove('on'); return; }
    let x: number, y: number;
    if (id === 'hub') {
      // Left of the hub, inside the ring, clear of the hub's own lettering.
      x = ring.hub[0] - ring.rx * 0.6;
      y = ring.hub[1] + 44;
    } else {
      const [lx, ly] = ringAt(slot(id, want - 1));
      const len = Math.hypot(lx / ring.rx, ly / ring.ry) || 1;
      x = lx + (lx / ring.rx / len) * 34;
      y = ly + (ly / ring.ry / len) * 26 + 4;
    }
    q.label.style.fontSize = `${(13 * textScale()).toFixed(1)}px`;
    q.label.setAttribute('x', x.toFixed(1));
    q.label.setAttribute('y', y.toFixed(1));
    q.label.textContent = id === 'hub' ? `${n} buffered` : `lag ${n}`;
    q.label.classList.add('on');
  }

  function drain(id: Target) {
    const q = queues.get(id);
    const head = q?.beads.shift();
    if (!head) return;
    const T = targets.get(id)!;
    if (reducedMotion()) { head.remove(); return; }
    const from = ringAt(slot(id, 0));
    head.classList.add('moving');
    let at: (k: number) => P2;
    if (id === 'hub' || !T.cable) {
      const [hx, hy] = ring.hub;
      at = (k) => [from[0] + (hx - from[0]) * k, from[1] + (hy - from[1]) * k];
    } else {
      const [a, m, b] = T.cable.curve;
      at = (k) => {
        if (k < 0.3) { const j = k / 0.3; return [from[0] + (b[0] - from[0]) * j, from[1] + (b[1] - from[1]) * j]; }
        const j = 1 - (k - 0.3) / 0.7;  // along the cable from the ring end back to the port
        const i = 1 - j;
        return [i * i * a[0] + 2 * i * j * m[0] + j * j * b[0], i * i * a[1] + 2 * i * j * m[1] + j * j * b[1]];
      };
    }
    movers.push({ el: head, t: 0, dur: 0.42, at });
    loop.start();
  }

  function sparksAt(id: Target) {
    const T = targets.get(id);
    if (!T || reducedMotion()) return;
    const [x, y] = T.burst;
    for (let i = 0; i < 22; i++) {
      const a = (-90 + (Math.random() - 0.5) * 150) * RAD;
      const v = 110 + Math.random() * 230;
      const el = s('circle', { r: (1.3 + Math.random() * 1.8).toFixed(1), class: 'spark', style: `fill:${SPARK_COLORS[i % SPARK_COLORS.length]}` });
      topLayer.append(el);
      sparks.push({ el, x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 16, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 0.6 + Math.random() * 0.6 });
    }
    const el = s('ellipse', { cx: T.floor[0], cy: T.floor[1], class: 'shock' });
    topLayer.prepend(el);
    shocks.push({ el, t: 0 });
    loop.start();
  }

  const loop = frameLoop((dt) => {
    movers = movers.filter((m) => {
      m.t += dt;
      const k = Math.min(m.t / m.dur, 1);
      const [x, y] = m.at(k * k * (3 - 2 * k));
      m.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(1 - k * 0.5).toFixed(2)})`;
      m.el.style.opacity = String(k > 0.8 ? (1 - k) * 5 : 1);
      if (k >= 1) { m.el.remove(); return false; }
      return true;
    });
    sparks = sparks.filter((p) => {
      p.age += dt;
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.age / p.life;
      p.el.setAttribute('cx', p.x.toFixed(1));
      p.el.setAttribute('cy', p.y.toFixed(1));
      p.el.setAttribute('opacity', Math.max(0, 1 - k * k).toFixed(2));
      if (k >= 1) { p.el.remove(); return false; }
      return true;
    });
    shocks = shocks.filter((w) => {
      w.t += dt;
      const k = Math.min(w.t / 0.75, 1);
      const r = 30 + 150 * (1 - (1 - k) * (1 - k));
      w.el.setAttribute('rx', (r * 1.22).toFixed(1));
      w.el.setAttribute('ry', (r * 0.71).toFixed(1));
      w.el.setAttribute('opacity', (1 - k).toFixed(2));
      if (k >= 1) { w.el.remove(); return false; }
      return true;
    });
    if (!movers.length && !sparks.length && !shocks.length) loop.stop();
  });

  function badge(id: Target, text: string | null, tone: Tone = 'red') {
    let b = badges.get(id);
    if (!text) { b?.g.classList.remove('on'); return; }
    if (!b) {
      const pill = s('rect', { y: -12, height: 24, rx: 12, class: 'pill' });
      const label = s('text', { y: 4.4, 'text-anchor': 'middle', class: 'badge-text' });
      const g = s('g', { class: 'badge' }, [
        s('path', { d: 'M-6 10L0 18L6 10Z', class: 'pin' }),
        pill,
        label,
      ]);
      topLayer.append(g);
      b = { g, pill, text: label };
      badges.set(id, b);
    }
    const T = targets.get(id)!;
    b.g.setAttribute('transform', `translate(${T.badge[0].toFixed(1)} ${T.badge[1].toFixed(1)}) scale(${textScale().toFixed(2)})`);
    b.text.textContent = text;
    const w = Math.round(text.length * 7.6 + 26);
    b.pill.setAttribute('x', String(-w / 2));
    b.pill.setAttribute('width', String(w));
    b.g.setAttribute('class', `badge on ${tone}`);
  }

  function state(id: Target, st: ModState) {
    const el = targets.get(id)?.el;
    if (!el) return;
    for (const c of ['down', 'booting', 'failed', 'replaying']) el.classList.toggle(c, c === st);
    if (st === 'ok') down.delete(id); else down.add(id);
  }

  function breaker(id: Target, st: BreakerState | null) {
    const c = targets.get(id)?.cable?.el;
    if (!c) return;
    if (st) c.dataset.breaker = st; else delete c.dataset.breaker;
  }

  function reset() {
    loop.stop();
    for (const m of movers) m.el.remove();
    for (const p of sparks) p.el.remove();
    for (const w of shocks) w.el.remove();
    movers = []; sparks = []; shocks = [];
    for (const id of targets.keys()) { state(id, 'ok'); breaker(id, null); badge(id, null); queue(id, 0); }
  }

  return { state, isDown: (id) => down.has(id), badge, breaker, sparks: sparksAt, queue, drain, reset };
}
