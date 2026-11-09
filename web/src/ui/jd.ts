import { gsap } from 'gsap';
import { h, s, fmt, reducedMotion } from '../util/dom';
import { PROFILE, SERVICES, serviceById, emailAddress, experience, type ServiceId } from '../data/career';
import { SAMPLES, SYMBOLS, type Where } from '../data/skills';
import { compileJd, MAX_CHARS, type Report, type Req, type Status, type Priority } from '../jd/compile';
import { encodeJd, decodeJd } from '../jd/share';
import { setLastJd, lastJd } from '../jd/last';
import type { OverviewScene } from '../scene/overview';
import type { Target } from '../scene/chaos';

const ICON: Record<Status, string> = { match: '✓', near: '~', miss: '✗' };
const WORD: Record<Status, string> = { match: 'Matched', near: 'Adjacent', miss: 'Missing' };
const GROUP: Record<Priority, string> = { must: 'Must-have', role: 'In the role', nice: 'Nice to have' };
const DOC = 'M7 3h7l5 5v13H7zM14 3v5h5M9.5 12.5h7M9.5 16h7';
const STOPS = ['#ec8a3f', '#5fd16a', '#d35bd8', '#8f6cf7', '#4b8bdf'];

interface P { x: number; y: number; }

/** A requirement's colour: the hue of the first module that proves it; amber when adjacent, red when missing. */
function hueOf(q: Req) {
  if (q.status === 'miss') return { c: 'var(--s-down)', ct: 'var(--s-down)' };
  if (q.status === 'near') return { c: 'var(--amber-led)', ct: 'var(--amber)' };
  const id = q.where.find((w): w is ServiceId => w !== 'hub');
  const svc = id ? serviceById(id) : undefined;
  return svc ? { c: svc.hue.base, ct: `var(--label-${svc.hue.id})` } : { c: 'var(--cyan)', ct: 'var(--cyan)' };
}

const modulesOf = (q: Req) => q.where.filter((w): w is ServiceId => w !== 'hub');
const proofLine = (q: Req) => (q.status === 'miss' ? 'Not in the career log.' : q.status === 'near' ? `Nearest: ${q.proof}` : q.proof);
const whereText = (q: Req) => (q.status === 'miss' ? 'unresolved' : `${q.status === 'near' ? 'adjacent → ' : ''}${q.where.map((w) => (w === 'hub' ? 'skills list' : w)).join(' · ')}`);

let gauges = 0;
/** The fit score as a ring in the services' colours. */
function gauge(cls: string) {
  const id = `fit-grad-${++gauges}`;
  const R = 42;
  const C = 2 * Math.PI * R;
  const val = s('circle', { cx: 50, cy: 50, r: R, class: 'g-val', stroke: `url(#${id})`, 'stroke-dasharray': `0 ${C.toFixed(1)}`, transform: 'rotate(-90 50 50)' });
  const num = s('text', { x: 50, y: 54, 'text-anchor': 'middle', class: 'g-num' }, ['–']);
  const svg = s('svg', { viewBox: '0 0 100 100', class: `fit-ring ${cls}`, role: 'img', 'aria-label': 'Fit score: not compiled yet' }, [
    s('defs', {}, [s('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 }, STOPS.map((c, i) => s('stop', { offset: i / (STOPS.length - 1), 'stop-color': c })))]),
    s('circle', { cx: 50, cy: 50, r: R, class: 'g-track' }),
    val,
    num,
    s('text', { x: 50, y: 69, 'text-anchor': 'middle', class: 'g-sub' }, ['fit']),
  ]);
  let tween: gsap.core.Tween | null = null;
  const draw = (v: number) => {
    val.setAttribute('stroke-dasharray', `${((v / 100) * C).toFixed(1)} ${C.toFixed(1)}`);
    num.textContent = `${Math.round(v)}%`;
  };
  return {
    svg,
    set(v: number | null, animate = false) {
      tween?.kill();
      svg.classList.toggle('empty', v === null);
      if (v === null) {
        val.setAttribute('stroke-dasharray', `0 ${C.toFixed(1)}`);
        num.textContent = '–';
        svg.setAttribute('aria-label', 'Fit score: not compiled yet');
        return;
      }
      svg.setAttribute('aria-label', `Fit score: ${v}%`);
      if (!animate || reducedMotion()) { draw(v); return; }
      const o = { v: 0 };
      tween = gsap.to(o, { v, duration: 1.1, ease: 'power2.out', onUpdate: () => draw(o.v) });
    },
  };
}

/** The report as plain text, for an ATS note or an email. `max` trims the requirement list to fit. */
function summary(r: Report, link: string, max = Infinity) {
  const head = [
    `${PROFILE.name} · ${PROFILE.title}`,
    `Fit report${r.title ? ` for "${r.title}"` : ''}: ${r.fit}% · ${r.counts.match} matched · ${r.counts.near} adjacent · ${r.counts.miss} missing`,
    '',
  ];
  const rows = r.reqs.map((q) => `${ICON[q.status]} ${q.label}${q.priority === 'nice' ? ' (nice to have)' : ''}: ${proofLine(q)}`);
  const tail = ['', ...r.notes.map((n) => `${n.label}: ${n.text}`), '', `Full report: ${link}`];
  const all = [...head, ...rows, ...tail].join('\n');
  if (all.length <= max) return all;
  const keep: string[] = [];
  let len = [...head, ...tail].join('\n').length + 30;
  for (const row of rows) {
    if (len + row.length + 1 > max) break;
    keep.push(row);
    len += row.length + 1;
  }
  return [...head, ...keep, `… and ${rows.length - keep.length} more in the full report`, ...tail].join('\n');
}

function chips(where: Where[]) {
  return where.map((w) => {
    if (w === 'hub') return h('a', { class: 'svc-chip hub', href: '#/resume' }, ['skills list']);
    const svc = serviceById(w)!;
    return h('a', {
      class: 'svc-chip', href: svc.sealed ? '#/resume' : `#/s/${svc.id}`,
      style: `--c:${svc.hue.base};--ct:var(--label-${svc.hue.id})`,
    }, [svc.name, h('small', {}, [svc.client ?? svc.companyShort])]);
  });
}

export interface JdMode {
  /** The console that replaces the hero copy. */
  el: HTMLElement;
  /** The fit card beside the scene. */
  card: HTMLElement;
  /** The full report under the hero. */
  report: HTMLElement;
  /** The way in, under the hero buttons. */
  button: HTMLButtonElement;
  readonly active: boolean;
  enter(): void;
  exit(opts?: { quiet?: boolean }): void;
  /** A module was clicked: show only the requirements it covers. False when there is no report yet. */
  focus(id: Target): boolean;
  /** Open a shared link (#/fit/…): decode the JD and compile it. */
  openShared(code: string): Promise<void>;
}

/**
 * The JD compiler: paste a job description, and each requirement flies to the module that proves it.
 * The scene becomes the linker; the fit card and the full report are the output.
 */
export function jdMode(scene: OverviewScene, view: { enter(): void; exit(): void }): JdMode {
  const fx = scene.fx;
  let active = false;
  let gen = 0;
  let report: Report | null = null;
  let filter: Target | null = null;
  const timers = new Set<number>();
  const tweens = new Set<gsap.core.Tween>();
  const tally = new Map<Target, { hit: number; near: number }>();
  const arrived = new Set<number>();
  const rows: (HTMLElement | undefined)[] = [];

  // ---- Console --------------------------------------------------------------------------------
  const input = h('textarea', {
    class: 'jd-input', spellcheck: 'false', maxlength: MAX_CHARS, 'aria-label': 'Job description',
    placeholder: 'Paste the whole job description: title, responsibilities, requirements, nice-to-haves…',
  });
  const source = h('div', { class: 'jd-source', hidden: true, tabindex: 0, 'aria-label': 'The job description, each requirement marked' });
  const count = h('span', { class: 'jd-count' });
  const edit = h('button', { class: 'jd-link', type: 'button', hidden: true }, ['Edit']);
  const clear = h('button', { class: 'jd-link', type: 'button', hidden: true }, ['Clear']);
  const compileBtn = h('button', { class: 'btn btn-primary btn-sm jd-go', type: 'button' }, ['Compile', h('kbd', {}, ['Ctrl ↵'])]);
  const sampleBtns = SAMPLES.map((x) => {
    const b = h('button', { class: 'jd-sample', type: 'button' }, [x.label]);
    b.addEventListener('click', () => { load(x.text); void compile(true); });
    return b;
  });
  const log = h('ol', { class: 'jd-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Compiler output' });
  const status = h('span', { class: 'jd-status' }, ['ready']);
  const leave = h('button', { class: 'c-exit', type: 'button', 'aria-label': 'Exit the JD compiler (Esc)', title: 'Exit the JD compiler (Esc)' }, ['Exit ✕']);
  const heading = h('h2', { class: 'display-sm', tabindex: -1 }, ['Paste a job description. ', h('em', {}, ['See where I fit.'])]);

  const el = h('section', { class: 'jd-console', 'aria-label': 'JD compiler' }, [
    h('div', { class: 'c-top' }, [h('div', { class: 'eyebrow jd-eyebrow' }, [h('span', { class: 'jd-dot' }), 'jd compiler']), leave]),
    heading,
    h('p', { class: 'lede c-lede' }, [
      'Each requirement links to the project where I did it, and gaps are flagged, not hidden. ',
      'It runs in your browser; the text never leaves this page.',
    ]),
    h('div', { class: 'jd-editor' }, [input, source, h('div', { class: 'jd-bar' }, [count, h('span', { class: 'jd-bar-btns' }, [edit, clear])])]),
    h('div', { class: 'jd-row' }, [compileBtn, h('div', { class: 'jd-samples' }, [h('span', { class: 'dim' }, ['or try']), ...sampleBtns])]),
    h('div', { class: 'panel c-panel jd-build' }, [h('div', { class: 'panel-head' }, [h('span', {}, ['build · jd.txt']), status]), log]),
  ]);

  const button = h('button', { class: 'mode-cta jd-cta', type: 'button', 'aria-label': 'Compile your JD: paste a job description and see the fit' }, [
    h('span', { class: 'cc-icon', 'aria-hidden': 'true' }, [s('svg', { viewBox: '0 0 24 24' }, [s('path', { d: DOC })])]),
    h('span', { class: 'cc-text' }, [h('b', {}, ['Compile your JD']), h('small', {}, ['Paste a job description, see the fit'])]),
  ]);

  // ---- Fit card -------------------------------------------------------------------------------
  const ring = gauge('fc-gauge');
  const cardTitle = h('strong', { class: 'fc-title' });
  const cardSub = h('p', { class: 'fc-sub' });
  const cardState = h('span', { class: 'fc-state' });
  const filterBar = h('div', { class: 'fc-filter', hidden: true });
  const showAll = h('button', { class: 'jd-link', type: 'button' }, ['Show all']);
  const list = h('ol', { class: 'fc-list', 'aria-label': 'Requirements' });
  const hint = h('p', { class: 'fc-hint', hidden: true }, ['Click a module to see what it covers.']);
  const fullBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: true }, ['Full report ↓']);
  const shareBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', disabled: true }, ['Share link']);
  const card = h('aside', { class: 'fit-card panel', 'aria-label': 'Fit report summary' }, [
    h('div', { class: 'panel-head' }, [h('span', {}, ['fit report']), cardState]),
    h('div', { class: 'fc-top' }, [ring.svg, h('div', { class: 'fc-sum' }, [cardTitle, cardSub])]),
    filterBar,
    list,
    hint,
    h('div', { class: 'fc-actions' }, [fullBtn, shareBtn]),
  ]);

  // ---- Full report ----------------------------------------------------------------------------
  const bigRing = gauge('fr-gauge');
  const frTitle = h('h2', { class: 'display-sm', id: 'fr-title', tabindex: -1 });
  const frSum = h('p', { class: 'fr-sum' });
  const frGroups = h('div', { class: 'fr-groups' });
  const frNotes = h('dl', { class: 'fr-notes' });
  const copyBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, ['Copy summary']);
  const mailBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, [`Email ${PROFILE.name.split(' ')[0]}`]);
  const pdfBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, ['Save as PDF']);
  const shareBtn2 = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, ['Share link']);
  const reportEl = h('section', { class: 'fit-report panel', id: 'fit-report', hidden: true, 'aria-labelledby': 'fr-title' }, [
    h('header', { class: 'fr-head' }, [
      h('div', { class: 'fr-head-text' }, [h('p', { class: 'eyebrow' }, ['fit report · compiled in your browser']), frTitle, frSum]),
      bigRing.svg,
    ]),
    h('div', { class: 'fr-actions no-print' }, [shareBtn2, copyBtn, mailBtn, pdfBtn]),
    h('div', { class: 'fr-body' }, [frGroups, h('aside', { class: 'fr-side' }, [h('h3', {}, ['Logistics']), frNotes])]),
    h('p', { class: 'fr-how' }, [
      `How it works: a rules-based compiler that runs in your browser. It knows ${SYMBOLS.length} skills and their aliases, `,
      'reads section headings, “nice to have” and “A or B”, and links each requirement to the career data on this site. ',
      'Adjacent experience earns partial credit; skills it does not know are left out of the score. No AI model, and nothing is uploaded. ',
      h('a', { href: '#/decisions/jd', class: 'no-print' }, ['See every stage of this compile →']),
    ]),
  ]);

  const flyLayer = h('div', { class: 'jd-fly', 'aria-hidden': 'true' });

  // ---- Helpers --------------------------------------------------------------------------------
  const sleep = (ms: number, g: number) => new Promise<boolean>((done) => {
    const id = window.setTimeout(() => { timers.delete(id); done(g === gen && active); }, ms);
    timers.add(id);
  });

  function cancel() {
    gen++;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const t of tweens) t.kill();
    tweens.clear();
    flyLayer.replaceChildren();
  }

  function resetScene() {
    fx.reset();
    scene.coverage(null);
    scene.highlight(null);
    tally.clear();
    arrived.clear();
  }

  function line(kind: string, a: string, b = '', c = '') {
    log.append(h('li', { class: `jl ${kind}` }, [h('span', { class: 'jl-a' }, [a]), h('span', { class: 'jl-b' }, [b]), c ? h('span', { class: 'jl-c' }, [c]) : null]));
    while (log.children.length > 120) log.firstElementChild!.remove();
    log.scrollTo({ top: log.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function say(btn: HTMLButtonElement, msg: string) {
    const was = btn.dataset.label ?? btn.textContent ?? '';
    btn.dataset.label = was;
    btn.textContent = msg;
    window.setTimeout(() => { btn.textContent = was; }, 2200);
  }

  function updateCount() {
    const t = input.value.trim();
    const w = t ? t.split(/\s+/).length : 0;
    count.textContent = w ? `${fmt(w)} words` : 'empty';
    clear.hidden = !input.value;
  }

  function load(text: string) {
    input.value = text.slice(0, MAX_CHARS);
    showEditor();
    updateCount();
  }

  function showEditor() {
    source.hidden = true;
    input.hidden = false;
    edit.hidden = true;
  }

  function renderSource(r: Report) {
    const frag = document.createDocumentFragment();
    let at = 0;
    for (const sp of r.spans) {
      if (sp.start < at) continue;
      if (sp.start > at) frag.append(r.text.slice(at, sp.start));
      const q = r.reqs[sp.req];
      const { c, ct } = hueOf(q);
      frag.append(h('mark', { class: `tok ${q.status}`, 'data-req': sp.req, style: `--c:${c};--ct:${ct}`, title: `${WORD[q.status]}: ${q.label}` }, [r.text.slice(sp.start, sp.end)]));
      at = sp.end;
    }
    frag.append(r.text.slice(at));
    source.replaceChildren(frag);
    input.hidden = true;
    source.hidden = false;
    edit.hidden = false;
    source.scrollTop = 0;
  }

  /** Hovering a requirement (in the text or the card) lights the modules that prove it. */
  function hoverReq(i: number | null) {
    const q = i === null || !report ? null : report.reqs[i] ?? null;
    if (q) scene.highlight(modulesOf(q));
    else scene.highlight(filter && filter !== 'hub' ? filter : null);
    for (const m of source.querySelectorAll('mark.on')) m.classList.remove('on');
    for (const r of list.querySelectorAll('.fc-row.on')) r.classList.remove('on');
    if (i === null) return;
    for (const m of source.querySelectorAll(`mark[data-req="${i}"]`)) m.classList.add('on');
    rows[i]?.classList.add('on');
  }
  source.addEventListener('mouseover', (e) => {
    const m = (e.target as Element).closest('mark');
    hoverReq(m ? Number(m.getAttribute('data-req')) : null);
  });
  source.addEventListener('mouseleave', () => hoverReq(null));

  // ---- Fit card -------------------------------------------------------------------------------
  function cardIdle(title: string, sub: string) {
    ring.set(null);
    cardTitle.textContent = title;
    cardSub.textContent = sub;
    cardState.textContent = 'idle';
    list.replaceChildren(h('li', { class: 'fc-empty' }, ['Requirements link here as they compile.']));
    rows.length = 0;
    filter = null;
    filterBar.hidden = true;
    hint.hidden = true;
    fullBtn.disabled = shareBtn.disabled = true;
  }

  function cardRow(q: Req, i: number) {
    const tag = q.status === 'miss' ? 'gap' : q.priority === 'nice' ? 'nice' : null;
    const li = h('li', { class: `fc-row ${q.status}`, 'data-req': i, title: proofLine(q) }, [
      h('span', { class: 'fc-ic' }, [ICON[q.status], h('span', { class: 'sr-only' }, [` ${WORD[q.status]}: `])]),
      h('span', { class: 'fc-name' }, [q.label]),
      tag ? h('span', { class: 'fc-tag' }, [tag]) : null,
      h('span', { class: 'fc-dots', 'aria-hidden': 'true' }, q.where.map((w) => h('i', w === 'hub' ? { class: 'hub' } : { style: `--c:${serviceById(w)!.hue.base}` }))),
    ]);
    li.addEventListener('mouseenter', () => hoverReq(i));
    li.addEventListener('mouseleave', () => hoverReq(null));
    return li;
  }

  /** Rows arrive in reading order but sit in report order: must-haves first. */
  function place(i: number, row: HTMLElement) {
    rows[i] = row;
    list.querySelector('.fc-empty')?.remove();
    const next = rows.slice(i + 1).find(Boolean);
    if (next) list.insertBefore(row, next); else list.append(row);
    if (filter) row.hidden = !report!.reqs[i].where.includes(filter);
  }

  function applyFilter() {
    if (!report) return;
    let hits = 0;
    let near = 0;
    rows.forEach((row, i) => {
      if (!row) return;
      const q = report!.reqs[i];
      const on = !filter || q.where.includes(filter);
      row.hidden = !on;
      if (on && filter) { if (q.status === 'match') hits++; else near++; }
    });
    filterBar.hidden = !filter;
    if (filter) {
      filterBar.replaceChildren(
        h('span', {}, [h('b', {}, [filter]), ` covers ${hits} of ${report.reqs.length}${near ? ` · ${near} adjacent` : ''}`]),
        showAll,
      );
    }
    scene.highlight(filter && filter !== 'hub' ? filter : null);
  }
  showAll.addEventListener('click', () => { filter = null; applyFilter(); });

  // ---- The scene as linker --------------------------------------------------------------------
  function bump(t: Where, q: Req) {
    if (t === 'hub') return;
    const c = tally.get(t) ?? { hit: 0, near: 0 };
    if (q.status === 'match') c.hit++;
    else if (q.status === 'near') c.near++;
    tally.set(t, c);
    if (c.hit) fx.badge(t, `✓ ${c.hit} ${c.hit === 1 ? 'MATCH' : 'MATCHES'}`, 'green');
    else if (c.near) fx.badge(t, `~ ${c.near} ADJACENT`, 'amber');
  }

  function coverageOf(r: Report) {
    const m = new Map<Target, 'hit' | 'near' | 'miss'>(SERVICES.map((x) => [x.id, 'miss']));
    for (const q of r.reqs) {
      for (const w of modulesOf(q)) {
        if (q.status === 'match') m.set(w, 'hit');
        else if (q.status === 'near' && m.get(w) !== 'hit') m.set(w, 'near');
      }
    }
    return m;
  }

  function arrive(q: Req, i: number, quiet = false) {
    if (arrived.has(i)) return;
    arrived.add(i);
    for (const w of q.where) {
      bump(w, q);
      if (!quiet) scene.pulse(w);
    }
    place(i, cardRow(q, i));
    line(q.status, ICON[q.status], q.label, whereText(q));
  }

  const onScreen = (p: P) => p.x > -40 && p.x < innerWidth + 40 && p.y > -40 && p.y < innerHeight + 40;

  /** Where a requirement leaves the text: its first mark, kept inside the visible part of the text box. */
  function markPoint(i: number): P {
    const box = source.getBoundingClientRect();
    const mark = source.querySelector<HTMLElement>(`mark[data-req="${i}"]`);
    if (!mark || source.hidden) return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const want = Math.max(0, Math.min(mark.offsetTop - source.clientHeight * 0.35, source.scrollHeight - source.clientHeight));
    if (Math.abs(source.scrollTop - want) > source.clientHeight * 0.3) source.scrollTo({ top: want, behavior: 'smooth' });
    const top = Math.abs(source.scrollTop - want) > source.clientHeight * 0.3 ? want : source.scrollTop;
    mark.classList.add('lit');
    const x = box.left + mark.offsetLeft + mark.offsetWidth / 2;
    const y = box.top + mark.offsetTop - top + mark.offsetHeight / 2;
    return { x: Math.max(box.left + 12, Math.min(box.right - 12, x)), y: Math.max(box.top + 8, Math.min(box.bottom - 8, y)) };
  }

  function fly(from: P, target: Target, q: Req, word: string, done: () => void) {
    const reject = q.status === 'miss';
    const end = () => {
      const p = scene.anchor(target);
      if (!p) return null;
      // A requirement nothing proves stops short of the hub and is rejected there.
      return reject ? { x: from.x + (p.x - from.x) * 0.72, y: from.y + (p.y - from.y) * 0.72 } : p;
    };
    const first = end();
    if (!first || !onScreen(first)) { done(); return; }
    if (!flyLayer.isConnected) document.body.append(flyLayer);
    const { c, ct } = hueOf(q);
    const text = word.length > 24 ? `${word.slice(0, 23)}…` : word;
    const chip = h('span', { class: `jd-chip ${q.status}`, style: `--c:${c};--ct:${ct}` }, [text]);
    flyLayer.append(chip);
    const o = { t: 0 };
    const tw = gsap.to(o, {
      t: 1, duration: reject ? 0.7 : 0.85, ease: 'power1.inOut',
      onUpdate() {
        const to = end() ?? first;  // the page may scroll mid-flight; follow the module
        const lift = 60 + Math.abs(to.x - from.x) * 0.12;
        const mx = (from.x + to.x) / 2, my = Math.min(from.y, to.y) - lift;
        const t = o.t, u = 1 - t;
        const x = u * u * from.x + 2 * u * t * mx + t * t * to.x;
        const y = u * u * from.y + 2 * u * t * my + t * t * to.y;
        chip.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${(1 - (reject ? 0.1 : 0.4) * t).toFixed(3)})`;
        if (!reject) chip.style.opacity = t > 0.82 ? ((1 - t) / 0.18).toFixed(2) : '1';
      },
      onComplete() {
        tweens.delete(tw);
        if (reject) {
          chip.classList.add('rejected');
          const id = window.setTimeout(() => { timers.delete(id); chip.remove(); }, 520);
          timers.add(id);
        } else chip.remove();
        done();
      },
    });
    tweens.add(tw);
  }

  function launch(q: Req, i: number, g: number, onArrive: () => void) {
    const from = markPoint(i);
    // The chip carries the JD's own word ("event-driven"), the way a token leaves the source.
    const word = source.querySelector(`mark[data-req="${i}"]`)?.textContent?.replace(/\s+/g, ' ').trim() || q.label;
    const targets: Target[] = q.status === 'miss' ? ['hub'] : q.where.slice(0, 3);
    let left = targets.length;
    const one = () => { if (--left === 0) onArrive(); };
    targets.forEach((t, k) => {
      if (!k) { fly(from, t, q, word, one); return; }
      void sleep(k * 80, g).then((ok) => { if (ok) fly(from, t, q, word, one); });
    });
  }

  // ---- Compile --------------------------------------------------------------------------------
  async function compile(animate: boolean) {
    if (!active) return;
    if (!input.value.trim()) {
      status.textContent = 'nothing to compile';
      status.className = 'jd-status bad';
      showEditor();
      input.focus();
      return;
    }
    cancel();
    const g = gen;
    resetScene();
    const r = compileJd(input.value);
    setLastJd(input.value);
    report = r;
    filter = null;
    filterBar.hidden = true;
    rows.length = 0;
    list.replaceChildren();
    renderSource(r);
    log.replaceChildren();
    reportEl.hidden = true;
    line('cmd', '$', 'career-core compile jd.txt');

    if (r.reqs.length < 3) {
      line('err', 'error', `${r.reqs.length} requirement${r.reqs.length === 1 ? '' : 's'} found`, 'paste the full description, including its requirements');
      status.textContent = 'failed';
      status.className = 'jd-status bad';
      cardIdle('Not enough to go on', `Found ${r.reqs.length} recognisable requirement${r.reqs.length === 1 ? '' : 's'}. Paste the whole job description.`);
      report = null;
      return;
    }

    status.textContent = 'compiling…';
    status.className = 'jd-status run';
    ring.set(null);
    cardTitle.textContent = r.title ?? 'Your job description';
    cardSub.textContent = `${r.reqs.length} requirements · linking…`;
    cardState.textContent = 'compiling';
    fullBtn.disabled = shareBtn.disabled = true;

    const per = { must: 0, role: 0, nice: 0 };
    for (const q of r.reqs) per[q.priority]++;
    const lex = () => line('phase', 'lex', `${fmt(r.text.length)} chars · ${fmt(r.words)} words`, `${r.mentions} skill mentions`);
    const parse = () => line('phase', 'parse', `${r.sections} section${r.sections === 1 ? '' : 's'} · ${r.reqs.length} requirements`, `${per.must} must · ${per.role} role · ${per.nice} nice`);
    const link = () => line('phase', 'link', `against ${SERVICES.length} modules and the skills list`);

    if (!animate || reducedMotion()) {
      lex(); parse(); link();
      r.reqs.forEach((q, i) => arrive(q, i, true));
      finish(r, false);
      return;
    }

    // On narrow screens the scene sits under the console: bring it into view first.
    const sr = scene.svg.getBoundingClientRect();
    if (sr.top > innerHeight * 0.55 || sr.bottom < innerHeight * 0.3) scene.svg.scrollIntoView({ block: 'center', behavior: 'smooth' });

    lex();
    if (!(await sleep(280, g))) return;
    parse();
    if (!(await sleep(280, g))) return;
    link();
    fx.badge('hub', 'LINKING', 'cyan');

    const n = r.reqs.length;
    const order = r.reqs.map((q, i) => ({ q, i })).sort((a, b) => a.q.at - b.q.at);
    const gap = Math.max(90, Math.min(230, 3600 / n));
    let done = 0;
    for (const { q, i } of order) {
      launch(q, i, g, () => {
        if (g !== gen) return;
        arrive(q, i);
        done++;
        fx.badge('hub', `LINKING ${done}/${n}`, 'cyan');
      });
      if (!(await sleep(gap, g))) return;
    }
    if (!(await sleep(950, g))) return;
    r.reqs.forEach((q, i) => arrive(q, i, true));
    finish(r, true);
  }

  function finish(r: Report, animated: boolean) {
    line('phase', 'emit', `fit ${r.fit}% · ${r.counts.match} matched · ${r.counts.near} adjacent · ${r.counts.miss} missing`, `compiled in ${r.ms < 1 ? r.ms.toFixed(2) : r.ms.toFixed(1)} ms`);
    status.textContent = `fit ${r.fit}%`;
    status.className = 'jd-status good';
    fx.badge('hub', `FIT ${r.fit}%`, 'cyan');
    scene.coverage(coverageOf(r));
    ring.set(r.fit, animated);
    cardTitle.textContent = r.title ?? 'Your job description';
    cardSub.textContent = `${r.counts.match} matched · ${r.counts.near} adjacent · ${r.counts.miss} missing${r.cap ? ' · capped: core stack missing' : ''}`;
    cardState.textContent = 'compiled';
    hint.hidden = false;
    fullBtn.disabled = shareBtn.disabled = false;
    renderReport(r, animated);
  }

  function renderReport(r: Report, animated: boolean) {
    const must = r.reqs.filter((q) => q.priority === 'must');
    const xp = experience();
    frTitle.textContent = r.title ?? 'Your job description';
    frSum.textContent =
      `${r.fit}% fit${r.cap ? ` (capped: the core stack in the title is not on the résumé)` : ''}. ` +
      `${must.filter((q) => q.status === 'match').length} of ${must.length} must-haves matched; ` +
      `${r.counts.near} adjacent, ${r.counts.miss} missing across ${r.reqs.length} requirements. ` +
      `${xp.label} of experience, most recently Team Lead at Accenture.`;
    bigRing.set(r.fit, animated);
    frGroups.replaceChildren(...(['must', 'role', 'nice'] as Priority[]).flatMap((p) => {
      const qs = r.reqs.map((q, i) => ({ q, i })).filter(({ q }) => q.priority === p);
      if (!qs.length) return [];
      return [h('section', { class: 'fr-group' }, [
        h('h3', {}, [GROUP[p], h('span', { class: 'dim' }, [` · ${qs.length}`])]),
        h('ul', { class: 'fr-rows' }, qs.map(({ q, i }) => {
          const tag = q.status === 'miss' ? 'gap' : q.status === 'near' ? 'adjacent' : q.listed ? 'skills list' : null;
          return h('li', { class: `fr-row ${q.status}`, 'data-req': i }, [
            h('span', { class: 'fr-ic', 'aria-hidden': 'true' }, [ICON[q.status]]),
            h('div', { class: 'fr-req' }, [
              h('strong', {}, [h('span', { class: 'sr-only' }, [`${WORD[q.status]}: `]), q.label]),
              tag ? h('span', { class: `fr-tag ${q.status}` }, [tag]) : null,
              q.quote ? h('q', { class: 'fr-quote' }, [q.quote]) : null,
            ]),
            h('div', { class: 'fr-proof' }, [
              h('p', {}, [proofLine(q)]),
              q.status !== 'miss' && q.where.length ? h('div', { class: 'fr-svcs' }, chips(q.where)) : null,
            ]),
          ]);
        })),
      ])];
    }));
    frNotes.replaceChildren(...r.notes.flatMap((n) => [
      h('dt', { class: n.tone }, [n.label]),
      h('dd', { class: n.tone }, [n.text]),
    ]));
    reportEl.hidden = false;
  }

  // ---- Sharing and output ---------------------------------------------------------------------
  const base = () => `${location.origin}${location.pathname}`;

  async function share(btn: HTMLButtonElement) {
    if (!report) return;
    const code = await encodeJd(report.text);
    const tooLong = code.length > 6000;
    const url = tooLong ? `${base()}#/jd` : `${base()}#/fit/${code}`;
    const text = `${PROFILE.name} scores ${report.fit}% against ${report.title ? `“${report.title}”` : 'this job description'}: ` +
      `${report.counts.match} matched, ${report.counts.near} adjacent, ${report.counts.miss} missing.`;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'Fit report', text, url }); return; }
      await navigator.clipboard.writeText(url);
      say(btn, tooLong ? 'JD too long for a link · copied #/jd' : 'Link copied');
    } catch {
      say(btn, 'Copy blocked by the browser');
    }
  }
  shareBtn.addEventListener('click', () => void share(shareBtn));
  shareBtn2.addEventListener('click', () => void share(shareBtn2));
  fullBtn.addEventListener('click', () => {
    reportEl.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    frTitle.focus({ preventScroll: true });
  });
  copyBtn.addEventListener('click', async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(summary(report, `${base()}#/jd`));
      say(copyBtn, 'Copied');
    } catch {
      say(copyBtn, 'Copy blocked by the browser');
    }
  });
  mailBtn.addEventListener('click', () => {
    if (!report) return;
    const subject = `${report.title ?? 'A role'} · fit report ${report.fit}%`;
    const body = `Hi ${PROFILE.name.split(' ')[0]},\n\nI ran our job description through your JD compiler.\n\n${summary(report, `${base()}#/jd`, 900)}\n`;
    window.location.href = `mailto:${emailAddress()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  pdfBtn.addEventListener('click', () => {
    // Print the report alone, in the light theme, whatever theme is on screen.
    const root = document.documentElement;
    const theme = root.dataset.theme;
    root.classList.add('print-fit');
    root.dataset.theme = 'light';
    const done = () => {
      root.classList.remove('print-fit');
      if (theme) root.dataset.theme = theme;
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  });

  // ---- Input ----------------------------------------------------------------------------------
  input.addEventListener('input', () => {
    updateCount();
    if (report) { status.textContent = 'edited · compile again'; status.className = 'jd-status'; }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void compile(true); }
  });
  // Pasting a whole JD compiles it straight away.
  input.addEventListener('paste', () => {
    const was = input.value.length;
    window.setTimeout(() => { if (input.value.length - was > 200) void compile(true); }, 40);
  });
  compileBtn.addEventListener('click', () => void compile(true));
  edit.addEventListener('click', () => { showEditor(); input.focus(); });
  clear.addEventListener('click', () => {
    cancel();
    resetScene();
    input.value = '';
    report = null;
    showEditor();
    updateCount();
    log.replaceChildren();
    line('info', '›', 'cleared · paste a job description to compile');
    status.textContent = 'ready';
    status.className = 'jd-status';
    reportEl.hidden = true;
    cardIdle('Waiting for a job description', 'Paste one on the left, or try a sample.');
    input.focus();
  });

  // ---- Mode -----------------------------------------------------------------------------------
  function enter() {
    if (active) return;
    active = true;
    view.enter();
    scene.setJd(true);
    // A JD edited on the decisions page's stage view carries over.
    if (lastJd() && lastJd() !== input.value) { load(lastJd()); report = null; void compile(true); heading.focus({ preventScroll: true }); return; }
    updateCount();
    if (report && input.value.trim()) {
      void compile(false);  // coming back: show the last report at once
    } else {
      log.replaceChildren();
      line('info', '›', 'ready · paste a job description, or try a sample');
      status.textContent = 'ready';
      status.className = 'jd-status';
      cardIdle('Waiting for a job description', 'Paste one on the left, or try a sample.');
      showEditor();
    }
    heading.focus({ preventScroll: true });
  }

  function exit(opts: { quiet?: boolean } = {}) {
    if (!active) return;
    active = false;
    cancel();
    resetScene();
    scene.setJd(false);
    view.exit();
    reportEl.hidden = true;
    if (!opts.quiet) {
      button.focus({ preventScroll: true });
      if (/^#\/(?:jd|fit\/)/.test(location.hash)) history.replaceState(null, '', `${location.pathname}#/`);
    }
  }

  function focus(id: Target) {
    if (!active || !report) return false;
    filter = id === 'hub' || filter === id ? null : id;
    applyFilter();
    return true;
  }

  async function openShared(code: string) {
    const text = await decodeJd(code);
    enter();
    if (text === null) {
      log.replaceChildren();
      line('err', 'error', 'this shared link is damaged', 'paste the job description instead');
      return;
    }
    load(text);
    void compile(true);
  }

  leave.addEventListener('click', () => exit());
  button.addEventListener('click', enter);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !active) return;
    if (document.activeElement === input) { input.blur(); return; }
    exit();
  });
  cardIdle('Waiting for a job description', 'Paste one on the left, or try a sample.');
  updateCount();

  return { el, card, report: reportEl, button, get active() { return active; }, enter, exit, focus, openShared };
}
