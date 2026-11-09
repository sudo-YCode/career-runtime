import { h, s, fmt } from '../util/dom';
import { SERVICES, period, type Service, type Layer } from '../data/career';
import { createStack } from '../scene/stack';
import { adrsFor, adrNumber } from '../data/decisions';
import { edgeOf, labelOf } from '../scene/shapes';
import { chartCard, gaugeCard } from './charts';
import { codeCard } from './code';
import type { Telemetry, Sample } from '../runtime/telemetry';

const livePart = (layer: Layer, sample: Sample): string | null => {
  switch (layer.kind) {
    case 'chambers':
      return (layer.parts ?? []).map((p, i) => `${p} ${Math.round(Math.min(1, sample.parts[i] ?? 0) * 100)}%`).join(' · ');
    case 'reactors':
      return sample.loops.length
        ? `${sample.loops.length} loops · max delay ${fmt(Math.max(...sample.loops), 1)} ms${sample.blockedLoop >= 0 && sample.loops[sample.blockedLoop] > 10 ? ' · loop ' + sample.blockedLoop + ' blocked' : ''}`
        : null;
    case 'turbine':
      return sample.v.jitMs !== undefined ? `${fmt(sample.v.jitMs)} ms spent in the JIT so far`
        : sample.v.jitCompiled !== undefined ? `${fmt(sample.v.jitCompiled)} methods compiled so far`
        : sample.v.compiled !== undefined ? `${fmt(sample.v.compiled)} functions optimised so far` : null;
    default:
      return null;
  }
};

export function serviceView(svc: Service, telemetry: Telemetry) {
  const idx = SERVICES.findIndex((x) => x.id === svc.id);
  const open = SERVICES.filter((x) => !x.sealed);
  const next = open[(open.indexOf(svc) + 1) % open.length];
  const prev = open[(open.indexOf(svc) - 1 + open.length) % open.length];

  const root = h('div', { class: 'svc', style: `--hue:${svc.hue.base};--hue-light:${labelOf(svc.hue.id)}` });
  const stack = createStack(svc);

  // Header.
  root.append(
    h('div', { class: 'svc-bar' }, [
      h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'Back to the system' }, ['×']),
      h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, [h('a', { href: '#/' }, ['system']), ' / ', h('b', {}, [svc.name])]),
      h('div', { class: 'svc-nav' }, [
        h('a', { class: 'btn btn-ghost btn-sm', href: `#/s/${prev.id}` }, [`← ${prev.name}`]),
        h('a', { class: 'btn btn-ghost btn-sm', href: `#/s/${next.id}` }, [`${next.name} →`]),
      ]),
    ]),
    h('header', { class: 'svc-head' }, [
      h('p', { class: 'eyebrow' }, [`Service ${idx + 1} of 5 · ${svc.company}${svc.client ? ' · client ' + svc.client : ''} · ${period(svc)}`]),
      h('h1', { class: 'display' }, [svc.name]),
      h('div', { class: 'chips' }, [
        h('span', { class: 'chip chip-hue' }, [svc.language]),
        h('span', { class: 'chip' }, [`runtime: ${svc.runtime}`]),
        h('span', { class: 'chip' }, [`topic: ${svc.topic}`]),
      ]),
      h('p', { class: 'lede' }, [svc.summary]),
      adrsFor(svc.id).length
        ? h('p', { class: 'svc-adrs' }, [
          h('span', { class: 'dim' }, ['Decisions behind it: ']),
          ...adrsFor(svc.id).flatMap((a, i) => [i ? ' · ' : '', h('a', { href: `#/decisions/${a.id}` }, [`${adrNumber(a)} ${a.title}`])]),
        ])
        : null,
    ]),
  );

  // Layer cards (left), stack (centre), panels (right), leader lines (overlay).
  const liveLines: (HTMLElement | null)[] = [];
  const cards = svc.layers.map((layer, i) => {
    const live = layer.kind === 'loop' || layer.kind === 'statemachine' || layer.kind === 'chambers' || layer.kind === 'reactors' || layer.kind === 'turbine'
      ? h('span', { class: 'lc-live' }) : null;
    liveLines.push(live);
    const card = h('li', { class: 'layer-card', tabindex: 0 }, [
      h('span', { class: 'lc-index' }, [String(i + 1).padStart(2, '0')]),
      h('div', {}, [
        h('h3', {}, [layer.name]),
        h('p', { class: 'lc-tech' }, [layer.tech]),
        h('p', { class: 'lc-note' }, [layer.note]),
        live,
      ]),
      h('i', { class: 'lc-dot', 'aria-hidden': 'true' }),
    ]);
    card.addEventListener('mouseenter', () => { stack.hover(i); setCard(i); });
    card.addEventListener('mouseleave', () => { stack.hover(null); setCard(null); });
    card.addEventListener('focus', () => { stack.hover(i); setCard(i); });
    card.addEventListener('blur', () => { stack.hover(null); setCard(null); });
    return card;
  });
  const setCard = (i: number | null) => cards.forEach((c, k) => c.classList.toggle('hl', k === i));
  stack.onHover((i) => setCard(i));

  // Loop phase and coroutine state are pushed from the scene.
  svc.layers.forEach((layer, i) => {
    if (layer.kind !== 'loop' && layer.kind !== 'statemachine') return;
    const group = stack.svg.querySelectorAll('.layer:not(.base)')[svc.layers.length - 1 - i];
    group?.addEventListener('phase', (e) => {
      const phase = (e as CustomEvent<string>).detail;
      const el = liveLines[i];
      if (el) el.textContent = layer.kind === 'loop' ? `now in: ${phase}` : `label = ${(layer.parts ?? []).indexOf(phase)} · ${phase}`;
    });
  });

  const leaders = s('svg', { class: 'leaders', 'aria-hidden': 'true' });
  const color = edgeOf(svc.hue.id);
  const history = telemetry.historyOf(svc.id);
  const charts = svc.charts.map((c) => chartCard(c, color, history));
  const gauges = svc.gauges.map((g) => gaugeCard(g, color));
  const code = codeCard(svc.id);

  const grid = h('div', { class: 'svc-grid' }, [
    h('ol', { class: 'layer-cards' }, cards),
    h('div', { class: 'stack-wrap' }, [stack.svg]),
    h('aside', { class: 'svc-panels' }, [
      h('section', { class: 'panel' }, [
        h('div', { class: 'panel-head' }, [h('span', {}, ['runtime telemetry']), h('span', { class: 'dim' }, ['2 Hz'])]),
        ...charts.map((c) => c.el),
      ]),
      h('section', { class: 'panel gauges' }, gauges.map((g) => g.el)),
    ]),
    leaders,
  ]);
  root.append(grid);
  if (code) root.append(code);

  root.append(h('section', { class: 'built' }, [
    h('div', {}, [
      h('p', { class: 'eyebrow' }, [`${svc.role} · ${period(svc)}`]),
      h('h2', { class: 'display-sm' }, [`What I built at ${svc.client ?? svc.companyShort}`]),
    ]),
    h('ul', {}, svc.built.map((b) => h('li', {}, [b]))),
    h('div', { class: 'tags' }, svc.stack.map((t) => h('span', { class: 'chip' }, [t]))),
  ]));

  function drawLeaders() {
    if (window.innerWidth < 1100) { leaders.replaceChildren(); return; }
    const box = grid.getBoundingClientRect();
    leaders.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    leaders.setAttribute('width', String(box.width));
    leaders.setAttribute('height', String(box.height));
    const anchors = stack.anchors();
    leaders.replaceChildren();
    cards.forEach((card, i) => {
      const dot = card.querySelector('.lc-dot')!.getBoundingClientRect();
      const a = anchors[i];
      if (!a) return;
      const x0 = dot.left + dot.width / 2 - box.left, y0 = dot.top + dot.height / 2 - box.top;
      const x1 = a.x - box.left, y1 = a.y - box.top;
      const mid = x0 + Math.max(18, (x1 - x0) * 0.45);
      leaders.append(
        s('path', { d: `M${x0} ${y0}H${mid}L${x1} ${y1}`, class: `leader ${i % 2 ? 'amber' : 'cyan'}` }),
        s('circle', { cx: x1, cy: y1, r: 3.2, class: `leader-end ${i % 2 ? 'amber' : 'cyan'}` }),
      );
    });
  }

  const onSample = (sample: Sample) => {
    stack.update(sample);
    charts.forEach((c) => c.update(sample));
    gauges.forEach((g) => g.update(sample));
    svc.layers.forEach((layer, i) => {
      const text = livePart(layer, sample);
      const el = liveLines[i];
      if (text && el) el.textContent = text;
    });
  };
  const last = history[history.length - 1];
  if (last) onSample(last);
  const unsub = telemetry.subscribe(svc.id, onSample);
  const onResize = () => drawLeaders();
  window.addEventListener('resize', onResize);

  return {
    el: root,
    mounted() {
      requestAnimationFrame(() => { drawLeaders(); stack.explode(drawLeaders); });
    },
    destroy() {
      unsub();
      stack.destroy();
      window.removeEventListener('resize', onResize);
    },
  };
}
