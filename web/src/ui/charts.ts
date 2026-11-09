import { s, h, fmt } from '../util/dom';
import type { MetricChart, MetricGauge } from '../data/career';
import type { Sample } from '../runtime/telemetry';

const W = 300, H = 74, N = 72;

/** Rolling chart for one telemetry key. */
export function chartCard(spec: MetricChart, color: string, history: Sample[]) {
  const value = h('span', { class: 'm-value' });
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'm-chart', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const gradId = `fill-${spec.key}-${Math.random().toString(36).slice(2, 7)}`;
  svg.append(s('defs', {}, [s('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 }, [
    s('stop', { offset: 0, style: `stop-color:${color};stop-opacity:0.35` }),
    s('stop', { offset: 1, style: `stop-color:${color};stop-opacity:0` }),
  ])]));
  for (const y of [0.25, 0.5, 0.75]) svg.append(s('line', { x1: 0, x2: W, y1: H * y, y2: H * y, class: 'm-grid' }));
  const area = s('path', { fill: `url(#${gradId})` });
  const line = s('path', { fill: 'none', 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke', style: `stroke:${color}` });
  const bars = s('g', { style: `fill:${color}` });
  svg.append(area, line, bars);

  const card = h('div', { class: 'metric' }, [
    h('div', { class: 'm-head' }, [h('span', { class: 'm-label' }, [spec.label]), value]),
    svg,
  ]);

  const buf: number[] = [];
  const loops: number[] = [];
  const y = (v: number) => H - Math.min(1, Math.max(0, v / spec.max)) * (H - 4) - 2;

  function render() {
    if (spec.kind === 'loops') {
      bars.replaceChildren();
      const bw = W / loops.length;
      loops.forEach((v, i) => {
        const top = y(v);
        bars.append(s('rect', { x: i * bw + 4, y: top, width: bw - 8, height: H - top, rx: 2, opacity: v > 10 ? 1 : 0.75, class: v > 10 ? 'bar-hot' : '' }));
      });
      const max = Math.max(...loops);
      value.textContent = `max ${fmt(max, spec.digits ?? 1)} ${spec.unit}`;
      return;
    }
    const step = W / (N - 1);
    if (spec.kind === 'bars') {
      bars.replaceChildren();
      buf.forEach((v, i) => { if (v > 0) bars.append(s('rect', { x: i * step - 1.5, y: y(v), width: 3, height: H - y(v), rx: 1 })); });
      const last = [...buf].reverse().find((v) => v > 0) ?? 0;
      value.textContent = `last ${fmt(last, spec.digits ?? 0)} ${spec.unit}`.trim();
      return;
    }
    const pts = buf.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`);
    line.setAttribute('d', `M${pts.join('L')}`);
    area.setAttribute('d', `M0,${H}L${pts.join('L')}L${((buf.length - 1) * step).toFixed(1)},${H}Z`);
    value.textContent = `${fmt(buf[buf.length - 1] ?? 0, spec.digits ?? 0)} ${spec.unit}`.trim();
  }

  function push(sample: Sample) {
    if (spec.kind === 'loops') { loops.splice(0, loops.length, ...sample.loops); }
    else { buf.push(sample.v[spec.key] ?? 0); if (buf.length > N) buf.shift(); }
  }

  for (const sm of history) push(sm);
  render();
  return { el: card, update(sample: Sample) { push(sample); render(); } };
}

/** 270° arc gauge. */
export function gaugeCard(spec: MetricGauge, color: string) {
  const R = 38, C = 2 * Math.PI * R, ARC = C * 0.75;
  const svg = s('svg', { viewBox: '0 0 100 100', class: 'gauge', 'aria-hidden': 'true' });
  const track = s('circle', { cx: 50, cy: 50, r: R, class: 'g-track', 'stroke-dasharray': `${ARC} ${C}`, transform: 'rotate(135 50 50)' });
  const fill = s('circle', { cx: 50, cy: 50, r: R, style: `stroke:${color}`, class: 'g-fill', 'stroke-dasharray': `0 ${C}`, transform: 'rotate(135 50 50)' });
  const text = s('text', { x: 50, y: 54, 'text-anchor': 'middle', class: 'g-value' });
  const unit = s('text', { x: 50, y: 70, 'text-anchor': 'middle', class: 'g-unit' }, [spec.unit]);
  svg.append(track, fill, text, unit);
  const card = h('div', { class: 'gauge-card' }, [svg, h('span', { class: 'g-label' }, [spec.label])]);
  return {
    el: card,
    update(sample: Sample) {
      const v = sample.v[spec.key] ?? 0;
      const k = Math.min(1, Math.max(0, v / spec.max));
      fill.setAttribute('stroke-dasharray', `${(ARC * k).toFixed(1)} ${C}`);
      text.textContent = fmt(v, spec.digits ?? 0);
    },
  };
}
