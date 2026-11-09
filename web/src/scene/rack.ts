import { s } from '../util/dom';
import { iso, pts, plane, C, S, type P2 } from './iso';
import { edgeOf, solidBox } from './shapes';
import type { Hue } from '../data/career';

/** Footprint and height of one service module, in world units. */
export const MOD_W = 112;
export const MOD_H = 100;

const RACK_INSET = 11;          // gap between the glass and the rack on every side
const RACK_Z0 = 8;
const RACK_Z1 = 90;
/** Drawer rows on the rack's front face: [top, bottom] in face units, measured down from the rack's top. */
const ROWS: [number, number][] = [[6, 28], [32, 54], [58, 76]];

const f = (q: P2) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;

function toward(from: P2, to: P2, r: number): P2 {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(r, len / 2) / len;
  return [from[0] + dx * k, from[1] + dy * k];
}

/** Closed path through screen points with every corner rounded by about r pixels. */
export function roundedPath(p: P2[], r: number): string {
  let d = '';
  p.forEach((cur, i) => {
    const prev = p[(i - 1 + p.length) % p.length];
    const next = p[(i + 1) % p.length];
    d += `${i ? 'L' : 'M'}${f(toward(cur, prev, r))}Q${f(cur)} ${f(toward(cur, next, r))}`;
  });
  return d + 'Z';
}

/**
 * Transforms that lay flat 2D drawings onto a vertical face. Local x runs along the face,
 * local y runs down from the face's top edge, so circles drawn there come out correctly skewed.
 */
const onFront = (x0: number, y: number, zTop: number) => {
  const [ox, oy] = iso(x0, y, zTop);
  return `matrix(${C} ${S} 0 1 ${ox.toFixed(2)} ${oy.toFixed(2)})`;
};
const onSide = (x: number, y1: number, zTop: number) => {
  const [ox, oy] = iso(x, y1, zTop);
  return `matrix(${C} ${-S} 0 1 ${ox.toFixed(2)} ${oy.toFixed(2)})`;
};

/**
 * One service: a frosted, rounded glass case lit from inside, holding a small server rack.
 * The rack's status LEDs sit on top of the glass so they stay bright; their colours come from
 * CSS variables (--led-a, --led-b), which is how chaos mode turns them red or amber.
 */
export function rackModule(uid: string, u: number, v: number, hue: Hue, sealed: boolean): SVGGElement {
  const h = MOD_W / 2;
  const x0 = u - h, x1 = u + h, y0 = v - h, y1 = v + h, z1 = MOD_H;
  const edge = edgeOf(hue.id);
  const dash = sealed ? '4 5' : undefined;

  const outline: P2[] = [iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y0, 0), iso(x1, y1, 0), iso(x0, y1, 0), iso(x0, y1, z1)];
  const silhouette = roundedPath(outline, 11);
  const clipId = `mclip-${uid}`;
  const clipped = { 'clip-path': `url(#${clipId})` };

  const top = [iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)];
  const front = [iso(x0, y1, 0), iso(x1, y1, 0), iso(x1, y1, z1), iso(x0, y1, z1)];
  const side = [iso(x1, y0, 0), iso(x1, y1, 0), iso(x1, y1, z1), iso(x1, y0, z1)];
  const backSide = [iso(x0, y0, 0), iso(x0, y1, 0), iso(x0, y1, z1), iso(x0, y0, z1)];
  const backFront = [iso(x0, y0, 0), iso(x1, y0, 0), iso(x1, y0, z1), iso(x0, y0, z1)];

  // The rack inside.
  const r = h - RACK_INSET;
  const rackW = r * 2;
  const rack = solidBox(
    { u, v, z: RACK_Z0, w: rackW, d: rackW, h: RACK_Z1 - RACK_Z0 },
    { top: 'var(--rack-top)', left: 'var(--rack-front)', right: 'var(--rack-side)', stroke: 'var(--s-drawer-edge)', strokeOpacity: 0.7 },
  );
  const drawers = s('g', { transform: onFront(u - r, v + r, RACK_Z1), class: 'drawers' });
  const grille = s('g', { transform: onSide(u + r, v + r, RACK_Z1), class: 'grille' });
  const leds = s('g', { transform: onFront(u - r, v + r, RACK_Z1), class: 'leds' });
  ROWS.forEach(([t, b], row) => {
    const mid = (t + b) / 2;
    drawers.append(
      s('rect', { x: 5, y: t, width: rackW - 10, height: b - t, rx: 2.5, class: 'drawer' }),
      s('line', { x1: 7, x2: rackW - 7, y1: t + 0.9, y2: t + 0.9, class: 'drawer-hi' }),
    );
    for (const k of [0.36, 0.64]) grille.append(s('line', { x1: 8, x2: rackW - 8, y1: t + (b - t) * k, y2: t + (b - t) * k, class: 'vent' }));
    if (row < 2) {
      for (let i = 0; i < 6; i++) {
        const x = rackW * 0.5 + i * 6;
        drawers.append(s('line', { x1: x, x2: x, y1: t + 5, y2: b - 5, class: 'vent' }));
      }
      [12, 19.5, 27].forEach((x, i) => {
        const fill = sealed ? (row === 0 && i === 0 ? 'var(--amber)' : 'var(--s-led-off)') : i === 1 ? 'var(--led-b, #4ade80)' : `var(--led-a, ${hue.light})`;
        if (!sealed) leds.append(s('circle', { cx: x, cy: mid, r: 7, fill: `url(#bloom-${hue.id})`, class: 'led-halo' }));
        leds.append(s('circle', { cx: x, cy: mid, r: 2.7, class: 'led', style: `fill:${fill};animation-delay:${((row * 3 + i) * 0.29).toFixed(2)}s` }));
      });
    } else {
      leds.append(s('circle', {
        cx: 14, cy: mid, r: 5, fill: 'none', 'stroke-width': 1.9, class: 'power',
        style: `stroke:${sealed ? 'var(--s-led-off)' : `var(--led-a, ${hue.light})`}`,
      }));
      drawers.append(s('circle', { cx: rackW - 15, cy: mid, r: 3.6, class: 'knob' }));
    }
  });

  const [bx, by] = iso(u, v, 50);
  const glass = s('g', { class: 'glass', style: `--mod-hue:${hue.base}` }, [
    s('clipPath', { id: clipId }, [s('path', { d: silhouette })]),
    s('g', clipped, [
      s('polygon', { points: pts(backSide), fill: `url(#mgr-${hue.id})`, opacity: 0.4 }),
      s('polygon', { points: pts(backFront), fill: `url(#mgl-${hue.id})`, opacity: 0.32 }),
    ]),
    // Light inside the case: a gradient bloom behind the rack, never a blur filter (they repaint every frame).
    s('ellipse', { cx: bx, cy: by, rx: 104, ry: 82, fill: `url(#bloom-${hue.id})`, class: 'bloom', ...clipped }),
    rack,
    drawers,
    grille,
    s('g', { ...clipped, class: 'panes' }, [
      s('polygon', { points: pts(front), fill: `url(#mgl-${hue.id})` }),
      s('polygon', { points: pts(side), fill: `url(#mgr-${hue.id})` }),
      s('polygon', { points: pts(top), fill: `url(#mgt-${hue.id})` }),
      s('path', { d: silhouette, fill: 'none', stroke: hue.base, class: 'rim' }),
    ]),
    s('path', { d: silhouette, class: 'down-tint' }),
    s('polygon', {
      points: pts([iso(x0 + 8, y1, z1 - 7), iso(x1 - 14, y1, z1 - 7), iso(x1 - 14, y1, z1 - 11), iso(x0 + 8, y1, z1 - 18)]),
      class: 'specular',
    }),
  ]);

  // Bevelled edges: a soft wide stroke under a crisp one reads as a rounded glass edge.
  const near = iso(x1, y1, z1);
  const ridges = `M${f(near)}L${f(iso(x0, y1, z1))}M${f(near)}L${f(iso(x1, y0, z1))}M${f(near)}L${f(iso(x1, y1, 0))}`;
  glass.append(
    s('path', { d: ridges, class: 'bevel' }),
    s('path', { d: ridges, fill: 'none', 'stroke-width': 1.1, 'stroke-linecap': 'round', 'stroke-dasharray': dash, style: `stroke:${edge};stroke-opacity:.55` }),
    s('path', { d: silhouette, fill: 'none', 'stroke-width': 1.3, 'stroke-dasharray': dash, style: `stroke:${edge};stroke-opacity:.85` }),
    leds,
  );

  if (sealed) {
    glass.append(s('g', { transform: plane(z1, u, v) }, [
      s('rect', { x: -14, y: -6, width: 28, height: 22, rx: 3, class: 'lock-body' }),
      s('path', { d: 'M-8 -6 V-13 A8 8 0 0 1 8 -13 V-6', class: 'lock-shackle' }),
    ]));
  }
  return glass;
}
