import { s } from '../util/dom';
import { iso, pts, isoRadii, type P2 } from './iso';
import type { Hue } from '../data/career';

export interface Box { u: number; v: number; z: number; w: number; d: number; h: number; }

/** Colours may be CSS values, including var(--token), because they are applied as style properties. */
export interface BoxStyle {
  top: string;
  left: string;
  right: string;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
}

export const METAL: BoxStyle = {
  top: 'var(--s-metal-top)', left: 'var(--s-metal-left)', right: 'var(--s-metal-right)',
  stroke: 'var(--s-metal-line)', strokeOpacity: 0.07,
};

/** Theme-aware colour of a hue's outlines and of its text labels (see main.ts). */
export const edgeOf = (hueId: string) => `var(--edge-${hueId})`;
export const labelOf = (hueId: string) => `var(--label-${hueId})`;

/** Inline style string from a property map, skipping empty values. */
export function paint(props: Record<string, string | number | undefined>): string {
  return Object.entries(props)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

function corners(b: Box) {
  return {
    x0: b.u - b.w / 2, x1: b.u + b.w / 2,
    y0: b.v - b.d / 2, y1: b.v + b.d / 2,
    z0: b.z, z1: b.z + b.h,
  };
}

/** Screen polygons of a box. `left` is the y=y1 face, `right` the x=x1 face (the two you can see). */
export function faces(b: Box) {
  const { x0, x1, y0, y1, z0, z1 } = corners(b);
  return {
    top: [iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)],
    left: [iso(x0, y1, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x0, y1, z1)],
    right: [iso(x1, y0, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x1, y0, z1)],
    backLeft: [iso(x0, y0, z0), iso(x0, y1, z0), iso(x0, y1, z1), iso(x0, y0, z1)],
    backRight: [iso(x0, y0, z0), iso(x1, y0, z0), iso(x1, y0, z1), iso(x0, y0, z1)],
  };
}

const seg = (a: P2, b: P2) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;

export function edges(b: Box, which: 'front' | 'back', color: string, opacity: number, width = 1, dash?: string) {
  const { x0, x1, y0, y1, z0, z1 } = corners(b);
  const d = which === 'front'
    ? [
        seg(iso(x0, y0, z1), iso(x1, y0, z1)), seg(iso(x1, y0, z1), iso(x1, y1, z1)),
        seg(iso(x1, y1, z1), iso(x0, y1, z1)), seg(iso(x0, y1, z1), iso(x0, y0, z1)),
        seg(iso(x0, y1, z0), iso(x0, y1, z1)), seg(iso(x1, y1, z0), iso(x1, y1, z1)),
        seg(iso(x1, y0, z0), iso(x1, y0, z1)),
        seg(iso(x0, y1, z0), iso(x1, y1, z0)), seg(iso(x1, y1, z0), iso(x1, y0, z0)),
      ]
    : [
        seg(iso(x0, y0, z0), iso(x0, y0, z1)), seg(iso(x0, y0, z0), iso(x1, y0, z0)),
        seg(iso(x0, y0, z0), iso(x0, y1, z0)),
      ];
  return s('path', {
    d: d.join(''), fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': dash,
    style: paint({ stroke: color, 'stroke-opacity': opacity, 'stroke-width': width }),
  });
}

export function solidBox(b: Box, st: BoxStyle, attrs: Record<string, string> = {}) {
  const f = faces(b);
  const line = { stroke: st.stroke ?? 'none', 'stroke-opacity': st.strokeOpacity ?? 1, 'stroke-width': st.strokeWidth ?? 1 };
  return s('g', attrs, [
    s('polygon', { points: pts(f.left), 'stroke-linejoin': 'round', style: paint({ fill: st.left, ...line }) }),
    s('polygon', { points: pts(f.right), 'stroke-linejoin': 'round', style: paint({ fill: st.right, ...line }) }),
    s('polygon', { points: pts(f.top), 'stroke-linejoin': 'round', style: paint({ fill: st.top, ...line }) }),
  ]);
}

/** Reshape a box made by solidBox in place (no new elements, so no DOM churn while animating). */
export function setBox(g: SVGGElement, b: Box) {
  const f = faces(b);
  const [left, right, top] = Array.from(g.children);
  left.setAttribute('points', pts(f.left));
  right.setAttribute('points', pts(f.right));
  top.setAttribute('points', pts(f.top));
}

/**
 * See-through box: back walls, then whatever sits inside, then tinted front walls and bright edges.
 * With no hue it renders as clear frosted glass.
 */
export function glassBox(b: Box, hue: Hue | null, inner: SVGElement[] = [], opts: { dash?: string; edge?: number } = {}) {
  const f = faces(b);
  const id = hue ? hue.id : 'clear';
  const edge = hue ? edgeOf(hue.id) : 'var(--s-edge)';
  const { x0, x1, y1, z1 } = corners(b);
  const specular = [iso(x0 + 6, y1, z1 - 5), iso(x1 - 10, y1, z1 - 5), iso(x1 - 10, y1, z1 - 9), iso(x0 + 6, y1, z1 - 15)];
  return s('g', { class: 'glass' }, [
    s('polygon', { points: pts(f.backLeft), fill: `url(#gr-${id})`, opacity: 0.6 }),
    s('polygon', { points: pts(f.backRight), fill: `url(#gl-${id})`, opacity: 0.5 }),
    edges(b, 'back', edge, 0.22, 1, opts.dash),
    ...inner,
    s('polygon', { points: pts(f.left), fill: `url(#gl-${id})` }),
    s('polygon', { points: pts(f.right), fill: `url(#gr-${id})` }),
    s('polygon', { points: pts(f.top), fill: `url(#gt-${id})` }),
    s('polygon', { points: pts(specular), opacity: 0.1, style: 'fill:var(--s-specular)' }),
    edges(b, 'front', edge, opts.edge ?? 0.7, 1.1, opts.dash),
  ]);
}

/** Vertical cylinder standing on the floor at world (u, v). */
export function cylinder(u: number, v: number, r: number, z: number, h: number) {
  const { rx, ry } = isoRadii(r);
  const [cx, cyb] = iso(u, v, z);
  const cyt = cyb - h;
  const side =
    `M${cx - rx} ${cyt}L${cx - rx} ${cyb}A${rx} ${ry} 0 0 0 ${cx + rx} ${cyb}` +
    `L${cx + rx} ${cyt}A${rx} ${ry} 0 0 1 ${cx - rx} ${cyt}Z`;
  return { side, cx, top: cyt, bottom: cyb, rx, ry };
}

type Stop = [offset: number, color: string, opacity: number];

const stops = (list: Stop[]) =>
  list.map(([o, c, a]) => s('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` }));

function linear(id: string, list: Stop[], x2 = 0, y2 = 1) {
  return s('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, stops(list));
}

function radial(id: string, list: Stop[]) {
  return s('radialGradient', { id }, stops(list));
}

/**
 * One hidden SVG holding every gradient, shared by all scenes on the page.
 * No blur filters on purpose: every glow is a gradient, so repainting the animated scenes stays cheap.
 */
export function globalDefs(hues: Hue[]): SVGSVGElement {
  const defs = s('defs');
  defs.append(
    linear('gl-clear', [[0, 'var(--s-glass)', 0.16], [1, 'var(--s-glass-2)', 0.05]]),
    linear('gr-clear', [[0, 'var(--s-glass-2)', 0.1], [1, 'var(--s-glass-3)', 0.04]]),
    linear('gt-clear', [[0, 'var(--s-glass)', 0.14], [1, 'var(--s-glass)', 0.04]], 1, 1),
    linear('ring-band', [[0, 'var(--s-glass)', 0.3], [0.5, 'var(--s-ring)', 0.1], [1, 'var(--s-glass)', 0.3]], 1, 0),
    linear('spectrum', [
      [0, '#ec8a3f', 1], [0.25, '#5fd16a', 1], [0.5, '#8f6cf7', 1], [0.75, '#4b8bdf', 1], [1, '#d35bd8', 1],
    ], 1, 0),
    linear('beam', [[0, 'var(--s-beam)', 0.22], [0.5, 'var(--s-beam)', 0.06], [1, 'var(--s-beam)', 0.22]], 1, 0),
    radial('cap-top', [[0, 'var(--s-halo)', 0.3], [0.6, 'var(--s-glass)', 0.08], [1, 'var(--s-glass)', 0.04]]),
    radial('halo-cyan', [[0, '#5cdcf5', 0.5], [0.5, '#5cdcf5', 0.12], [1, '#5cdcf5', 0]]),
    radial('halo-amber', [[0, '#f5b65c', 0.55], [0.5, '#f5b65c', 0.14], [1, '#f5b65c', 0]]),
    radial('halo-white', [[0, 'var(--s-halo)', 0.4], [0.5, 'var(--s-halo)', 0.1], [1, 'var(--s-halo)', 0]]),
    radial('halo-down', [[0, 'var(--s-down)', 0.55], [0.55, 'var(--s-down)', 0.16], [1, 'var(--s-down)', 0]]),
    s('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, [
      s('path', { d: 'M0 0L10 5L0 10z', style: 'fill:var(--s-arrow)' }),
    ]),
  );
  for (const hue of hues) {
    defs.append(
      linear(`gl-${hue.id}`, [[0, hue.light, 0.3], [1, hue.base, 0.08]]),
      linear(`gr-${hue.id}`, [[0, hue.base, 0.2], [1, hue.deep, 0.06]]),
      linear(`gt-${hue.id}`, [[0, hue.light, 0.26], [1, hue.light, 0.05]], 1, 1),
      linear(`core-${hue.id}`, [[0, hue.light, 1], [0.45, hue.base, 1], [1, hue.deep, 1]]),
      linear(`corer-${hue.id}`, [[0, hue.base, 1], [1, hue.deep, 1]]),
      radial(`halo-${hue.id}`, [[0, hue.base, 0.5], [0.55, hue.base, 0.14], [1, hue.base, 0]]),
      // Frosted module glass (overview): denser than the clear service-page glass so the case glows.
      linear(`mgl-${hue.id}`, [[0, hue.base, 0.62], [0.55, hue.base, 0.4], [1, hue.deep, 0.42]]),
      linear(`mgr-${hue.id}`, [[0, hue.base, 0.5], [1, hue.deep, 0.55]]),
      linear(`mgt-${hue.id}`, [[0, hue.light, 0.85], [1, hue.base, 0.6]], 1, 1),
      radial(`bloom-${hue.id}`, [[0, hue.light, 0.95], [0.4, hue.base, 0.5], [1, hue.base, 0]]),
    );
  }
  return s('svg', { class: 'global-defs', width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' }, [defs]);
}
