import { h, fmt, reducedMotion } from '../util/dom';
import { serviceById, experience } from '../data/career';
import { ADRS, SPANS, TAGS, adrById, adrNumber, type Adr, type Tag, type TraceSpan } from '../data/decisions';
import { SAMPLES, SYMBOLS, type Kind } from '../data/skills';
import { compileJd, WEIGHT, type Report, type Priority, type Status } from '../jd/compile';
import { lastJd, setLastJd } from '../jd/last';

const T0 = Date.UTC(2018, 0, 1);
const ICON: Record<Status, string> = { match: '✓', near: '~', miss: '✗' };
const KIND: Record<Kind, string> = {
  have: 'proved by a project', listed: 'on the skills list', near: 'adjacent experience', none: 'not on the résumé',
};
const PRI: Record<Priority, string> = { must: 'must', role: 'role', nice: 'nice' };

const time = (iso: string | null) => (iso ? Date.parse(iso + 'T00:00:00Z') : Date.now());

function months(span: TraceSpan) {
  const m = Math.max(1, Math.round((time(span.end) - time(span.start)) / (30.4375 * 86_400_000)));
  const y = Math.floor(m / 12);
  return y ? `${y} yr${y > 1 ? 's' : ''}${m % 12 ? ` ${m % 12} mo` : ''}` : `${m} mo`;
}

function yearsOf(span: TraceSpan) {
  const a = span.start.slice(0, 4);
  const b = span.end ? span.end.slice(0, 4) : 'now';
  return a === b ? a : `${a}–${b === 'now' ? 'now' : b.slice(2)}`;
}

/** A span's colour: its service's hue, cyan for this site, neutral for the root. */
function hueOf(svc: TraceSpan['svc']) {
  if (svc === 'site') return { c: 'var(--cyan)', ct: 'var(--cyan)' };
  const s = svc ? serviceById(svc) : undefined;
  return s ? { c: s.hue.base, ct: `var(--label-${s.hue.id})` } : { c: 'var(--text-3)', ct: 'var(--text-2)' };
}

const depthOf = (span: TraceSpan): number => (span.parent ? 1 + depthOf(SPANS.find((x) => x.id === span.parent)!) : 0);

export function decisionsView(root: HTMLElement) {
  const end = Date.now() + 75 * 86_400_000;
  const pos = (iso: string | null) => ((time(iso) - T0) / (end - T0)) * 100;
  let current: Adr = adrById('adr-007')!;
  let tag: Tag | null = null;

  // ---- Header ---------------------------------------------------------------------------------
  const xp = experience();
  const header = h('header', { class: 'dl-head' }, [
    h('p', { class: 'eyebrow' }, ['career-core · the decision log']),
    h('h1', { class: 'display' }, ['The résumé says what I built. ', h('em', {}, ['This is why.'])]),
    h('p', { class: 'lede' }, [
      'Every project is drawn as a trace: a span for each role, child spans for the work inside it, and a marker for each decision that shaped it. ',
      'Open a marker for the record behind it: the problem, the options on the table, the choice, and what it cost.',
    ]),
    h('div', { class: 'chips' }, [
      h('span', { class: 'chip' }, [`${ADRS.length} decisions`]),
      h('span', { class: 'chip' }, [`${SPANS.filter((s) => depthOf(s) === 2).length} projects`]),
      h('span', { class: 'chip' }, [`${xp.label} · 2018 to now`]),
    ]),
  ]);

  // ---- Trace ----------------------------------------------------------------------------------
  const marks = new Map<string, HTMLButtonElement>();
  const rows = new Map<string, HTMLElement>();
  const axis = h('div', { class: 'tr-axis', 'aria-hidden': 'true' });
  for (let y = 2018; y <= new Date().getFullYear(); y++) {
    axis.append(h('span', { style: `left:${pos(`${y}-01-01`).toFixed(2)}%` }, [String(y)]));
  }
  const list = h('ol', { class: 'tr-rows', 'aria-label': 'Career trace: roles, the work inside them, and the decisions in each' });
  SPANS.forEach((span, i) => {
    const d = depthOf(span);
    const { c, ct } = hueOf(span.svc);
    const left = pos(span.start);
    const width = Math.max(0.7, pos(span.end) - left);
    const track = h('div', { class: 'tr-track' }, [
      h('i', { class: 'tr-bar', style: `left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;animation-delay:${(i * 40).toString()}ms` }),
    ]);
    for (const a of ADRS.filter((x) => x.span === span.id)) {
      const x = left + width * a.at;
      const m = h('button', {
        class: `tr-mark${x > 62 ? ' r' : ''}`, type: 'button', 'data-tip': `${adrNumber(a)} · ${a.title}`,
        'aria-label': `${adrNumber(a)}: ${a.title}`,
        style: `left:${x.toFixed(2)}%;animation-delay:${(300 + i * 40).toString()}ms`,
      });
      m.addEventListener('click', () => select(a, true));
      marks.set(a.id, m);
      track.append(m);
    }
    const row = h('li', { class: `tr-row d${d}`, style: `--c:${c};--ct:${ct}` }, [
      h('div', { class: 'tr-label' }, [
        h('span', { class: 'tr-name' }, [span.name]),
        h('span', { class: 'tr-sub' }, [d === 2 ? span.detail : `${span.detail} · ${d ? months(span) : yearsOf(span)}`]),
      ]),
      track,
    ]);
    rows.set(span.id, row);
    list.append(row);
  });

  const filters = h('div', { class: 'dl-filters', role: 'group', 'aria-label': 'Filter decisions by theme' }, [
    h('span', { class: 'dim' }, ['Show']),
    ...[{ id: null as Tag | null, label: 'All' }, ...TAGS].map((t) => {
      const b = h('button', { class: 'dl-filter', type: 'button', 'aria-pressed': String(t.id === tag) }, [t.label]);
      b.dataset.tag = t.id ?? '';
      b.addEventListener('click', () => setTag(t.id));
      return b;
    }),
  ]);

  const trace = h('section', { class: 'panel dl-trace', 'aria-label': 'Career trace' }, [
    h('div', { class: 'panel-head' }, [h('span', {}, ['trace · career']), h('span', { class: 'dim' }, [`${SPANS.length} spans · ${ADRS.length} decisions`])]),
    filters,
    h('div', { class: 'tr-frame' }, [h('div', { class: 'tr-axis-row' }, [h('span'), axis]), list]),
    h('p', { class: 'tr-legend' }, [
      h('span', {}, [h('i', { class: 'lg-bar' }), 'a role, or the work inside it']),
      h('span', {}, [h('i', { class: 'lg-mark' }), 'a decision: open it']),
      h('span', {}, ['gaps between bars are gaps between jobs']),
    ]),
  ]);

  // ---- Decision record ------------------------------------------------------------------------
  const record = h('article', { class: 'panel adr', 'aria-live': 'polite' });
  const prevBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' });
  const nextBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' });
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  const visible = () => ADRS.filter((a) => !tag || a.tags.includes(tag));
  function step(dir: number) {
    const v = visible();
    const i = v.indexOf(current);
    select(v[(i + dir + v.length) % v.length], true);
  }

  function linksFor(a: Adr) {
    if (a.svc === 'site') {
      return a.id === 'adr-012'
        ? h('a', { class: 'btn btn-ghost btn-sm', href: '#/decisions/jd' }, ['See the compiler’s stages ↓'])
        : h('a', { class: 'btn btn-ghost btn-sm', href: '#/' }, ['Back to the system']);
    }
    const svc = serviceById(a.svc)!;
    return svc.sealed
      ? h('a', { class: 'btn btn-ghost btn-sm', href: '#/resume' }, ['Private work: read the résumé'])
      : h('a', { class: 'btn btn-ghost btn-sm', href: `#/s/${svc.id}` }, [`Open ${svc.name} →`]);
  }

  function render(a: Adr) {
    const span = SPANS.find((s) => s.id === a.span)!;
    const parent = SPANS.find((s) => s.id === span.parent);
    const { c, ct } = hueOf(span.svc);
    const v = visible();
    const i = v.indexOf(a);
    const prev = v[(i - 1 + v.length) % v.length];
    const next = v[(i + 1) % v.length];
    prevBtn.textContent = `← ${adrNumber(prev)}`;
    nextBtn.textContent = `${adrNumber(next)} →`;
    record.setAttribute('style', `--c:${c};--ct:${ct}`);
    record.replaceChildren(
      h('div', { class: 'adr-top' }, [
        h('span', { class: 'adr-id' }, [adrNumber(a)]),
        h('span', { class: 'adr-status' }, ['accepted']),
        h('span', { class: 'adr-where' }, [`${parent?.name ?? ''} · ${span.name} · ${yearsOf(span)}`]),
      ]),
      h('h2', { class: 'adr-title', tabindex: -1 }, [a.title]),
      h('div', { class: 'adr-tags' }, a.tags.map((t) => h('span', { class: 'adr-tag' }, [TAGS.find((x) => x.id === t)!.label]))),
      h('section', {}, [h('h3', {}, ['Context']), h('p', {}, [a.context])]),
      h('section', {}, [
        h('h3', {}, ['Options considered']),
        h('ul', { class: 'adr-options' }, a.options.map((o) => h('li', { class: o.chosen ? 'chosen' : '' }, [
          h('span', { class: 'opt-mark', 'aria-hidden': 'true' }, [o.chosen ? '✓' : '✗']),
          h('div', {}, [h('b', {}, [o.name, o.chosen ? h('span', { class: 'sr-only' }, [' (chosen)']) : null]), h('span', {}, [o.why])]),
        ]))),
      ]),
      h('section', {}, [h('h3', {}, ['Decision']), h('p', { class: 'adr-decision' }, [a.decision])]),
      h('section', {}, [
        h('h3', {}, ['Consequences']),
        h('div', { class: 'adr-cons' }, [
          h('ul', { class: 'gains', 'aria-label': 'What it bought' }, a.gains.map((x) => h('li', {}, [x]))),
          h('ul', { class: 'costs', 'aria-label': 'What it cost' }, a.costs.map((x) => h('li', {}, [x]))),
        ]),
      ]),
      h('div', { class: 'adr-foot' }, [linksFor(a), h('span', { class: 'adr-nav' }, [prevBtn, nextBtn])]),
    );
  }

  function select(a: Adr, user = false) {
    current = a;
    for (const [id, m] of marks) {
      m.classList.toggle('on', id === a.id);
      m.setAttribute('aria-pressed', String(id === a.id));
    }
    for (const [id, row] of rows) row.classList.toggle('on', id === a.span);
    render(a);
    if (user) {
      history.replaceState(null, '', `#/decisions/${a.id}`);
      // On narrow screens the record sits under the trace: bring it into view.
      if (matchMedia('(max-width: 1100px)').matches) record.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function setTag(t: Tag | null) {
    tag = t;
    for (const b of filters.querySelectorAll<HTMLButtonElement>('.dl-filter')) b.setAttribute('aria-pressed', String((b.dataset.tag || null) === t));
    for (const a of ADRS) marks.get(a.id)!.classList.toggle('dim', !!t && !a.tags.includes(t));
    if (t && !current.tags.includes(t)) select(visible()[0]); else render(current);
  }

  // ---- The JD compiler, stage by stage --------------------------------------------------------
  const input = h('textarea', { class: 'ex-input', spellcheck: 'false', 'aria-label': 'Job description to compile' });
  const tabs: { id: string; btn: HTMLButtonElement }[] = [];
  const out = h('div', { class: 'ex-out', role: 'tabpanel' });
  let tab = 'parse';
  let report: Report | null = null;
  const tabBar = h('div', { class: 'ex-tabs', role: 'tablist', 'aria-label': 'Compiler stages' });
  for (const [id, label] of [['lex', '1 · lex'], ['parse', '2 · parse'], ['link', '3 · link'], ['score', '4 · score']]) {
    const btn = h('button', { class: 'ex-tab', type: 'button', role: 'tab' }, [h('b', {}, [label]), h('span', {})]);
    btn.addEventListener('click', () => { tab = id; drawStage(); });
    tabs.push({ id, btn });
    tabBar.append(btn);
  }
  const samples = h('div', { class: 'jd-samples' }, [
    h('span', { class: 'dim' }, ['Samples:']),
    ...SAMPLES.map((x) => {
      const b = h('button', { class: 'jd-sample', type: 'button' }, [x.label]);
      b.addEventListener('click', () => { input.value = x.text; run(true); });
      return b;
    }),
  ]);

  const explorer = h('section', { class: 'dl-explorer', id: 'jd-stages', 'aria-labelledby': 'ex-title' }, [
    h('header', { class: 'dl-head' }, [
      h('p', { class: 'eyebrow' }, ['career-core · the JD compiler']),
      h('h2', { class: 'display-sm', id: 'ex-title' }, ['The JD compiler, ', h('em', {}, ['stage by stage.'])]),
      h('p', { class: 'lede' }, [
        'Edit the job description on the left. Each tab shows what one stage of the compiler really produced from it. ',
        'It is the same code that scores a JD on the home page, so every number there can be traced back here.',
      ]),
    ]),
    h('div', { class: 'ex-grid' }, [
      h('div', { class: 'panel ex-src' }, [
        h('div', { class: 'panel-head' }, [h('span', {}, ['source · jd.txt']), h('a', { class: 'jd-link', href: '#/jd' }, ['Open in the JD compiler →'])]),
        input,
        samples,
      ]),
      h('div', { class: 'panel ex-panel' }, [tabBar, out]),
    ]),
  ]);

  let debounce = 0;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = window.setTimeout(() => run(true), 180);
  });

  /** Compile what is in the box. Only the visitor's own edits carry over to the JD compiler. */
  function run(byVisitor = false) {
    const text = input.value;
    if (byVisitor) setLastJd(text);
    report = text.trim() ? compileJd(text) : null;
    const r = report;
    const label = (id: string, extra: string) => tabs.find((t) => t.id === id)!.btn.querySelector('span')!.textContent = extra;
    label('lex', r ? `${r.stages.tokens.length} tokens` : '–');
    label('parse', r ? `${r.stages.clauses.length} clauses` : '–');
    label('link', r ? `${r.reqs.length} requirements` : '–');
    label('score', r ? `${r.fit}%` : '–');
    drawStage();
  }

  /** Bold every skill word inside a clause. */
  function marked(text: string, words: string[]) {
    if (!words.length) return [text];
    const esc = [...new Set(words)].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return text.split(new RegExp(`(${esc.join('|')})`, 'g')).map((part, i) => (i % 2 ? h('b', {}, [part]) : part));
  }

  function drawStage() {
    for (const t of tabs) {
      t.btn.setAttribute('aria-selected', String(t.id === tab));
      t.btn.classList.toggle('on', t.id === tab);
    }
    const r = report;
    if (!r) { out.replaceChildren(h('p', { class: 'ex-empty' }, ['Paste a job description, or pick a sample.'])); return; }

    if (tab === 'lex') {
      const groups = (['have', 'listed', 'near', 'none'] as Kind[]).map((k) => {
        const toks = r.stages.tokens.filter((t) => t.kind === k);
        const seen = new Set<string>();
        const chips = toks.filter((t) => { const key = t.word.toLowerCase() + t.sym; if (seen.has(key)) return false; seen.add(key); return true; });
        return h('div', { class: `ex-group ${k}` }, [
          h('h4', {}, [KIND[k], h('span', { class: 'dim' }, [` · ${toks.length}`])]),
          chips.length
            ? h('div', { class: 'ex-chips' }, chips.map((t) => h('span', { class: 'ex-chip', title: t.name }, [
              t.word, t.word.toLowerCase() !== t.name.toLowerCase() ? h('small', {}, [` → ${t.name}`]) : null,
            ])))
            : h('p', { class: 'dim ex-none' }, ['none']),
        ]);
      });
      out.replaceChildren(
        h('p', { class: 'ex-note' }, [`The lexer matched ${r.stages.tokens.length} words against ${SYMBOLS.length} known skills and their aliases. `,
          'When two matches overlap, the longer one wins (“Spring Boot” over “Spring”).']),
        ...groups,
      );
      return;
    }

    if (tab === 'parse') {
      out.replaceChildren(
        h('p', { class: 'ex-note' }, ['Each clause gets a priority from its section heading, its cue words, or the job title. Must counts 3, role 2, nice 1.']),
        h('ol', { class: 'ex-rows' }, r.stages.clauses.map((c) => h('li', { class: `ex-clause${c.skip ? ' skip' : ''}` }, [
          h('span', { class: `ex-pri ${c.skip ? 'skip' : c.priority}` }, [c.skip ? 'skip' : PRI[c.priority]]),
          h('div', {}, [h('p', {}, marked(c.text, c.words)), h('small', {}, [c.why])]),
        ]))),
      );
      return;
    }

    if (tab === 'link') {
      out.replaceChildren(
        h('p', { class: 'ex-note' }, ['The linker resolves each requirement against the résumé: a project, the skills list, adjacent experience, or nothing.']),
        h('ol', { class: 'ex-rows' }, r.reqs.map((q) => h('li', { class: `ex-link ${q.status}` }, [
          h('span', { class: 'ex-ic' }, [ICON[q.status]]),
          h('div', {}, [
            h('p', {}, [h('b', {}, [q.label]), h('span', { class: `ex-pri ${q.priority}` }, [PRI[q.priority]])]),
            h('small', {}, [q.status === 'miss' ? 'not in the career log' : q.status === 'near'
              ? `adjacent: ${q.proof}`
              : `${q.where.map((w) => (w === 'hub' ? 'skills list' : w)).join(' · ')}: ${q.proof}`]),
          ]),
          h('span', { class: 'ex-credit' }, [`${Math.round(q.credit * 100)}%`]),
        ]))),
      );
      return;
    }

    const rows = r.reqs.map((q) => ({ q, w: WEIGHT[q.priority], pts: WEIGHT[q.priority] * q.credit }));
    const sw = rows.reduce((s, x) => s + x.w, 0);
    const sp = rows.reduce((s, x) => s + x.pts, 0);
    const raw = Math.round((sp / sw) * 100);
    out.replaceChildren(
      h('p', { class: 'ex-note' }, ['Each requirement earns its weight times its credit. The fit is the points earned over the points possible.']),
      h('p', { class: 'ex-sum' }, [
        `${fmt(sp, 2)} ÷ ${sw} = `, h('b', {}, [`${raw}%`]),
        r.cap ? ` → capped at ${r.cap}%: the stack in the job title is not on the résumé` : '',
      ]),
      h('table', { class: 'ex-table' }, [
        h('thead', {}, [h('tr', {}, [h('th', {}, ['requirement']), h('th', {}, ['weight']), h('th', {}, ['credit']), h('th', {}, ['points'])])]),
        h('tbody', {}, rows.map(({ q, w, pts }) => h('tr', { class: q.status }, [
          h('td', {}, [`${ICON[q.status]} ${q.label}`]),
          h('td', {}, [`${w} · ${PRI[q.priority]}`]),
          h('td', {}, [`${Math.round(q.credit * 100)}%`]),
          h('td', {}, [fmt(pts, 2)]),
        ]))),
      ]),
    );
  }

  // ---- Page -----------------------------------------------------------------------------------
  root.append(h('div', { class: 'dl' }, [
    header,
    h('div', { class: 'dl-main' }, [trace, record]),
    explorer,
  ]));
  select(current);

  return {
    show(sub?: string) {
      if (!input.value || lastJd() && lastJd() !== input.value) input.value = lastJd() || SAMPLES[0].text;
      run();
      const a = sub ? adrById(sub) : undefined;
      if (a) {
        if (tag && !a.tags.includes(tag)) setTag(null);
        select(a);
        window.setTimeout(() => rows.get(a.span)?.scrollIntoView({ block: 'center' }), 60);
      }
      if (sub === 'jd') window.setTimeout(() => explorer.scrollIntoView({ block: 'start' }), 60);
      root.querySelector('.dl')!.classList.remove('played');
      void (root.querySelector('.dl') as HTMLElement).offsetWidth;  // restart the bar animation
      root.querySelector('.dl')!.classList.add('played');
    },
    hide() { clearTimeout(debounce); },
  };
}
