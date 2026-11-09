import { gsap } from 'gsap';
import { s, frameLoop, gatedLoop, reducedMotion } from '../util/dom';
import { iso, plane } from './iso';
import { glassBox, solidBox, setBox, edgeOf, METAL, type Box } from './shapes';
import type { Layer, Service } from '../data/career';
import type { Sample } from '../runtime/telemetry';

const L = 230;
const BASE_H = 18;
const GAP_OPEN = 46;
const GAP_SHUT = 3;
const heightOf = (k: Layer['kind']) => (k === 'chambers' ? 70 : 12);

interface LayerView {
  layer: Layer;
  h: number;
  group: SVGGElement;
  z: number;
  update?: (s: Sample) => void;
  animate?: (dt: number) => void;
}

export interface StackScene {
  svg: SVGSVGElement;
  /** Client-space anchor (left corner of each layer's top face), top layer first. */
  anchors(): DOMPoint[];
  explode(onUpdate: () => void): void;
  update(sample: Sample): void;
  hover(index: number | null): void;
  onHover(fn: (index: number | null) => void): void;
  destroy(): void;
}

export function createStack(svc: Service): StackScene {
  const svg = s('svg', { viewBox: '-235 -520 470 660', class: 'stack', role: 'img', style: `--edge:${edgeOf(svc.hue.id)}`, 'aria-label': `Exploded view of ${svc.name}: ${svc.layers.map((l) => l.name).join(', ')}` });
  const hue = svc.hue;
  let hoverFn: (i: number | null) => void = () => {};

  // Shadow and base plate.
  svg.append(s('ellipse', { cx: 0, cy: 132, rx: 250, ry: 70, fill: `url(#halo-${hue.id})`, opacity: 0.55 }));
  const baseG = s('g', { class: 'layer base' }, [
    solidBox({ u: 0, v: 0, z: 0, w: L + 12, d: L + 12, h: BASE_H }, METAL),
    vents(),
  ]);
  svg.append(baseG);

  const views: LayerView[] = svc.layers.map((layer) => {
    const h = heightOf(layer.kind);
    const group = s('g', { class: 'layer', tabindex: -1 });
    const view: LayerView = { layer, h, group, z: 0 };
    build(view, hue.id, hue.base, hue.light);
    return view;
  });

  // Draw bottom-up so upper layers paint over lower ones.
  for (const v of [...views].reverse()) svg.append(v.group);
  views.forEach((v, i) => {
    v.group.addEventListener('mouseenter', () => { setHover(i); hoverFn(i); });
    v.group.addEventListener('mouseleave', () => { setHover(null); hoverFn(null); });
  });

  const state = { gap: GAP_SHUT };
  layout();

  function layout() {
    let z = BASE_H + state.gap;
    for (let i = views.length - 1; i >= 0; i--) {
      const v = views[i];
      v.z = z;
      v.group.setAttribute('transform', `translate(0 ${(-z).toFixed(2)})`);
      z += v.h + state.gap;
    }
  }

  function setHover(i: number | null) {
    svg.classList.toggle('has-hl', i !== null);
    views.forEach((v, k) => v.group.classList.toggle('hl', k === i));
  }

  const gate = gatedLoop(svg, frameLoop((dt) => { for (const v of views) v.animate?.(dt); }));
  gate.start();

  return {
    svg,
    anchors() {
      const m = svg.getScreenCTM();
      if (!m) return [];
      return views.map((v) => {
        const [x, y] = iso(-L / 2, L / 2, v.h);
        return new DOMPoint(x, y - v.z).matrixTransform(m);
      });
    },
    explode(onUpdate) {
      if (reducedMotion()) { state.gap = GAP_OPEN; layout(); onUpdate(); return; }
      gsap.to(state, {
        gap: GAP_OPEN, duration: 1.4, ease: 'power3.out', delay: 0.15,
        onUpdate: () => { layout(); onUpdate(); },
      });
    },
    update(sample) { for (const v of views) v.update?.(sample); },
    hover: setHover,
    onHover(fn) { hoverFn = fn; },
    destroy() { gate.dispose(); gsap.killTweensOf(state); },
  };
}

// ---------------------------------------------------------------------------------------------
// Layer builders. Everything is drawn at local z = 0; layout() lifts the whole group.

function slab(h: number) {
  return glassBox({ u: 0, v: 0, z: 0, w: L, d: L, h }, null);
}

function build(view: LayerView, hueId: string, base: string, light: string) {
  const { layer, h, group } = view;
  switch (layer.kind) {
    case 'ports': {
      const deco = s('g', { transform: plane(h) });
      for (const side of [-1, 1]) {
        for (const o of [-72, -24, 24, 72]) {
          deco.append(s('circle', { cx: o, cy: side * (L / 2 - 20), r: 7, class: 'hole' }));
          deco.append(s('circle', { cx: side * (L / 2 - 20), cy: o, r: 7, class: 'hole' }));
        }
      }
      deco.append(s('rect', { x: -62, y: -15, width: 124, height: 30, rx: 7, fill: base, 'fill-opacity': 0.14, 'stroke-opacity': 0.7, style: 'stroke:var(--edge)' }));
      const pins: SVGCircleElement[] = [];
      for (let i = 0; i < 6; i++) {
        const pin = s('circle', { cx: -45 + i * 18, cy: 0, r: 3.6, class: 'pin' });
        pins.push(pin);
        deco.append(pin);
      }
      group.append(slab(h), deco);
      let acc = 0;
      view.animate = (dt) => {
        acc += dt;
        if (acc < 0.12) return;
        acc = 0;
        for (const p of pins) p.classList.toggle('on', Math.random() < 0.45);
      };
      break;
    }
    case 'circuit': {
      const deco = s('g', { transform: plane(h) });
      const traces = [
        'M-96 -62 H-40 V-22 H28', 'M-92 42 H-22 V74 H58', 'M-60 -98 V-52 H8 V-84 H82',
        'M98 -30 H52 V22 H-8', 'M24 98 V60 H92', 'M-98 8 H-62 V-8 H-30', 'M70 -96 V-60',
      ];
      for (const d of traces) deco.append(s('path', { d, class: 'trace' }));
      for (const [x, y] of [[28, -22], [58, 74], [82, -84], [-8, 22], [92, 60], [-30, -8], [70, -60]]) {
        deco.append(s('circle', { cx: x, cy: y, r: 3.2, class: 'via' }));
      }
      const signal = s('circle', { r: 4.5, class: 'signal' });
      deco.append(signal);
      const chips: Box[] = [
        { u: -46, v: -58, z: h, w: 36, d: 28, h: 8 },
        { u: -60, v: 52, z: h, w: 28, d: 28, h: 8 },
        { u: 34, v: 30, z: h, w: 44, d: 32, h: 10 },
      ];
      group.append(slab(h), deco, ...chips.map((c) => solidBox(c, { top: base, left: `url(#corer-${hueId})`, right: `url(#corer-${hueId})`, stroke: 'var(--edge)', strokeOpacity: 0.5 })));
      const path = [[-96, -62], [-40, -62], [-40, -22], [28, -22]];
      let t = 0;
      view.animate = (dt) => {
        t = (t + dt * 0.8) % 1;
        const seg = Math.min(2, Math.floor(t * 3));
        const k = t * 3 - seg;
        const [ax, ay] = path[seg], [bx, by] = path[seg + 1];
        signal.setAttribute('cx', (ax + (bx - ax) * k).toFixed(1));
        signal.setAttribute('cy', (ay + (by - ay) * k).toFixed(1));
      };
      break;
    }
    case 'chambers': {
      const parts = layer.parts ?? [];
      const n = parts.length;
      const inner = s('g');
      const levels = parts.map(() => 0.3);
      const gapC = 10, pad = 22;
      const w = (L - pad * 2 - gapC * (n - 1)) / n;
      const us = parts.map((_, i) => -L / 2 + pad + w / 2 + i * (w + gapC));
      // Frames and fills are created once; only the fill heights change afterwards.
      const fills = us.map((u, i) => {
        inner.append(solidBox({ u, v: 0, z: 4, w, d: L - 90, h: 58 }, { top: 'none', left: 'none', right: 'none', stroke: 'var(--s-edge)', strokeOpacity: 0.16 }));
        const fill = solidBox({ u, v: 0, z: 4, w: w - 4, d: L - 94, h: 4 }, { top: light, left: `url(#core-${hueId})`, right: `url(#corer-${hueId})`, stroke: 'var(--edge)', strokeOpacity: 0.4 }, { opacity: String(i % 2 ? 0.79 : 0.95) });
        inner.append(fill);
        return fill;
      });
      const draw = () => levels.forEach((lv, i) => setBox(fills[i], { u: us[i], v: 0, z: 4, w: w - 4, d: L - 94, h: 4 + Math.max(0, Math.min(1, lv)) * 54 }));
      draw();
      group.append(glassBox({ u: 0, v: 0, z: 0, w: L, d: L, h }, null, [inner]));
      let targets = levels.slice();
      view.update = (sample) => { if (sample.parts.length) targets = sample.parts.slice(0, n); };
      view.animate = (dt) => {
        let moved = false;
        levels.forEach((lv, i) => {
          const next = lv + (targets[i] - lv) * Math.min(1, dt * 5);
          if (Math.abs(next - lv) > 0.002) { levels[i] = next; moved = true; }
        });
        if (moved) draw();
      };
      break;
    }
    case 'turbine': {
      const deco = s('g', { transform: plane(h) });
      deco.append(s('circle', { r: 94, class: 'housing' }), s('circle', { r: 86, class: 'housing-inner' }));
      const spin = s('g');
      const blades = 22;
      for (let i = 0; i < blades; i++) {
        const a = (i / blades) * Math.PI * 2;
        const P = (r: number, da: number) => `${(r * Math.cos(a + da)).toFixed(1)},${(r * Math.sin(a + da)).toFixed(1)}`;
        spin.append(s('polygon', { points: [P(20, 0), P(82, 0.2), P(82, 0.34), P(20, 0.1)].join(' '), class: 'blade' }));
      }
      spin.append(s('circle', { r: 18, fill: base, 'stroke-width': 1.5, style: 'stroke:var(--edge)' }), s('circle', { r: 6, style: 'fill:var(--s-hole)' }));
      deco.append(spin);
      group.append(slab(h), deco);
      let angle = 0, speed = 0.5;
      view.update = (sample) => { speed = sample.spin; };
      view.animate = (dt) => {
        angle = (angle + dt * speed * 360) % 360;
        spin.setAttribute('transform', `rotate(${angle.toFixed(1)})`);
      };
      break;
    }
    case 'loop': {
      const phases = layer.parts ?? [];
      const deco = s('g', { transform: plane(h) });
      deco.append(s('circle', { r: 80, class: 'track' }));
      const arcs = phases.map((_, i) => {
        const a0 = (i / phases.length) * Math.PI * 2 + 0.06;
        const a1 = ((i + 1) / phases.length) * Math.PI * 2 - 0.06;
        const d = `M${(80 * Math.cos(a0)).toFixed(1)} ${(80 * Math.sin(a0)).toFixed(1)}A80 80 0 0 1 ${(80 * Math.cos(a1)).toFixed(1)} ${(80 * Math.sin(a1)).toFixed(1)}`;
        const arc = s('path', { d, class: 'phase' });
        deco.append(arc);
        return arc;
      });
      deco.append(s('circle', { r: 30, class: 'loop-core' }));
      const halo = s('circle', { r: 17, class: 'marker-halo' });
      const marker = s('circle', { r: 8, class: 'marker' });
      deco.append(halo, marker);
      group.append(slab(h), deco);
      let angle = 0, speed = 0.8, current = -1;
      view.update = (sample) => { speed = sample.loopSpeed; };
      view.animate = (dt) => {
        angle = (angle + dt * speed * Math.PI * 2) % (Math.PI * 2);
        const x = (80 * Math.cos(angle)).toFixed(1), y = (80 * Math.sin(angle)).toFixed(1);
        marker.setAttribute('cx', x); marker.setAttribute('cy', y);
        halo.setAttribute('cx', x); halo.setAttribute('cy', y);
        const idx = Math.floor((angle / (Math.PI * 2)) * phases.length);
        if (idx !== current) {
          current = idx;
          arcs.forEach((a, i) => a.classList.toggle('on', i === idx));
          group.dispatchEvent(new CustomEvent('phase', { detail: phases[idx] }));
        }
      };
      break;
    }
    case 'reactors': {
      const n = layer.count ?? 8;
      const cols = n > 4 ? 4 : 2;
      const rows = Math.ceil(n / cols);
      const deco = s('g', { transform: plane(h) });
      const rings: { ring: SVGCircleElement; dot: SVGCircleElement; angle: number; speed: number; cx: number; cy: number }[] = [];
      for (let i = 0; i < n; i++) {
        const cx = (i % cols - (cols - 1) / 2) * (cols === 4 ? 50 : 84);
        const cy = (Math.floor(i / cols) - (rows - 1) / 2) * (rows === 2 ? 84 : 50);
        const ring = s('circle', { cx, cy, r: 20, class: 'reactor' });
        const dot = s('circle', { r: 4.6, class: 'marker' });
        deco.append(ring, dot);
        if (n <= 4) {
          for (let k = 0; k < 9; k++) {
            const a = (k / 9) * Math.PI * 2;
            deco.append(s('circle', { cx: cx + 31 * Math.cos(a), cy: cy + 31 * Math.sin(a), r: 2, class: 'vthread', style: `animation-delay:${(-Math.random() * 2).toFixed(2)}s` }));
          }
        }
        rings.push({ ring, dot, angle: Math.random() * 6, speed: 0.7 + Math.random() * 0.6, cx, cy });
      }
      group.append(slab(h), deco);
      let blocked = -1;
      view.update = (sample) => {
        blocked = sample.blockedLoop;
        rings.forEach((r, i) => r.ring.classList.toggle('blocked', i === blocked));
      };
      view.animate = (dt) => {
        rings.forEach((r, i) => {
          if (i !== blocked) r.angle += dt * r.speed * Math.PI * 2;
          r.dot.setAttribute('cx', (r.cx + 20 * Math.cos(r.angle)).toFixed(1));
          r.dot.setAttribute('cy', (r.cy + 20 * Math.sin(r.angle)).toFixed(1));
        });
      };
      break;
    }
    case 'statemachine': {
      const labels = layer.parts ?? [];
      const deco = s('g', { transform: plane(h) });
      const at = [[-58, -58], [58, -58], [58, 58], [-58, 58]];
      for (let i = 0; i < at.length; i++) {
        const [ax, ay] = at[i], [bx, by] = at[(i + 1) % at.length];
        const k = 22 / Math.hypot(bx - ax, by - ay);
        deco.append(s('line', {
          x1: ax + (bx - ax) * k, y1: ay + (by - ay) * k, x2: bx - (bx - ax) * k, y2: by - (by - ay) * k,
          class: 'edge', 'marker-end': 'url(#arrow)',
        }));
      }
      const nodes = at.map(([x, y], i) => {
        const node = s('g', { class: 'state' }, [
          s('circle', { cx: x, cy: y, r: 18 }),
          s('text', { x, y: y + 4, 'text-anchor': 'middle' }, [`L${i}`]),
        ]);
        deco.append(node);
        return node;
      });
      group.append(slab(h), deco);
      view.update = (sample) => {
        nodes.forEach((n, i) => n.classList.toggle('on', i === sample.label));
        group.dispatchEvent(new CustomEvent('phase', { detail: labels[sample.label] }));
      };
      break;
    }
  }
}

function vents() {
  const g = s('g', { opacity: 0.5 });
  const half = (L + 12) / 2;
  for (let i = 0; i < 9; i++) {
    const x = -half + 28 + i * 22;
    const [x1, y1] = iso(x, half, 5);
    const [x2, y2] = iso(x, half, 13);
    g.append(s('line', { x1, y1, x2, y2, 'stroke-width': 2, 'stroke-linecap': 'round', style: 'stroke:var(--s-vent)' }));
  }
  return g;
}
