import { h, reducedMotion } from '../util/dom';
import { SERVICES, CAREER_LOG, type LogRecord } from '../data/career';
import type { OverviewScene } from '../scene/overview';
import { labelOf } from '../scene/shapes';

/**
 * The career as one Kafka partition, drawn the way Kafka actually works.
 *
 * - The partition `career.events / 0` is an append-only log of offsets 0–13, replicated on three
 *   brokers: b1 leads, b2 and b3 follow.
 * - With acks=all a record is appended on the leader, then fetched by each follower. The high
 *   watermark (HW) moves past it only once every in-sync replica has it, and consumers can read no
 *   further than the HW.
 * - The consumer group career-core trails behind with its committed offset. HW minus committed is
 *   the lag. The consumer reads each record as the scene's particles reach the hub, so the lag is real.
 * - On disk the log rolls into segment files named after their first offset, padded to 20 digits.
 * - Below the lanes, a console consumer prints each record as it is consumed.
 *
 * The log starts on its own a few seconds after the page opens, or when the panel scrolls into view,
 * and loops with a pause between runs. "Show all" stops the loop. Every moving part is a transform or
 * opacity change, and the blinking write head pauses off screen.
 */
const STEP_MS = 1500;
/** The log starts on its own this long after the home page opens, and replays this long after it ends. */
export const AUTOSTART_MS = 5000;
const LOOP_GAP_MS = 10_000;
/** Each follower fetches the new record after this delay; the HW moves once the slowest has it. */
const FETCH_MS = [380, 640];
/** career-core reads the record when the scene's particles reach the hub. */
const CONSUME_MS = 2200;
/** Records per log segment: a deliberately tiny segment size, so the rolls show. */
const SEGMENT = 5;
const BROKERS = ['b1', 'b2', 'b3'];
const N = CAREER_LOG.length;
const COMMAND = 'kafka-console-consumer --topic career.events --group career-core --from-beginning --property print.offset=true --property print.key=true';

const keyOf = (r: LogRecord) => (r.svc === 'hub' ? 'career-core' : r.svc);
const fillOf = (r: LogRecord) => SERVICES.find((x) => x.id === r.svc)?.hue.base ?? 'var(--cyan)';
const inkOf = (r: LogRecord) => {
  const svc = SERVICES.find((x) => x.id === r.svc);
  return svc ? labelOf(svc.hue.id) : 'var(--cyan)';
};
const segmentName = (base: number) => String(base).padStart(20, '0') + '.log';

export function kafkaLog(scene: OverviewScene) {
  const counter = h('span', { class: 'k-count' });
  const button = h('button', { class: 'k-btn', type: 'button' });

  // Replica lanes. The leader's slots are buttons: pick one to read that record in the console.
  const lanes = BROKERS.map((_, i) => CAREER_LOG.map((r, o) => i === 0
    ? h('button', {
      class: 'k-cell', type: 'button', disabled: true, style: `--c:${fillOf(r)}`,
      'aria-label': `Offset ${o}, key ${keyOf(r)}, ${r.when}: ${r.text}`,
    })
    : h('span', { class: 'k-cell', style: `--c:${fillOf(r)}` })));
  const hw = h('span', { class: 'k-hw', 'aria-hidden': 'true' });
  const leo = h('span', { class: 'k-leo', 'aria-hidden': 'true' });
  const commit = h('span', { class: 'k-commit', 'aria-hidden': 'true' });
  const segments = Array.from({ length: Math.ceil(N / SEGMENT) }, (_, k) => {
    const base = k * SEGMENT;
    const count = Math.min(SEGMENT, N - base);
    return h('span', { class: 'k-seg', style: `--s:${base};--n:${count}`, title: segmentName(base) }, [`…${segmentName(base).slice(-8)}`]);
  });
  const numbers = h('span', { class: 'k-stat' });

  const viz = h('div', { class: 'k-viz' }, [
    ...BROKERS.map((b, i) => h('span', { class: `k-label${i === 0 ? ' lead' : ''}` }, [b, h('i', {}, [i === 0 ? 'leader' : 'follower'])])),
    h('span', { class: 'k-label dim' }, ['offset']),
    h('span', { class: 'k-label dim' }, ['segment']),
    h('span', { class: 'k-label dim' }, ['consumer']),
    h('div', { class: 'k-lanes' }, [
      ...lanes.map((cells, i) => h('div', { class: `k-lane${i === 0 ? ' lead' : ''}` }, cells)),
      h('div', { class: 'k-offsets', 'aria-hidden': 'true' }, CAREER_LOG.map((_, o) => h('span', {}, [String(o)]))),
      h('div', { class: 'k-segs', 'aria-hidden': 'true' }, segments),
      h('div', { class: 'k-cons', 'aria-hidden': 'true' }, [commit]),
      hw, leo,
    ]),
  ]);

  const out = h('ol', { class: 'k-out', 'aria-label': 'Career log, oldest first' });
  const lines: HTMLElement[] = [];
  const el = h('section', { class: 'kafka hud', 'aria-label': 'Career log as a Kafka partition' }, [
    h('div', { class: 'k-inner hud-inner' }, [
      h('div', { class: 'k-head' }, [
        h('span', { class: 'hud-tag' }, ['kafka']),
        h('span', { class: 'k-path' }, ['career.events / partition 0']),
        h('span', { class: 'k-ctl' }, [counter, button]),
      ]),
      viz,
      h('div', { class: 'k-legend' }, [numbers, h('span', { class: 'k-conf' }, ['RF 3 · ISR 3/3 · acks=all'])]),
      h('div', { class: 'k-console' }, [
        h('div', { class: 'k-cmd', title: COMMAND }, [h('b', {}, ['$ ']), COMMAND]),
        out,
      ]),
      h('span', { class: 'hud-corner tr', 'aria-hidden': 'true' }),
      h('span', { class: 'hud-corner bl', 'aria-hidden': 'true' }),
    ]),
  ]);

  // Partition state.
  let produced = 0;                          // log end offset on the leader
  const replicated = BROKERS.map(() => 0);   // each replica's log end offset
  let high = 0;                              // high watermark
  let committed = 0;                         // career-core's committed offset (the next one it reads)
  let pending: number[] = [];

  const line = (o: number) => {
    const r = CAREER_LOG[o];
    return h('li', { class: 'k-line', style: `--c:${inkOf(r)}`, 'data-offset': String(o) }, [
      h('span', { class: 'k-off' }, [String(o)]),
      h('span', { class: 'k-key' }, [keyOf(r)]),
      h('span', { class: 'k-when' }, [r.when]),
      h('span', { class: 'k-val' }, [r.text]),
    ]);
  };
  const scrollOut = (to: HTMLElement | null) => {
    if (!to) return;
    const smooth = !reducedMotion() && !el.classList.contains('paused');
    out.scrollTo({ top: to.offsetTop - out.clientHeight + to.offsetHeight + 4, behavior: smooth ? 'smooth' : 'auto' });
  };

  const draw = () => {
    lanes.forEach((cells, b) => cells.forEach((c, o) => {
      c.classList.toggle('on', o < replicated[b]);
      if (b === 0) (c as HTMLButtonElement).disabled = o >= committed;
    }));
    viz.style.setProperty('--hw', String(high));
    viz.style.setProperty('--leo', String(produced));
    viz.style.setProperty('--co', String(committed));
    const active = Math.min(Math.floor(Math.max(produced - 1, 0) / SEGMENT), segments.length - 1);
    segments.forEach((sg, k) => sg.classList.toggle('active', produced > 0 && k === active));
    numbers.textContent = `LEO ${produced} · HW ${high} · committed ${committed} · lag ${high - committed}`;
  };

  const consume = () => {
    const o = committed;
    if (o >= high) return;
    const li = line(o);
    lines[o] = li;
    out.append(li);
    committed++;
    scrollOut(li);
    draw();
    sync();
  };
  // Leaving the page mid-record: finish what is in flight at once, so the partition is consistent.
  const settle = () => {
    replicated.fill(produced);
    high = produced;
    while (committed < high) { const li = line(committed); lines[committed] = li; out.append(li); committed++; }
    out.scrollTop = out.scrollHeight;
    draw();
  };

  // One record through the partition: append on the leader, followers fetch, HW moves, career-core reads.
  const produce = () => {
    const o = produced;
    produced++;
    replicated[0] = produced;
    draw();
    FETCH_MS.forEach((ms, i) => pending.push(window.setTimeout(() => {
      replicated[i + 1] = Math.max(replicated[i + 1], o + 1);
      high = Math.min(...replicated);
      draw();
    }, ms)));
    pending.push(window.setTimeout(consume, CONSUME_MS));
  };

  // Player.
  let timer = 0;
  let wanted = false;    // the overview is the current view
  let started = false;   // the panel has been on screen, or the page has been open AUTOSTART_MS
  let looping = true;    // after the last record, start again; "Show all" turns this off
  let autostart = 0;
  let restart = 0;
  const done = () => committed >= N;

  const sync = () => {
    counter.textContent = !done() ? `${produced} / ${N}`
      : restart ? `again in ${LOOP_GAP_MS / 1000} s`
      : `${N} records`;
    button.textContent = produced >= N ? 'Replay' : 'Show all';
    out.setAttribute('aria-busy', String(!done() && produced > 0));
    scene.streaming(produced < N && timer !== 0);
  };

  const step = () => {
    const r = CAREER_LOG[produced];
    scene.emit(r.svc);
    produce();
    if (produced >= N) { stop(); queueRestart(); }
    sync();
  };

  const stop = () => { clearInterval(timer); timer = 0; };
  const halt = () => {
    stop();
    clearTimeout(autostart); clearTimeout(restart); autostart = restart = 0;
    pending.forEach(clearTimeout); pending = [];
  };
  // The log loops: LOOP_GAP_MS after the last record is written, it clears and plays again.
  const queueRestart = () => {
    clearTimeout(restart);
    restart = looping && wanted ? window.setTimeout(() => { restart = 0; replay(); }, LOOP_GAP_MS) : 0;
  };
  const play = () => {
    if (timer || !wanted || !started) return;
    if (reducedMotion()) { showAll(); return; }
    if (produced >= N) { if (!restart) queueRestart(); sync(); return; }
    if (produced === 0) step();
    timer = window.setInterval(step, STEP_MS);
    sync();
  };
  const showAll = () => {
    halt();
    looping = false;
    produced = N;
    replicated.fill(N);
    high = N;
    while (committed < N) { const li = line(committed); lines[committed] = li; out.append(li); committed++; }
    out.scrollTop = out.scrollHeight;
    draw();
    sync();
  };
  const reset = () => {
    produced = 0; replicated.fill(0); high = 0; committed = 0;
    lines.length = 0;
    out.replaceChildren();
    out.scrollTop = 0;
    draw();
  };
  const replay = () => {
    halt();
    looping = true;
    started = true;
    reset();
    sync();
    play();
  };

  button.addEventListener('click', () => (produced >= N ? replay() : showAll()));
  lanes[0].forEach((c, o) => c.addEventListener('click', () => {
    lines.forEach((l) => l?.classList.remove('picked'));
    const li = lines[o];
    if (!li) return;
    li.classList.add('picked');
    scrollOut(li);
  }));
  new IntersectionObserver(([e]) => {
    el.classList.toggle('paused', !e.isIntersecting);
    if (e.isIntersecting && e.intersectionRatio >= 0.4) { started = true; play(); }
  }, { threshold: [0, 0.4] }).observe(el);
  draw();
  sync();

  return {
    el,
    resume() {
      wanted = true;
      // On most screens the hero fills the window and this panel is below it, so it starts on its own too.
      if (!started && !autostart) autostart = window.setTimeout(() => { autostart = 0; started = true; play(); }, AUTOSTART_MS);
      play();
    },
    pause() { wanted = false; halt(); settle(); sync(); },
  };
}
