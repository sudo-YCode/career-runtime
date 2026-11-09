import { s, gatedLoop, reducedMotion } from '../util/dom';
import { iso, pts, plane, isoRadii, worldAngleFor, type P2 } from './iso';
import { edgeOf, labelOf } from './shapes';
import { createHub } from './hub';
import { rackModule, MOD_W, MOD_H } from './rack';
import { chaosFx, type ChaosFx, type FxTarget, type Target } from './chaos';
import { SERVICES, HUB, years, type Service, type ServiceId } from '../data/career';

const R_RING = 200;
const R_MOD = 322;
const SHELL = MOD_W;
/** Height of the ring's top surface above the floor. */
const RING_Z = 12;

/** Clockwise from top-left in career order, so the ring reads like a timeline. */
const SCREEN_ANGLE: Record<ServiceId, number> = {
  'fleet-tracker': -150, notify: -90, 'edge-gateway': -30, migrator: 30, speech: 90, 'private-rnd': 150,
};

interface Placed {
  svc: Service; u: number; v: number; dir: [number, number]; theta: number; port: [number, number]; group: SVGGElement;
  cable: SVGGElement; curve: [P2, P2, P2];
}

const PHASE_A = 0.75, PHASE_B = 1.1, PHASE_C = 0.85;

export interface OverviewScene {
  svg: SVGSVGElement;
  start(): void;
  stop(): void;
  /** One career record: the module pulses and a burst of particles travels pipe → ring → hub. */
  emit(id: ServiceId | 'hub'): void;
  /** The ring flows only while the log is playing. */
  streaming(on: boolean): void;
  /** Light one module, or several, and dim the rest. Null clears. */
  highlight(id: ServiceId | ServiceId[] | null): void;
  onOpen(fn: (id: ServiceId | 'hub') => void): void;
  onHover(fn: (id: ServiceId | null) => void): void;
  /** Visual effects for chaos mode: badges, sparks, queued events, circuit breakers. */
  fx: ChaosFx;
  /** In chaos mode a click kills a module instead of opening it. */
  setChaos(on: boolean): void;
  /** In JD mode a click shows which requirements a module covers. */
  setJd(on: boolean): void;
  /** After a JD compile: modules with matches glow, modules with none dim. Null clears. */
  coverage(map: Map<Target, 'hit' | 'near' | 'miss'> | null): void;
  /** A short pulse, as when a requirement links to the module. */
  pulse(id: Target): void;
  /** Where a module's top (or the hub) is on screen, in viewport pixels. */
  anchor(id: Target): { x: number; y: number } | null;
}

export function createOverview(): OverviewScene {
  const svg = s('svg', { viewBox: '-700 -465 1400 885', class: 'scene', role: 'group', 'aria-label': 'Career system: five services and a sealed module around a Kafka ring and the career hub' });
  let openFn: (id: ServiceId | 'hub') => void = () => {};
  let hoverFn: (id: ServiceId | null) => void = () => {};

  // Floor: isometric blueprint grid fading out from the centre.
  const fade = s('radialGradient', { id: 'floor-fade', cx: 0, cy: 0, r: 620, gradientUnits: 'userSpaceOnUse' }, [
    s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 1 }),
    s('stop', { offset: 0.75, 'stop-color': '#fff', 'stop-opacity': 0.25 }),
    s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }),
  ]);
  const mask = s('mask', { id: 'floor-mask', maskUnits: 'userSpaceOnUse', x: -700, y: -500, width: 1400, height: 1000 }, [
    s('rect', { x: -700, y: -500, width: 1400, height: 1000, fill: 'url(#floor-fade)' }),
  ]);
  const defs = s('defs', {}, [fade, mask]);
  svg.append(defs);

  const grid = s('g', { transform: plane(0) });
  for (let i = -640; i <= 640; i += 40) {
    grid.append(
      s('line', { x1: i, y1: -640, x2: i, y2: 640, class: 'grid-line' }),
      s('line', { x1: -640, y1: i, x2: 640, y2: i, class: 'grid-line' }),
    );
  }
  grid.append(
    s('circle', { r: R_RING + 46, class: 'grid-ring' }),
    s('circle', { r: R_MOD + 110, class: 'grid-ring dashed' }),
  );
  svg.append(s('g', { mask: 'url(#floor-mask)' }, [grid]));

  // Place modules.
  const placed: Placed[] = SERVICES.map((svc) => {
    const theta = worldAngleFor(SCREEN_ANGLE[svc.id]);
    const dir: [number, number] = [Math.cos(theta), Math.sin(theta)];
    const u = R_MOD * dir[0], v = R_MOD * dir[1];
    const edge = SHELL / 2 / Math.max(Math.abs(dir[0]), Math.abs(dir[1]));
    return { svc, u, v, dir, theta, port: [u - dir[0] * edge, v - dir[1] * edge], group: s('g'), cable: s('g'), curve: [[0, 0], [0, 0], [0, 0]] };
  });
  for (const p of placed) p.group = moduleGroup(p);

  const back = placed.filter((p) => p.u + p.v < 0).sort((a, b) => a.u + a.v - (b.u + b.v));
  const front = placed.filter((p) => p.u + p.v >= 0).sort((a, b) => a.u + a.v - (b.u + b.v));

  const labels = s('g', { class: 'labels' });
  for (const p of placed) labels.append(labelFor(p));

  const particleLayer = s('g', { class: 'particles' });
  const beadLayer = s('g', { class: 'beads' });
  const topLayer = s('g', { class: 'fx-top' });
  const core = createHub(SERVICES.map((x) => ({ id: x.id, theta: worldAngleFor(SCREEN_ANGLE[x.id]) })));
  const hub = core.el;
  defs.append(...core.defs);

  svg.append(...back.map((p) => p.group), ringGroup(), cloud(), beadLayer, particleLayer, hub, ...front.map((p) => p.group), labels, topLayer);

  // Chaos-mode effects know where every module, cable and the ring are.
  const targets = new Map<Target, FxTarget>(placed.map((p) => [p.svc.id, {
    el: p.group, hue: p.svc.hue, phi: SCREEN_ANGLE[p.svc.id],
    badge: iso(p.u, p.v, MOD_H + 34), burst: iso(p.u, p.v, MOD_H), floor: iso(p.u, p.v, 0),
    cable: { el: p.cable, curve: p.curve },
  }]));
  targets.set('hub', { el: hub, hue: null, phi: 0, badge: iso(0, 0, 130), burst: iso(0, 0, 56), floor: iso(0, 0, 0) });
  const { rx: ringRx, ry: ringRy } = isoRadii(R_RING);
  const fx = chaosFx(svg, targets, { rx: ringRx, ry: ringRy, lift: RING_Z + 2, hub: iso(0, 0, 40) }, beadLayer, topLayer);
  const openLabels = new Map<Element, string>();

  // Interaction.
  for (const p of placed) {
    const open = () => openFn(p.svc.id);
    p.group.addEventListener('click', open);
    p.group.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    p.group.addEventListener('mouseenter', () => { hoverFn(p.svc.id); highlight(p.svc.id); });
    p.group.addEventListener('mouseleave', () => { hoverFn(null); highlight(null); });
    p.group.addEventListener('focus', () => highlight(p.svc.id));
    p.group.addEventListener('blur', () => highlight(null));
  }
  hub.addEventListener('click', () => openFn('hub'));
  hub.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFn('hub'); } });

  function highlight(id: ServiceId | ServiceId[] | null) {
    const ids = id === null ? [] : Array.isArray(id) ? id : [id];
    svg.classList.toggle('has-hl', ids.length > 0);
    for (const p of placed) {
      const on = ids.includes(p.svc.id);
      p.group.classList.toggle('hl', on);
      labels.querySelector(`[data-for="${p.svc.id}"]`)?.classList.toggle('hl', on);
    }
  }

  // Particles: each career record sends a short burst pipe → ring → hub. A particle's whole flight is
  // sampled into keyframes once, when it is sent, and handed to the browser as one transform/opacity
  // animation. The compositor runs it: no script and no repaint per frame, even with the log looping.
  const pool = Array.from({ length: 42 }, () => {
    const g = s('g', { class: 'particle', opacity: 0 });
    const halo = s('circle', { r: 6, class: 'p-halo', opacity: 0.35 });
    const dot = s('circle', { r: 2.1, class: 'p-dot' });
    g.append(halo, dot);
    particleLayer.append(g);
    return { g, halo, dot, anim: null as Animation | null };
  });
  let cursor = 0;
  const byId = new Map(placed.map((p) => [p.svc.id, p]));

  const beats = new WeakMap<Element, number>();
  const flash = (el: Element, ms: number) => {
    clearTimeout(beats.get(el));
    el.classList.add('beat');
    beats.set(el, window.setTimeout(() => el.classList.remove('beat'), ms));
  };

  const total = PHASE_A + PHASE_B + PHASE_C;
  const SAMPLES = 36;
  const STAGGER = 0.11;
  const BURST = 7;
  const span = total + STAGGER * (BURST - 1);
  // The stagger lives inside the keyframes (an invisible hold before and after the flight), not in an
  // animation delay, so all seven animations of a burst start in one frame and finish in one frame.
  // Every start and finish needs a main-thread frame; staggered ones needed fourteen.
  function flight(from: Placed, dth: number, lead: number): Keyframe[] {
    const at = (t: number) => {
      const [x, y, op] = particleAt(from, dth, t);
      return { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, opacity: +op.toFixed(3) };
    };
    const frames: Keyframe[] = [{ offset: 0, ...at(0) }];
    for (let i = 0; i <= SAMPLES; i++) frames.push({ offset: (lead + (i / SAMPLES) * total) / span, ...at((i / SAMPLES) * total) });
    frames.push({ offset: 1, ...at(total) });
    return frames;
  }

  function emit(id: ServiceId | 'hub') {
    if (fx.isDown(id)) return;
    if (id === 'hub') { flash(hub, 1400); return; }
    const from = byId.get(id);
    if (!from) return;
    flash(from.group, 900);
    if (!gate.running || reducedMotion()) return;
    for (let i = 0; i < BURST; i++) {
      const p = pool[cursor++ % pool.length];
      p.anim?.cancel();
      p.halo.setAttribute('fill', from.svc.hue.base);
      p.dot.setAttribute('style', `fill:${edgeOf(from.svc.hue.id)}`);
      const dth = (i % 2 ? 1 : -1) * (0.45 + Math.random() * 0.8);
      p.anim = p.g.animate(flight(from, dth, i * STAGGER), { duration: span * 1000, easing: 'linear' });
    }
  }

  // Off screen, particles in flight are dropped rather than left running.
  const gate = gatedLoop(svg, {
    start() {},
    stop() { for (const p of pool) { p.anim?.cancel(); p.anim = null; } },
  });

  function particleAt(from: Placed, dth: number, t: number): [number, number, number] {
    const entryR = R_RING + 13;
    if (t < PHASE_A) {
      const k = t / PHASE_A;
      const x = from.port[0] + (from.dir[0] * entryR - from.port[0]) * k;
      const y = from.port[1] + (from.dir[1] * entryR - from.port[1]) * k;
      const [sx, sy] = iso(x, y, 44 + (14 - 44) * k);
      return [sx, sy, Math.min(1, k * 4)];
    }
    if (t < PHASE_A + PHASE_B) {
      const k = (t - PHASE_A) / PHASE_B;
      const ease = k * k * (3 - 2 * k);
      const th = from.theta + dth * ease;
      const r = entryR + (R_RING - entryR) * k;
      const [sx, sy] = iso(r * Math.cos(th), r * Math.sin(th), 14);
      return [sx, sy, 1];
    }
    const k = Math.min(1, (t - PHASE_A - PHASE_B) / PHASE_C);
    const th = from.theta + dth + dth * 0.5 * k;
    const r = R_RING * (1 - k) + 26 * k;
    const [sx, sy] = iso(r * Math.cos(th), r * Math.sin(th), 14 + 22 * k);
    return [sx, sy, 1 - k * k];
  }

  return {
    svg,
    start: () => gate.start(),
    stop: () => gate.stop(),
    emit,
    streaming(on) { svg.classList.toggle('streaming', on); },
    highlight,
    onOpen(fn) { openFn = fn; },
    onHover(fn) { hoverFn = fn; },
    fx,
    setChaos(on) {
      svg.classList.toggle('chaos', on);
      for (const [id, T] of targets) {
        if (!openLabels.has(T.el)) openLabels.set(T.el, T.el.getAttribute('aria-label') ?? '');
        const name = id === 'hub' ? HUB.name : id;
        T.el.setAttribute('aria-label', on ? `Kill ${name}` : openLabels.get(T.el)!);
      }
      hub.querySelector('.hub-hint')!.textContent = on ? 'kill it' : 'decisions →';
    },
    setJd(on) {
      svg.classList.toggle('jd', on);
      for (const [id, T] of targets) {
        if (!openLabels.has(T.el)) openLabels.set(T.el, T.el.getAttribute('aria-label') ?? '');
        const label = id === 'hub' ? 'Show every requirement' : `Show the requirements ${id} covers`;
        T.el.setAttribute('aria-label', on ? label : openLabels.get(T.el)!);
      }
      hub.querySelector('.hub-hint')!.textContent = on ? 'show all' : 'decisions →';
    },
    coverage(map) {
      for (const [id, T] of targets) {
        const c = map?.get(id) ?? null;
        T.el.classList.toggle('jd-hit', c === 'hit');
        T.el.classList.toggle('jd-near', c === 'near');
        T.el.classList.toggle('jd-miss', c === 'miss');
      }
    },
    pulse(id) {
      const T = targets.get(id);
      if (T) flash(T.el, 700);
    },
    anchor(id) {
      const T = targets.get(id);
      const m = svg.getScreenCTM();
      if (!T || !m) return null;
      const p = new DOMPoint(T.burst[0], T.burst[1]).matrixTransform(m);
      return { x: p.x, y: p.y };
    },
  };
}

function moduleGroup(p: Placed): SVGGElement {
  const { svc, u, v } = p;
  const hue = svc.hue;
  const g = s('g', {
    class: `mod${svc.sealed ? ' sealed' : ''}`, 'data-id': svc.id, tabindex: 0, role: 'button',
    'aria-label': svc.sealed
      ? `${svc.name}: private freelance work, sealed`
      : `${svc.name}: ${svc.language}, ${svc.company}. Open the service.`,
  });

  const [hx, hy] = iso(u, v, 0);
  g.append(
    s('ellipse', { cx: hx, cy: hy + 8, rx: 168, ry: 98, fill: `url(#halo-${hue.id})`, class: 'halo' }),
    s('ellipse', { cx: hx, cy: hy + 4, rx: 112, ry: 64, fill: `url(#bloom-${hue.id})`, class: 'floor-glow' }),
    s('ellipse', { cx: hx, cy: hy + 6, rx: 140, ry: 80, fill: 'url(#halo-down)', class: 'halo-down' }),
  );
  p.cable = cable(p);
  g.append(p.cable);

  const lift = s('g', { class: 'lift' });
  lift.append(rackModule(svc.id, u, v, hue, !!svc.sealed));
  g.append(lift);
  return g;
}

/**
 * One glossy cable from the module's port down to the Kafka ring, with a circuit breaker
 * in the middle that only shows during a chaos-mode incident.
 */
function cable(p: Placed) {
  const { dir, port, svc } = p;
  const a = iso(port[0], port[1], 16);
  const b = iso(dir[0] * (R_RING + 10), dir[1] * (R_RING + 10), RING_Z - 2);
  const m: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 12];
  p.curve = [a, m, b];
  const d = `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${m[0].toFixed(1)} ${m[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  const mid: P2 = [0.25 * a[0] + 0.5 * m[0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * m[1] + 0.25 * b[1]];
  const hue = svc.hue;
  const { rx, ry } = isoRadii(9);
  return s('g', { class: `cable${svc.sealed ? ' sealed' : ''}` }, [
    s('path', { d, class: 'c-glow', stroke: hue.base }),
    s('path', { d, class: 'c-body', stroke: hue.base }),
    s('path', { d, class: 'c-shine', transform: 'translate(0 -1.6)', style: `stroke:${edgeOf(hue.id)}` }),
    s('ellipse', { cx: a[0], cy: a[1], rx: rx * 0.95, ry: ry * 1.25, class: 'c-port', style: `stroke:${edgeOf(hue.id)}` }),
    s('ellipse', { cx: b[0], cy: b[1], rx: rx * 0.7, ry: ry * 0.9, class: 'c-port', style: `stroke:${edgeOf(hue.id)}` }),
    s('g', { class: 'breaker', transform: `translate(${mid[0].toFixed(1)} ${mid[1].toFixed(1)})` }, [
      s('rect', { x: -17, y: -10, width: 34, height: 20, rx: 10, class: 'br-case' }),
      s('circle', { cx: -8, cy: 3, r: 2.4, class: 'br-pin' }),
      s('circle', { cx: 8, cy: 3, r: 2.4, class: 'br-pin' }),
      s('line', { x1: -8, y1: 3, x2: 8, y2: 3, class: 'br-lever shut' }),
      s('line', { x1: -8, y1: 3, x2: 4, y2: -7, class: 'br-lever open' }),
    ]),
  ]);
}

/** Ring colour at a screen angle: each service's hue sits at its own module, blended in between. */
const RING_STOPS = SERVICES.filter((x) => !x.sealed).map((x) => ({ phi: SCREEN_ANGLE[x.id], hue: x.hue }));

function ringColor(phi: number, key: 'base' | 'light') {
  const list = [...RING_STOPS].sort((p, q) => p.phi - q.phi);
  const a = (phi + 360) % 360;
  for (let i = 0; i < list.length; i++) {
    const p = list[i], q = list[(i + 1) % list.length];
    const from = (p.phi + 360) % 360;
    const span = ((q.phi - p.phi + 360) % 360) || 360;
    const off = (a - from + 360) % 360;
    if (off <= span) return mix(p.hue[key], q.hue[key], off / span);
  }
  return list[0].hue[key];
}

function mix(x: string, y: string, t: number) {
  const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const ch = (i: number) => Math.round(c(x, i) + (c(y, i) - c(x, i)) * t).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/**
 * The Kafka ring as a thick glass tube whose colour follows the services around it.
 * SVG has no conic gradient, so the tube is drawn in short arcs, each with its own colour.
 * The opaque layers overlap slightly so no hairline seams show between arcs.
 */
function ringGroup() {
  const g = s('g', { class: 'ring' });
  const { rx, ry } = isoRadii(R_RING);
  const at = (phi: number, lift: number) => {
    const t = (phi * Math.PI) / 180;
    return `${(rx * Math.cos(t)).toFixed(1)} ${(ry * Math.sin(t) - lift).toFixed(1)}`;
  };
  const arc = (p0: number, p1: number, lift: number) => `M${at(p0, lift)}A${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${at(p1, lift)}`;

  g.append(s('ellipse', { cx: 0, cy: 0, rx, ry, class: 'ring-shadow' }));
  const glow = s('g', { class: 'ring-glow' });
  const body = s('g', { class: 'ring-body' });
  const core = s('g', { class: 'ring-core', transform: 'translate(0 -4)' });
  const STEP = 5;
  for (let phi = -180; phi < 180; phi += STEP) {
    const base = ringColor(phi + STEP / 2, 'base');
    const light = ringColor(phi + STEP / 2, 'light');
    glow.append(s('path', { d: arc(phi, phi + STEP, RING_Z), style: `stroke:${base}` }));
    body.append(s('path', { d: arc(phi, phi + STEP + 0.8, RING_Z), style: `stroke:color-mix(in srgb, ${base} var(--s-ring-mix), var(--bg))` }));
    core.append(s('path', { d: arc(phi, phi + STEP + 0.8, RING_Z), style: `stroke:${light}` }));
  }
  g.append(
    glow, body, core,
    s('ellipse', { cx: 0, cy: -RING_Z - 9, rx, ry, class: 'ring-spec' }),
    // Records flowing round the ring while the log plays: a dashed circle lying on the ring's plane, turned
    // with a CSS rotation (compositor) rather than an animated dash offset (a repaint every frame).
    // 50 dash periods fit the circumference exactly, so the pattern has no seam.
    s('g', { transform: plane(RING_Z) }, [
      s('circle', { r: R_RING, class: 'ring-flow', 'stroke-dasharray': `3 ${((2 * Math.PI * R_RING) / 50 - 3).toFixed(3)}` }),
    ]),
  );
  const [lx, ly] = iso(R_RING * Math.cos(worldAngleFor(-6)), R_RING * Math.sin(worldAngleFor(-6)), 30);
  g.append(s('text', { x: lx + 58, y: ly - 4, class: 'ring-label' }, ['kafka · 6 topics · KRaft']));
  return g;
}

function cloud() {
  const g = s('g', { class: 'cloud' });
  const colors = ['var(--cyan)', '#ec8a3f', '#5fd16a', '#8f6cf7', '#4b8bdf', '#d35bd8', 'var(--s-edge)'];
  for (let i = 0; i < 90; i++) {
    const r = 64 + Math.sqrt(Math.random()) * (R_RING - 80);
    const th = Math.random() * Math.PI * 2;
    const [x, y] = iso(r * Math.cos(th), r * Math.sin(th), 6 + Math.random() * 26);
    g.append(s('circle', {
      cx: x.toFixed(1), cy: y.toFixed(1), r: (0.6 + Math.random() * 1.3).toFixed(2),
      style: `fill:${colors[i % colors.length]};animation-delay:${(-Math.random() * 4).toFixed(2)}s;animation-duration:${(2.4 + Math.random() * 3).toFixed(2)}s`,
    }));
  }
  return g;
}

function labelFor(p: Placed) {
  const { svc, u, v } = p;
  const phi = SCREEN_ANGLE[svc.id];
  const upper = phi < 0;
  const cos = Math.cos((phi * Math.PI) / 180);
  const side = cos > 0.2 ? 1 : cos < -0.2 ? -1 : 0;
  const start: P2 = upper ? iso(u, v, 112) : iso(u + SHELL / 2 + 13, v + SHELL / 2 + 13, 0);
  const end: P2 = [start[0] + side * 64, start[1] + (upper ? -46 : 40)];
  const anchor = side > 0 ? 'start' : side < 0 ? 'end' : 'middle';
  const tx = end[0] + side * 10;
  const ty = upper ? end[1] - (side === 0 ? 50 : 34) : end[1] + 18;
  const g = s('g', { class: 'mod-label', 'data-for': svc.id });
  g.append(
    s('polyline', { points: pts([start, end]), class: 'leader', style: `stroke:${edgeOf(svc.hue.id)}` }),
    s('circle', { cx: end[0], cy: end[1], r: 3, style: `fill:${edgeOf(svc.hue.id)}` }),
    s('text', { x: tx, y: ty, 'text-anchor': anchor, class: 'l-name' }, [svc.name]),
    s('text', { x: tx, y: ty + 19, 'text-anchor': anchor, class: 'l-lang', style: `fill:${labelOf(svc.hue.id)}` }, [svc.sealed ? 'sealed · code private' : svc.language]),
    s('text', { x: tx, y: ty + 37, 'text-anchor': anchor, class: 'l-co' }, [`${svc.client ? svc.client + ' · ' : ''}${svc.companyShort} · ${years(svc)}`]),
  );
  return g;
}
