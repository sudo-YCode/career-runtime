// Dev-only entry for og.html: the 1200×630 link-preview card, built from the real overview scene.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/instrument-serif';
import '@fontsource/instrument-serif/400-italic.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/overview.css';

import { HUES, PROFILE, SERVICES } from './data/career';
import { globalDefs } from './scene/shapes';
import { createOverview } from './scene/overview';
import { h } from './util/dom';
import figure from './assets/figure-1145.webp';

const hues = Object.values(HUES);
const style = document.createElement('style');
style.textContent = `
:root{${hues.map((x) => `--edge-${x.id}:${x.light};--label-${x.id}:${x.light};`).join('')}}
html, body.og-body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: var(--bg); }
.og {
  position: relative; width: 1200px; height: 630px; box-sizing: border-box;
  display: grid; grid-template-columns: 470px 1fr; align-items: center;
  background:
    radial-gradient(900px 520px at 78% 52%, var(--page-glow-1), transparent 70%),
    radial-gradient(600px 400px at 10% 0%, var(--page-glow-2), transparent 70%),
    var(--bg);
  border-top: 3px solid transparent;
  border-image: linear-gradient(90deg, ${hues.filter((x) => x.id !== 'sealed').map((x) => x.base).join(', ')}) 1;
}
.og-copy { padding: 0 0 0 64px; display: grid; gap: 22px; position: relative; z-index: 2; }
.og-eyebrow { font: 500 15px var(--font-mono); color: var(--cyan); letter-spacing: 0.02em; }
.og-name { font: 400 76px/0.95 var(--font-serif); color: var(--text); letter-spacing: -0.01em; margin: 0; }
.og-title { font: 500 21px/1.3 var(--font-sans); color: var(--text-2); margin: 0; }
.og-line { font: italic 400 30px/1.15 var(--font-serif); color: var(--display-em); margin: 0; }
.og-langs { display: flex; flex-wrap: wrap; gap: 8px; }
.og-langs .chip { font-size: 14px; padding: 6px 13px; }
.og-url { position: absolute; left: 64px; bottom: 34px; font: 500 15px var(--font-mono); color: var(--text-3); }
.og-scene { position: relative; height: 630px; margin-left: -90px; margin-right: -30px; display: flex; align-items: center; }
.og-scene .scene { width: 100%; max-height: none; }
.og-scene .labels { display: none; }
/* The engineer on the right, in front of the system, fading into the card on his left and at the bottom.
   A face is what people stop on in a feed; the system behind him says what the site is. */
.og-scene { margin-left: -14px; margin-right: 290px; opacity: .55; }
.og-figure {
  position: absolute; right: 0; top: 0; width: 470px; height: 630px; margin: 0; z-index: 1;
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 34%), linear-gradient(to bottom, #000 80%, transparent 100%);
  -webkit-mask-composite: source-in;
  mask-image: linear-gradient(to right, transparent 0%, #000 34%), linear-gradient(to bottom, #000 80%, transparent 100%);
  mask-composite: intersect;
}
.og-figure img { width: 100%; height: 100%; object-fit: cover; object-position: 46% 0%; display: block; }
`;
document.head.append(style);
document.body.prepend(globalDefs(hues));

const scene = createOverview();
const langs = SERVICES.filter((s) => !s.sealed);
const LANG: Record<string, string> = { java: 'Java', node: 'Node.js', vertx: 'Vert.x', kotlin: 'Kotlin', python: 'Python' };

const card = h('div', { class: 'og' }, [
  h('div', { class: 'og-copy' }, [
    h('div', { class: 'og-eyebrow' }, ['career-runtime']),
    h('h1', { class: 'og-name' }, [PROFILE.name]),
    h('p', { class: 'og-title' }, [`${PROFILE.title} · 8+ years`]),
    h('p', { class: 'og-line' }, ['My career, running as a distributed system.']),
    h('div', { class: 'og-langs' }, langs.map((s) =>
      h('span', { class: 'chip chip-hue', style: `--hue:${s.hue.base};--hue-light:${s.hue.light}` }, [LANG[s.hue.id] ?? s.hue.id]),
    )),
  ]),
  h('div', { class: 'og-scene' }, [scene.svg]),
  h('figure', { class: 'og-figure' }, [h('img', { src: figure, alt: '' })]),
  h('div', { class: 'og-url' }, ['sudo-ycode.github.io/career-runtime']),
]);
document.body.append(card);
scene.start();
scene.streaming(true);
