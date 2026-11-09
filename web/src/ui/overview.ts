import { h, s, reducedMotion } from '../util/dom';
import { SERVICES, PROFILE, emailAddress, experience, type ServiceId } from '../data/career';
import figureSmall from '../assets/figure-560.webp';
import figureLarge from '../assets/figure-1145.webp';
import { createOverview } from '../scene/overview';
import { chaosMode } from './chaos';
import { jdMode } from './jd';
import { kafkaLog } from './kafka';

const TL_START = Date.UTC(2018, 0, 1);

export function overviewView(root: HTMLElement, go: (hash: string) => void) {
  const scene = createOverview();
  const xp = experience();

  const copy = h('div', { class: 'hero-copy' }, [
    h('div', { class: 'chips' }, [
      h('span', { class: 'chip' }, [PROFILE.title]),
      h('span', { class: 'chip' }, [`${xp.label} · 5 languages`]),
    ]),
    h('h1', { class: 'display' }, ['My career, running as a ', h('em', {}, ['distributed system.'])]),
    h('p', { class: 'lede' }, [
      'Each chapter of my career, drawn as a microservice in the language I used at that company. ',
      'Events flow over a Kafka ring into a hub that compiles them into this résumé. ',
      'Open any module to see inside it, down to the runtime and the bytecode.',
    ]),
    h('div', { class: 'cta' }, [
      h('a', { class: 'btn btn-primary', href: '#/s/fleet-tracker' }, ['Explore the system']),
      h('a', { class: 'btn btn-ghost', href: '#/resume' }, ['Read résumé']),
    ]),
    h('p', { class: 'meta' }, [`${PROFILE.location} · ${PROFILE.workMode.split(' · ')[0]} · ${PROFILE.availability.split(' · ')[1]}`]),
  ]);

  const timeline = buildTimeline(scene.highlight);
  const log = kafkaLog(scene);
  const sceneWrap = h('div', { class: 'scene-wrap' }, [scene.svg]);
  const hero = h('div', { class: 'hero' });
  const toHero = () => {
    const top = hero.getBoundingClientRect().top + window.scrollY - 72;
    if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  // Two modes swap the hero copy for a console while the scene stays where it is: chaos mode kills
  // services, the JD compiler links a job description to them. Only one runs at a time.
  const chaos = chaosMode(scene, {
    enter() { jd.exit({ quiet: true }); hero.classList.add('chaos'); toHero(); },
    exit() { hero.classList.remove('chaos'); },
  });
  const jd = jdMode(scene, {
    enter() { chaos.exit(); hero.classList.add('jd'); toHero(); },
    exit() { hero.classList.remove('jd'); },
  });
  copy.querySelector('.cta')!.after(h('div', { class: 'mode-ctas' }, [chaos.button, jd.button]));
  hero.append(copy, chaos.el, jd.el, sceneWrap, jd.card);

  root.append(hero, jd.report, h('div', { class: 'below' }, [timeline.el, onCall(), log.el]));

  scene.onOpen((id) => {
    if (chaos.active) { chaos.kill(id); return; }
    if (jd.active && jd.focus(id)) return;
    go(id === 'hub' ? '#/decisions' : id === 'private-rnd' ? '#/resume' : `#/s/${id}`);
  });
  scene.onHover((id) => timeline.highlight(id));

  // ?chaos (a shared chaos result) and ?jd open their mode on arrival. #/jd opens the JD compiler,
  // #/fit/… opens it with a shared job description. Leaving for a service page and coming back
  // brings the last fit report back.
  const params = new URLSearchParams(window.location.search);
  let autoChaos = params.has('chaos');
  let autoJd = params.has('jd');
  let resumeJd = false;

  return {
    show() {
      scene.start();
      log.resume();
      const hash = window.location.hash;
      if (hash.startsWith('#/fit/')) window.setTimeout(() => void jd.openShared(hash.slice(6)), 350);
      else if (hash === '#/jd' || resumeJd) jd.enter();
      else if (autoJd) window.setTimeout(() => jd.enter(), 400);
      autoJd = resumeJd = false;
      if (autoChaos) { autoChaos = false; window.setTimeout(() => chaos.enter(), 400); }
    },
    hide() { resumeJd = jd.active; jd.exit({ quiet: true }); chaos.exit(); scene.stop(); log.pause(); },
  };
}

/**
 * Who is on call for this system, drawn as a HUD: a cut-corner frame, the engineer in a hexagon with a
 * scan line, and mono readouts (status, terms, three clocks, location, how to page). It is the home
 * page's portrait and contact details in one, without repeating the name the nav already shows.
 * The scan line and the live dot are compositor animations and stop while the panel is off screen;
 * the clocks tick every 20 s, and only while the panel is on screen.
 */
const ZONES = [['IST', 'Asia/Kolkata'], ['LON', 'Europe/London'], ['NYC', 'America/New_York']] as const;
const GURUGRAM = '28.46°N 77.03°E';

function onCall() {
  const email = emailAddress();
  const [engagement, status] = PROFILE.availability.split(' · ');
  const [, hours] = PROFILE.workMode.split(' · ');
  const img = h('img', {
    src: figureSmall, srcset: `${figureSmall} 560w, ${figureLarge} 1145w`, sizes: '(max-width: 640px) 60vw, 220px',
    width: 560, height: 672, loading: 'lazy', decoding: 'async',
    alt: 'Yatin Verma with arms crossed; half of the portrait is drawn as circuitry',
  });

  // The hexagon's edge and a targeting reticle round the face, as vectors over the picture.
  const HEX = '50,1 99,24 99,76 50,99 1,76 1,24';
  const lines = s('svg', { class: 'oc-hexline', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, [
    s('polygon', { points: HEX, class: 'glow' }),
    s('polygon', { points: HEX, class: 'edge' }),
    s('path', { class: 'ret', d: 'M35 14V9H41M59 9H65V14M65 34V39H59M41 39H35V34' }),
    s('path', { class: 'tick', d: 'M50 1V6M99 50H95M50 99V94M1 50H5' }),
  ]);
  const face = h('figure', { class: 'oc-face' }, [
    h('div', { class: 'oc-hexwrap' }, [h('div', { class: 'oc-hex' }, [img, h('span', { class: 'oc-scan' })]), lines]),
    // The picture's own split: circuitry on the left half, the person on the right.
    h('figcaption', { class: 'oc-cap', 'aria-hidden': 'true' }, [h('span', {}, ['system']), h('span', {}, ['human'])]),
  ]);
  const shown = () => face.classList.add('ready');
  if (img.complete && img.naturalWidth) shown();
  else img.addEventListener('load', () => { img.decode().then(shown, shown); }, { once: true });

  // Three clocks: mine first, then the two time zones most remote roles hire from.
  const formats = ZONES.map(([, timeZone]) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }));
  const clocks = ZONES.map(([code]) => h('span', { class: 'oc-tz' }, [h('b', {}, ['--:--']), ` ${code}`]));
  const tick = () => { const now = new Date(); clocks.forEach((c, i) => { c.firstChild!.textContent = formats[i].format(now); }); };
  tick();

  const row = (k: string, ...v: (Node | string)[]) => [h('dt', {}, [k]), h('dd', {}, v)];
  const el = h('section', { class: 'oncall hud', 'aria-label': 'On call: how to reach me' }, [
    h('div', { class: 'oc-inner hud-inner' }, [
      face,
      h('div', { class: 'oc-body' }, [
        h('div', { class: 'oc-head' }, [
          h('span', { class: 'hud-tag' }, ['on call']),
          h('span', { class: 'oc-path' }, ['career-runtime / pager']),
          h('span', { class: 'oc-live' }, ['online']),
        ]),
        h('dl', { class: 'oc-list' }, [
          ...row('status', h('span', { class: 'oc-up' }, [status])),
          ...row('terms', `${engagement} · remote`),
          ...row('hours', hours),
          ...row('now', ...clocks),
          ...row('base', PROFILE.location, h('span', { class: 'oc-geo' }, [GURUGRAM])),
          ...row('reach', h('a', { href: `mailto:${email}` }, [email]), ' · ', h('a', { href: PROFILE.linkedin, rel: 'noopener', target: '_blank' }, ['LinkedIn'])),
        ]),
        h('div', { class: 'oc-cta' }, [
          h('a', { class: 'oc-btn primary', href: `mailto:${email}?subject=Hello%20Yatin` }, ['Page me']),
          h('a', { class: 'oc-btn ghost', href: '#/resume' }, ['Résumé']),
        ]),
      ]),
      h('span', { class: 'hud-corner tr', 'aria-hidden': 'true' }),
      h('span', { class: 'hud-corner bl', 'aria-hidden': 'true' }),
    ]),
  ]);

  let timer = 0;
  new IntersectionObserver(([e]) => {
    el.classList.toggle('paused', !e.isIntersecting);
    clearInterval(timer);
    timer = 0;
    if (e.isIntersecting) { tick(); timer = window.setInterval(tick, 20_000); }
  }).observe(el);
  return el;
}

function buildTimeline(highlight: (id: ServiceId | null) => void) {
  const end = Date.now() + 60 * 86_400_000;
  const span = end - TL_START;
  const pos = (iso: string | null) => (((iso ? Date.parse(iso + 'T00:00:00Z') : Date.now()) - TL_START) / span) * 100;
  const track = h('div', { class: 'tl-track' });
  const segs = new Map<ServiceId, HTMLElement>();
  for (const svc of SERVICES) {
    const left = pos(svc.start), right = pos(svc.end);
    const seg = h('a', {
      class: `tl-seg${svc.sealed ? ' sealed' : ''}`,
      href: svc.sealed ? '#/resume' : `#/s/${svc.id}`,
      style: `left:${left.toFixed(2)}%;width:${(right - left).toFixed(2)}%;--c:${svc.hue.base}`,
      'aria-label': `${svc.companyShort}${svc.client ? ' (' + svc.client + ')' : ''}`,
    }, [h('span', {}, [svc.client ?? svc.companyShort])]);
    seg.addEventListener('mouseenter', () => highlight(svc.id));
    seg.addEventListener('mouseleave', () => highlight(null));
    segs.set(svc.id, seg);
    track.append(seg);
  }
  const years = h('div', { class: 'tl-years' });
  for (let y = 2018; y <= new Date().getFullYear(); y++) {
    years.append(h('span', { style: `left:${pos(`${y}-01-01`).toFixed(2)}%` }, [String(y)]));
  }
  const el = h('section', { class: 'timeline', 'aria-label': 'Career timeline' }, [
    h('div', { class: 'panel-head' }, [h('span', {}, ['timeline · gaps between jobs left in']), h('span', { class: 'dim' }, ['hover to find the service'])]),
    track,
    years,
  ]);
  return {
    el,
    highlight(id: ServiceId | null) { segs.forEach((seg, k) => seg.classList.toggle('hl', k === id)); },
  };
}
