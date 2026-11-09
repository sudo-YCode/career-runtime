import { h, s, reducedMotion } from '../util/dom';
import { SERVICES, HUB, PROFILE, serviceById } from '../data/career';
import type { OverviewScene } from '../scene/overview';
import type { Target } from '../scene/chaos';

type Level = 'crit' | 'warn' | 'info' | 'ok';

/** What each runtime does when it comes back. General engineering facts about the stack, nothing invented about employers. */
const BOOT: Record<Target, string> = {
  'fleet-tracker': 'JVM up in 1.6 s · JIT is cold, so the first requests run slower until C2 compiles the hot path',
  notify: 'Node process respawned in 0.4 s · KafkaJS consumer back in its group · Redis cache still warm',
  'edge-gateway': '8 event loops up (2 per CPU core) · verticles redeployed, each pinned to its own loop',
  migrator: 'JVM up · unfinished migrations re-queued · retries are idempotent, so no target builds twice',
  speech: 'model weights reloaded into memory · one warm-up inference before it takes traffic',
  'private-rnd': '',
  hub: 'career-core up · compiling the buffered records into the résumé',
};

/** While down: what protects the callers. */
const GUARD: Record<Target, string> = {
  'fleet-tracker': 'circuit breaker OPEN · tracking calls fail fast instead of piling up',
  notify: 'circuit breaker OPEN · notifications wait on Kafka, none are dropped',
  'edge-gateway': 'circuit breaker OPEN · callers get 503 + Retry-After instead of hanging',
  migrator: 'circuit breaker OPEN · migration requests stay queued on Kafka',
  speech: 'circuit breaker OPEN · audio clips stay queued on Kafka',
  'private-rnd': '',
  hub: 'résumé served from the last compiled snapshot · readers see no outage',
};

const topicOf = (id: Target) => (id === 'hub' ? 'all 6 topics' : serviceById(id)!.topic);
const nameOf = (id: Target) => (id === 'hub' ? HUB.name : id);
const colourOf = (id: Target) => (id === 'hub' ? 'var(--cyan)' : `var(--label-${serviceById(id)!.hue.id})`);

const BOLT = 'M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z';

export interface ChaosMode {
  el: HTMLElement;
  button: HTMLButtonElement;
  readonly active: boolean;
  enter(): void;
  exit(): void;
  kill(id: Target): void;
}

/**
 * "Break my career": the visitor kills services and watches the system heal itself.
 * Each incident runs the same playbook a production service would: health checks fail, a circuit
 * breaker opens, events wait on Kafka (consumer lag), the process restarts with exponential backoff,
 * the breaker half-opens and closes, and the consumer replays everything from its last committed offset.
 */
export function chaosMode(scene: OverviewScene, view: { enter(): void; exit(): void }): ChaosMode {
  const fx = scene.fx;
  let active = false;
  let gen = 0;                      // bumped on exit: running playbooks see the change and stop
  let t0 = 0;
  const timers = new Set<number>();
  const progress = new Map<Target, number>();
  const stats = { kills: 0, replayed: 0, heals: [] as number[] };

  // ---- Console --------------------------------------------------------------------------------
  const log = h('ol', { class: 'clog', role: 'log', 'aria-live': 'polite', 'aria-label': 'Incident log' });
  const status = h('span', { class: 'c-status' });
  const barFill = h('i');
  const barText = h('span', { class: 'c-bar-text' });
  const stat = (key: string, label: string, cls = '') => {
    const b = h('b', { 'data-k': key }, ['0']);
    return { b, el: h('div', { class: `c-stat ${cls}` }, [b, h('span', {}, [label])]) };
  };
  const sKills = stat('kills', 'services killed');
  const sReplayed = stat('replayed', 'events replayed');
  const sLost = stat('lost', 'events lost', 'ok');
  const sHeal = stat('heal', 'avg. time to heal');
  sHeal.b.textContent = '–';

  const monkey = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, ['Chaos monkey ×3']);
  const share = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', hidden: true }, ['Share result']);
  const leave = h('button', { class: 'c-exit', type: 'button', 'aria-label': 'Exit chaos mode (Esc)', title: 'Exit chaos mode (Esc)' }, ['Exit ✕']);
  const heading = h('h2', { class: 'display-sm', tabindex: -1 }, ['Break my career. ', h('em', {}, ['It heals itself.'])]);

  const el = h('section', { class: 'chaos-console', 'aria-label': 'Chaos mode' }, [
    h('div', { class: 'c-top' }, [h('div', { class: 'eyebrow c-eyebrow' }, [h('span', { class: 'c-dot' }), 'chaos mode']), leave]),
    heading,
    h('p', { class: 'lede c-lede' }, [
      'Click any service to kill it. Its events wait safely on Kafka, a circuit breaker protects its callers, ',
      'and it restarts with backoff and replays everything it missed.',
    ]),
    h('div', { class: 'c-stats' }, [sKills.el, sReplayed.el, sLost.el, sHeal.el]),
    h('div', { class: 'panel c-panel' }, [
      h('div', { class: 'panel-head' }, [h('span', {}, ['incidents']), status]),
      log,
      h('div', { class: 'c-bar' }, [h('span', { class: 'c-track' }, [barFill]), barText]),
    ]),
    h('div', { class: 'cta' }, [monkey, share]),
    h('p', { class: 'meta' }, ['Health checks · circuit breakers · exponential backoff · replay from the last committed offset']),
  ]);

  const button = h('button', { class: 'mode-cta chaos-cta', type: 'button', 'aria-label': 'Break my career: enter chaos mode' }, [
    h('span', { class: 'cc-icon', 'aria-hidden': 'true' }, [s('svg', { viewBox: '0 0 24 24' }, [s('path', { d: BOLT })])]),
    h('span', { class: 'cc-text' }, [h('b', {}, ['Break my career']), h('small', {}, ['Kill a service, watch it heal'])]),
  ]);

  // ---- Helpers --------------------------------------------------------------------------------
  const clock = () => {
    const t = (performance.now() - t0) / 1000;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  };

  function line(id: Target | null, level: Level, text: string) {
    const li = h('li', { class: `cl ${level}` }, [
      h('span', { class: 'cl-t' }, [clock()]),
      h('span', { class: 'cl-x' }, [
        h('b', { class: 'cl-svc', style: id ? `color:${colourOf(id)}` : '' }, [id ? nameOf(id) : 'chaos']),
        ' ',
        text,
      ]),
    ]);
    log.append(li);
    while (log.children.length > 80) log.firstElementChild!.remove();
    log.scrollTo({ top: log.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function sync() {
    const n = progress.size;
    status.textContent = n ? `${n} down · auto-recovering` : 'all services healthy';
    status.className = `c-status ${n ? 'bad' : 'good'}`;
    const p = n ? [...progress.values()].reduce((a, b) => a + b, 0) / n : 1;
    barFill.style.width = `${Math.round(p * 100)}%`;
    barFill.className = n ? 'run' : 'done';
    barText.textContent = n ? `auto-recovering · ${Math.round(p * 100)}%` : stats.kills ? 'recovered · 0 events lost' : 'waiting for chaos';
    sKills.b.textContent = String(stats.kills);
    sReplayed.b.textContent = stats.replayed.toLocaleString('en-US');
    sLost.b.textContent = '0';
    sHeal.b.textContent = stats.heals.length ? `${(stats.heals.reduce((a, b) => a + b, 0) / stats.heals.length).toFixed(1)} s` : '–';
    share.hidden = !stats.heals.length;
  }

  /** Waits, then says whether this playbook should keep going (chaos mode was not exited meanwhile). */
  const sleep = (ms: number, g: number) => new Promise<boolean>((done) => {
    const id = window.setTimeout(() => { timers.delete(id); done(g === gen && active); }, ms);
    timers.add(id);
  });
  const every = (ms: number, fn: () => void) => {
    const id = window.setInterval(fn, ms);
    timers.add(id);
    return () => { clearInterval(id); timers.delete(id); };
  };

  // ---- The playbook ---------------------------------------------------------------------------
  async function incident(id: Target) {
    const g = gen;
    const started = performance.now();
    const isHub = id === 'hub';
    const name = nameOf(id);
    stats.kills++;
    const failsFirst = stats.kills === 1 || Math.random() < 0.45;
    let lag = 0;
    const set = (p: number) => { progress.set(id, p); sync(); };

    fx.state(id, 'down');
    fx.sparks(id);
    fx.badge(id, 'KILLED', 'red');
    if (!isHub) fx.breaker(id, 'open');
    set(0.05);
    line(id, 'crit', `SIGKILL · ${name} is down`);
    const stopLag = every(isHub ? 140 : 230, () => { lag++; fx.queue(id, lag); });

    if (!(await sleep(550, g))) return;
    line(id, 'warn', 'liveness probe failed 3× · marked not ready, traffic routed away');
    if (!(await sleep(450, g))) return;
    line(id, isHub ? 'ok' : 'warn', GUARD[id]);
    set(0.15);
    if (!(await sleep(550, g))) return;
    line(id, 'info', `events for ${topicOf(id)} stay on Kafka · lag ${lag} and rising, nothing dropped`);

    let attempt = 1;
    if (!(await sleep(400, g))) return;
    fx.state(id, 'booting');
    fx.badge(id, 'RESTART 1', 'amber');
    line(id, 'info', `restart attempt 1 · backoff 1 s`);
    set(0.3);
    if (failsFirst) {
      if (!(await sleep(1200, g))) return;
      fx.state(id, 'failed');
      fx.badge(id, 'CRASHED · RETRY 2 s', 'red');
      line(id, 'crit', 'attempt 1 failed its readiness check · next try in 2 s (exponential backoff)');
      set(0.42);
      if (!(await sleep(2000, g))) return;
      attempt = 2;
      fx.state(id, 'booting');
      fx.badge(id, 'RESTART 2', 'amber');
      line(id, 'info', 'restart attempt 2 · backoff 2 s');
      set(0.52);
    }
    if (!(await sleep(1250, g))) return;
    line(id, 'ok', BOOT[id]);
    set(0.66);

    if (!isHub) {
      if (!(await sleep(450, g))) return;
      fx.breaker(id, 'half');
      fx.badge(id, 'HALF-OPEN', 'amber');
      line(id, 'warn', 'breaker HALF-OPEN · letting one trial request through');
      if (!(await sleep(750, g))) return;
      fx.breaker(id, 'closed');
      line(id, 'ok', 'trial request passed · breaker CLOSED');
    }
    set(0.78);

    stopLag();
    const total = lag;
    const offset = 1200 + Math.floor(Math.random() * 6800);
    fx.state(id, 'replaying');
    fx.badge(id, `REPLAY ${total}`, 'cyan');
    line(id, 'info', isHub
      ? `replaying ${total} buffered records from every topic`
      : `rejoined its consumer group · replaying ${total} events from offset ${offset.toLocaleString('en-US')}`);
    const step = Math.min(110, Math.max(45, 1500 / Math.max(total, 1)));
    while (lag > 0) {
      fx.drain(id);
      lag--;
      stats.replayed++;
      fx.queue(id, lag);
      set(0.78 + 0.2 * (1 - lag / Math.max(total, 1)));
      if (!(await sleep(step, g))) return;
    }

    const secs = (performance.now() - started) / 1000;
    stats.heals.push(secs);
    fx.state(id, 'ok');
    fx.breaker(id, null);
    fx.badge(id, 'HEALED', 'green');
    progress.delete(id);
    line(id, 'ok', `lag 0 · ${total} events replayed · 0 lost · healed in ${secs.toFixed(1)} s${attempt > 1 ? ' (2 attempts)' : ''}`);
    sync();
    if (!(await sleep(1800, g))) return;
    fx.badge(id, null);
  }

  function kill(id: Target) {
    if (!active) return;
    if (id !== 'hub' && serviceById(id)?.sealed) {
      fx.badge(id, 'SEALED', 'amber');
      line(id, 'warn', 'kill refused · this module is sealed, its code is private');
      const g = gen;
      void sleep(1600, g).then((ok) => { if (ok) fx.badge(id, null); });
      return;
    }
    if (progress.has(id)) { line(id, 'info', 'already down · recovery in progress'); return; }
    progress.set(id, 0);
    void incident(id);
  }

  function enter() {
    if (active) return;
    active = true;
    gen++;
    t0 = performance.now();
    log.replaceChildren();
    view.enter();  // first: it closes the JD compiler, which resets the scene
    scene.setChaos(true);
    line(null, 'info', 'chaos mode on · click any service, or the career-core hub, to kill it');
    sync();
    heading.focus({ preventScroll: true });
  }

  function exit() {
    if (!active) return;
    active = false;
    gen++;
    for (const id of timers) { clearTimeout(id); clearInterval(id); }
    timers.clear();
    progress.clear();
    fx.reset();
    scene.setChaos(false);
    view.exit();
    button.focus({ preventScroll: true });
  }

  monkey.addEventListener('click', () => {
    const healthy = SERVICES.filter((x) => !x.sealed && !progress.has(x.id)).map((x) => x.id);
    for (let i = healthy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [healthy[i], healthy[j]] = [healthy[j], healthy[i]];
    }
    const picks = healthy.slice(0, 3);
    if (!picks.length) { line(null, 'info', 'every service is already down · give it a moment'); return; }
    line(null, 'warn', `chaos monkey released · killing ${picks.join(', ')}`);
    const g = gen;
    picks.forEach((id, i) => void sleep(i * 700, g).then((ok) => { if (ok) kill(id); }));
  });

  share.addEventListener('click', async () => {
    const avg = stats.heals.reduce((a, b) => a + b, 0) / stats.heals.length;
    const n = stats.kills;
    const text = `I killed ${n} service${n === 1 ? '' : 's'} in ${PROFILE.name}'s career runtime. It healed itself in ${avg.toFixed(1)} s on average and lost 0 events.`;
    const url = `${location.origin}${location.pathname}?chaos`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Break my career', text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      share.textContent = 'Copied to clipboard';
    } catch {
      share.textContent = 'Copy blocked · link: ?chaos';
    }
    window.setTimeout(() => { share.textContent = 'Share result'; }, 2200);
  });

  leave.addEventListener('click', exit);
  button.addEventListener('click', enter);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && active) exit(); });

  return { el, button, get active() { return active; }, enter, exit, kill };
}
