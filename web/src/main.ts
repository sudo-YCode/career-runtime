import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/instrument-serif';
import '@fontsource/instrument-serif/400-italic.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/overview.css';
import './styles/chaos.css';
import './styles/jd.css';
import './styles/service.css';
import './styles/decisions.css';
import './styles/resume.css';

import { gsap } from 'gsap';
import { HUES, serviceById } from './data/career';
import { globalDefs } from './scene/shapes';
import { Telemetry } from './runtime/telemetry';
import { mountNav } from './ui/nav';
import { overviewView } from './ui/overview';
import { serviceView } from './ui/service';
import { decisionsView } from './ui/decisions';
import { resumeView } from './ui/resume';
import { initTheme } from './ui/theme';
import { reducedMotion } from './util/dom';

initTheme();

// Each language hue gets an outline colour and a text colour per theme. Pale tints glow on dark;
// on light they would vanish, so light mode uses the hue's base and deep shades instead.
const hues = Object.values(HUES);
const hueTokens = document.createElement('style');
hueTokens.textContent =
  `:root{${hues.map((x) => `--edge-${x.id}:${x.light};--label-${x.id}:${x.light};`).join('')}}` +
  `:root[data-theme='light']{${hues.map((x) => `--edge-${x.id}:${x.base};--label-${x.id}:${x.deep};`).join('')}}`;
document.head.append(hueTokens);
document.body.prepend(globalDefs(hues));

const telemetry = new Telemetry();
const nav = mountNav(document.getElementById('nav')!);

const views = {
  overview: document.getElementById('view-overview')!,
  service: document.getElementById('view-service')!,
  decisions: document.getElementById('view-decisions')!,
  resume: document.getElementById('view-resume')!,
};

const go = (hash: string) => { window.location.hash = hash; };
const overview = overviewView(views.overview, go);
const decisions = decisionsView(views.decisions);
resumeView(views.resume);

let current: keyof typeof views | null = null;
let service: ReturnType<typeof serviceView> | null = null;

function route() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const m = hash.match(/^\/s\/([\w-]+)$/);
  const svc = m ? serviceById(m[1]) : undefined;
  // #/decisions, #/decisions/adr-003 or #/decisions/jd. The old #/toolchain links land here too.
  const dm = hash.match(/^\/(?:decisions|toolchain)(?:\/([\w-]+))?$/);
  const next: keyof typeof views =
    svc && !svc.sealed ? 'service' : dm ? 'decisions' : hash === '/resume' ? 'resume' : 'overview';

  if (current === 'overview') overview.hide();
  if (current === 'decisions') decisions.hide();
  service?.destroy();
  service = null;
  views.service.replaceChildren();

  if (next === 'service' && svc) {
    service = serviceView(svc, telemetry);
    views.service.append(service.el);
  }

  for (const [k, el] of Object.entries(views)) el.hidden = k !== next;
  current = next;
  document.documentElement.dataset.view = next;
  nav.setRoute(next === 'service' ? 'overview' : next);
  document.title = next === 'service' && svc ? `${svc.name} · Yatin Verma`
    : next === 'resume' ? 'Résumé · Yatin Verma'
    : next === 'decisions' ? 'Decisions · Yatin Verma'
    : 'Yatin Verma · Career Runtime';
  window.scrollTo({ top: 0 });

  if (next === 'overview') overview.show();
  if (next === 'decisions') decisions.show(dm?.[1]);
  // Any transform on a view, even translate(0, 0), makes the view the containing block of whatever is
  // position: fixed inside it, so the résumé's portrait would stretch to the whole page while the view
  // animated in. The résumé therefore only fades, and resume.css forbids a transform on it as a guard.
  if (!reducedMotion()) {
    const ease = { duration: 0.5, ease: 'power2.out' };
    if (next === 'resume') gsap.fromTo(views[next], { opacity: 0 }, { opacity: 1, ...ease });
    else gsap.fromTo(views[next], { opacity: 0, y: 10 }, { opacity: 1, y: 0, ...ease, clearProps: 'transform' });
  }
  service?.mounted();
}

window.addEventListener('hashchange', route);
route();
