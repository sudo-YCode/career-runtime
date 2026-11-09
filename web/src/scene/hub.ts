import { s } from '../util/dom';
import { iso, isoRadii, plane, pts, type P2 } from './iso';
import { cylinder, edgeOf } from './shapes';
import { HUB, SERVICES, type ServiceId } from '../data/career';

/**
 * The career-core hub: a glass cap on a lit base.
 *
 * Inside the glass runs the consumer. Each poll hands a Kafka consumer one mixed batch, with records
 * from every topic together; the consumer splits the batch by partition and works through each
 * partition in offset order. So records pop up in the middle, a rotor turns to each record's
 * partition, and the record runs out along that lane into its bin. Each lane points at the service
 * its topic comes from.
 *
 * Under the cap sits an RGB strip: a colour wheel sliding round the band, lighting the base and the floor.
 *
 * Cost: every moving part animates only transform or opacity, so the browser runs it on the
 * compositor. No script runs per frame, nothing is repainted, and an idle page does no main-thread work.
 * The sorter is one 12-second choreography written out as keyframes once, at start-up.
 */

/** Height of the sorter's floor inside the cap, which spans z 32–56. */
const FLOOR_Z = 34;
const LANE_IN = 15;
const LANE_OUT = 50;
const BIN_R = 57;
const DOT_R = 4.5;
/** Seconds a record waits at the centre while the rotor turns, then its run out to the bin. */
const GATE = 0.24;
const FLIGHT = 0.6;
/** Gap between the records of one poll. */
const PACE = 0.34;
/** Length of the sorter's loop. Long enough that nobody sees it repeat. */
const CYCLE = 12;
/** The loop starts mid-poll, so the first look already shows records on the move. */
const STILL_AT = 1.18;

/** A laptop-style RGB wheel. The strip slides one wheel (RGB_PERIOD units) every 6 s (overview.css). */
const RGB = ['#ff4d6d', '#ff9f43', '#ffd93d', '#4ade80', '#2dd4bf', '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#ff4d6d'];
const RGB_PERIOD = 180;  // keep in step with @keyframes rgb-slide in overview.css

export interface Lane { id: ServiceId; theta: number }

export interface Hub {
  el: SVGGElement;
  /** Gradients and clip paths; they go in the scene's own <defs>. */
  defs: SVGElement[];
}

interface Run { lane: number; t: number }

export function createHub(laneDefs: Lane[]): Hub {
  const g = s('g', {
    class: 'hub', tabindex: 0, role: 'button',
    'aria-label': `${HUB.name}: the consumer of every topic. Open the decision log behind the résumé`,
    style: `--so-cycle:${CYCLE}s;--so-still:-${STILL_AT}s`,
  });
  const [hx, hy] = iso(0, 0, 0);
  g.append(
    s('ellipse', { cx: hx, cy: hy, rx: 150, ry: 88, fill: 'url(#halo-white)', class: 'hub-halo' }),
    s('ellipse', { cx: hx, cy: hy, rx: 160, ry: 94, fill: 'url(#halo-down)', class: 'halo-down' }),
  );

  // RGB. Each lit surface is a clip shape over a strip of the wheel that slides sideways by one period
  // and starts again, which looks seamless because the gradient repeats every period.
  const defs: SVGElement[] = [
    s('linearGradient', {
      id: 'rgb-flow', gradientUnits: 'userSpaceOnUse', spreadMethod: 'repeat',
      x1: -RGB_PERIOD / 2, y1: 0, x2: RGB_PERIOD / 2, y2: 0,
    }, RGB.map((c, i) => s('stop', { offset: (i / (RGB.length - 1)).toFixed(3), 'stop-color': c }))),
  ];
  const lit = (id: string, d: string, cls: string, rule?: 'evenodd') => {
    defs.push(s('clipPath', { id }, [s('path', { d, 'clip-rule': rule })]));
    const half = 150;  // covers the outer floor spill, the widest surface, at every point of the slide
    return s('g', { 'clip-path': `url(#${id})`, class: cls }, [
      s('rect', { x: -half - RGB_PERIOD, y: -100, width: 2 * half + RGB_PERIOD, height: 200, fill: 'url(#rgb-flow)', class: 'rgb-slide' }),
    ]);
  };
  const ring = (r0: number, r1: number) => {
    const a = isoRadii(r1), b = isoRadii(r0);
    const e = (rx: number, ry: number) => `M${hx - rx} ${hy}A${rx} ${ry} 0 1 0 ${hx + rx} ${hy}A${rx} ${ry} 0 1 0 ${hx - rx} ${hy}Z`;
    return e(a.rx, a.ry) + e(b.rx, b.ry);
  };
  const base = cylinder(0, 0, 80, 0, 16);
  const band = cylinder(0, 0, 70, 16, 16);
  g.append(
    // Light on the floor in three steps, so it fades out instead of ending in a hard line.
    lit('rgb-c-floor3', ring(104, 120), 'rgb-floor rgb-floor3', 'evenodd'),
    lit('rgb-c-floor2', ring(92, 104.5), 'rgb-floor rgb-floor2', 'evenodd'),
    lit('rgb-c-floor1', ring(78, 92.5), 'rgb-floor', 'evenodd'),
    s('path', { d: base.side, 'stroke-opacity': 0.08, style: 'fill:var(--s-metal-left);stroke:var(--s-metal-line)' }),
    s('ellipse', { cx: base.cx, cy: base.top, rx: base.rx, ry: base.ry, 'stroke-opacity': 0.1, style: 'fill:var(--s-metal-top);stroke:var(--s-metal-line)' }),
    s('g', { class: 'rgb' }, [
      // Glow in two soft steps round the strip, then the strip, then its bright diffuser line.
      lit('rgb-c-glow2', cylinder(0, 0, 78, 8, 32).side, 'rgb-glow2'),
      lit('rgb-c-glow1', cylinder(0, 0, 74, 12, 24).side, 'rgb-glow1'),
      lit('rgb-c-band', band.side, 'rgb-band'),
      s('path', { d: cylinder(0, 0, 70.4, 21.5, 4.5).side, class: 'rgb-core' }),
    ]),
  );

  // The consumer inside the glass.
  const sorter = s('g', { class: 'sorter', 'aria-hidden': 'true' });
  const at = (r: number, th: number, z = FLOOR_Z): P2 => iso(r * Math.cos(th), r * Math.sin(th), z);
  const plate = isoRadii(BIN_R + 6);
  const [px, py] = iso(0, 0, FLOOR_Z);
  sorter.append(s('ellipse', { cx: px, cy: py, rx: plate.rx, ry: plate.ry, class: 'so-plate' }));
  const lanes = laneDefs.map((l) => {
    const svc = SERVICES.find((x) => x.id === l.id)!;
    return { ...l, color: svc.sealed ? 'var(--s-edge)' : edgeOf(svc.hue.id), weight: svc.sealed ? 0.4 : 1 };
  });
  const runs = schedule(lanes.map((l) => l.weight));
  const css: string[] = [];
  const bins = s('g');
  const recs = s('g', { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)})` });
  lanes.forEach((l, i) => {
    const mine = runs.filter((r) => r.lane === i);
    const arc: P2[] = [];
    for (let k = -2; k <= 2; k++) arc.push(at(BIN_R, l.theta + (k * 5 * Math.PI) / 180));
    const [ax, ay] = at(LANE_IN, l.theta);
    const [bx, by] = at(LANE_OUT, l.theta);
    sorter.append(s('line', { x1: ax.toFixed(1), y1: ay.toFixed(1), x2: bx.toFixed(1), y2: by.toFixed(1), class: 'so-lane', style: `stroke:${l.color}` }));
    bins.append(s('polyline', { points: pts(arc), class: 'so-bin so-anim', style: `stroke:${l.color};animation-name:so-bin-${i}` }));
    css.push(binKeyframes(`so-bin-${i}`, mine));
    // The run out, in screen space: from the centre to the bin along this lane.
    const end = iso(BIN_R * Math.cos(l.theta), BIN_R * Math.sin(l.theta));
    const zero = iso(0, 0);
    const [dx, dy] = [end[0] - zero[0], end[1] - zero[1]];
    css.push(recKeyframes(`so-rec-${i}`, mine, [dx, dy]));
    // Without motion (reduced-motion turns animations off) each record sits in front of its bin: sorted.
    const parked = `transform:translate(${(dx * 0.8).toFixed(1)}px, ${(dy * 0.8).toFixed(1)}px)`;
    recs.append(s('circle', { cx: 0, cy: 0, r: DOT_R, class: 'so-rec so-anim', style: `fill:${l.color};stroke:${l.color};animation-name:so-rec-${i};${parked}` }));
  });
  css.push(armKeyframes('so-arm', runs.map((r) => ({ t: r.t, deg: (lanes[r.lane].theta * 180) / Math.PI }))));
  // The rotor lies flat on the sorter's floor and turns about its centre.
  const hubR = isoRadii(7);
  sorter.append(
    bins,
    s('g', { transform: plane(FLOOR_Z) }, [
      s('g', { class: 'so-arm so-anim', style: `animation-name:so-arm;transform:rotate(${((lanes[1].theta * 180) / Math.PI).toFixed(1)}deg)` }, [
        s('line', { x1: 0, y1: 0, x2: 17, y2: 0 }),
        s('circle', { cx: 17, cy: 0, r: 2.4 }),
      ]),
    ]),
    s('ellipse', { cx: px, cy: py, rx: hubR.rx, ry: hubR.ry, class: 'so-hub' }),
    recs,
  );
  g.append(sorter);
  injectCss('hub-sorter-keyframes', css.join('\n'));

  // The cap. Its front wall is drawn over the sorter, so the sorter sits inside the glass.
  const cap = cylinder(0, 0, 74, 32, 24);
  g.append(
    s('path', { d: cap.side, 'fill-opacity': 0.1, 'stroke-opacity': 0.45, style: 'fill:var(--s-glass);stroke:var(--s-edge)' }),
    s('ellipse', { cx: cap.cx, cy: cap.top, rx: cap.rx, ry: cap.ry, fill: 'url(#cap-top)', 'stroke-opacity': 0.6, style: 'stroke:var(--s-edge)' }),
  );
  // Status LEDs round the front of the cap.
  const capR = isoRadii(74);
  for (let k = 0, phi = 18; phi <= 162; phi += 16, k++) {
    const t = (phi * Math.PI) / 180;
    g.append(s('circle', {
      cx: (cap.cx + capR.rx * Math.cos(t)).toFixed(1), cy: (cap.top + 13 + capR.ry * Math.sin(t)).toFixed(1), r: 2.1,
      class: 'led hub-led', style: `fill:var(--led-a, var(--cyan));animation-delay:${(k * 0.21).toFixed(2)}s`,
    }));
  }
  const inner = isoRadii(46);
  g.append(s('ellipse', { cx: cap.cx, cy: cap.top, rx: inner.rx, ry: inner.ry, fill: 'none', 'stroke-opacity': 0.35, 'stroke-dasharray': '2 5', style: 'stroke:var(--s-edge)' }));
  g.append(s('g', { transform: plane(56) }, [
    s('text', { transform: 'rotate(-90)', 'text-anchor': 'middle', y: 7, class: 'hub-text' }, ['CAREER']),
  ]));
  g.append(
    s('text', { x: hx, y: hy + 70, 'text-anchor': 'middle', class: 'hub-caption' }, [HUB.name]),
    s('text', { x: hx + 106, y: hy + 4, class: 'hub-hint' }, ['decisions →']),
  );
  return { el: g, defs };
}

/**
 * One loop of polls: batches of two to five records, PACE apart, with a pause between polls.
 * Lanes are drawn at random (the sealed topic less often) from a fixed seed, so every visit plays the
 * same loop. A lane never takes a second record while its first is still running.
 */
function schedule(weights: number[]): Run[] {
  const rnd = mulberry32(20261109);
  const total = weights.reduce((a, b) => a + b, 0);
  const draw = () => {
    let x = rnd() * total;
    for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; }
    return weights.length - 1;
  };
  const last = weights.map(() => -9);
  const runs: Run[] = [];
  let t = 0.3;
  for (;;) {
    const size = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < size; k++) {
      if (t + GATE + FLIGHT + 0.4 > CYCLE) return runs;
      let lane = draw();
      for (let tries = 0; tries < 12 && t - last[lane] < 1; tries++) lane = draw();
      if (t - last[lane] >= 1) { runs.push({ lane, t }); last[lane] = t; }
      t += PACE;
    }
    t += 0.55 + rnd() * 0.8;
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const pct = (t: number) => `${Math.min(100, Math.max(0, (t / CYCLE) * 100)).toFixed(3)}%`;

/** A record: pops up at the centre, waits for the rotor, runs out to its bin, and goes out. */
function recKeyframes(name: string, runs: Run[], [x, y]: P2) {
  const home = 'translate(0px, 0px)';
  const away = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  const k = [`0% { opacity: 0; transform: ${home} scale(0); }`];
  for (const { t } of runs) {
    const end = t + GATE + FLIGHT;
    k.push(
      `${pct(t - 0.02)} { opacity: 0; transform: ${home} scale(0); }`,
      `${pct(t)} { opacity: 1; transform: ${home} scale(0); }`,
      `${pct(t + 0.14)} { opacity: 1; transform: ${home} scale(1); }`,
      `${pct(t + GATE)} { opacity: 1; transform: ${home} scale(1); animation-timing-function: cubic-bezier(.3, .6, .35, 1); }`,
      `${pct(end)} { opacity: 1; transform: ${away} scale(1); }`,
      `${pct(end + 0.08)} { opacity: 0; transform: ${away} scale(.5); }`,
    );
  }
  k.push(`100% { opacity: 0; transform: ${home} scale(0); }`);
  return `@keyframes ${name} {\n  ${k.join('\n  ')}\n}`;
}

/** A bin lights up as a record lands in it, then fades back over about a second. */
function binKeyframes(name: string, runs: Run[]) {
  const lands = runs.map((r) => r.t + GATE + FLIGHT);
  const heat = (t: number) => {
    let h = 0;
    for (const L of lands) for (const at of [L - CYCLE, L]) if (t >= at) h = Math.max(h, Math.exp(-(t - at) / 0.55));
    return h;
  };
  const times = new Set([0, CYCLE]);
  for (const L of lands) for (const d of [-0.02, 0, 0.2, 0.5, 0.9, 1.5]) if (L + d > 0 && L + d < CYCLE) times.add(L + d);
  const k = [...times].sort((a, b) => a - b).map((t) => `${pct(t)} { opacity: ${(0.3 + 0.7 * heat(t)).toFixed(2)}; }`);
  return `@keyframes ${name} {\n  ${k.join('\n  ')}\n}`;
}

/** The rotor turns the short way to each record's lane as the record pops up, and holds there. */
function armKeyframes(name: string, stops: { t: number; deg: number }[]) {
  const norm = (d: number) => ((d % 360) + 540) % 360 - 180;
  let at = norm(stops[stops.length - 1].deg);
  const k = [`0% { transform: rotate(${at.toFixed(1)}deg); }`];
  for (const { t, deg } of stops) {
    k.push(`${pct(t)} { transform: rotate(${at.toFixed(1)}deg); animation-timing-function: ease-in-out; }`);
    at += norm(deg - at);
    k.push(`${pct(t + 0.18)} { transform: rotate(${at.toFixed(1)}deg); }`);
  }
  k.push(`100% { transform: rotate(${at.toFixed(1)}deg); }`);
  return `@keyframes ${name} {\n  ${k.join('\n  ')}\n}`;
}

function injectCss(id: string, text: string) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.append(el);
  }
  el.textContent = text;
}
