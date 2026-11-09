export const SVG_NS = 'http://www.w3.org/2000/svg';

export type Attrs = Record<string, string | number | boolean | undefined | null>;
export type Child = Node | string | null | undefined | false;

function apply(el: Element, attrs: Attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
}

/** Create an SVG element. Strings in `children` become text nodes. */
export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Child[] = [],
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, attrs);
  for (const c of children) if (c) el.append(c);
  return el;
}

/** Create an HTML element. Strings in `children` become text nodes (never parsed as HTML). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs);
  for (const c of children) if (c) el.append(c);
  return el;
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Runs an animation only while it is both wanted (its view is shown) and on screen.
 * Off screen, the frame loop stops and CSS animations inside `el` pause via the `paused` class.
 */
export function gatedLoop(el: Element, loop: { start(): void; stop(): void }) {
  let wanted = false;
  let visible = true;
  const sync = () => {
    const on = wanted && visible && !reducedMotion();
    if (on) loop.start(); else loop.stop();
    el.classList.toggle('paused', !on);
  };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); });
  io.observe(el);
  return {
    start() { wanted = true; sync(); },
    stop() { wanted = false; sync(); },
    dispose() { wanted = false; sync(); io.disconnect(); },
    get running() { return wanted && visible; },
  };
}

/** requestAnimationFrame loop that hands the callback seconds since the last frame. */
export function frameLoop(cb: (dt: number, now: number) => void) {
  let id = 0;
  let last = 0;
  const tick = (now: number) => {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    cb(dt, now / 1000);
    if (id) id = requestAnimationFrame(tick);  // the callback may have stopped the loop
  };
  return {
    start() {
      if (!id) { last = 0; id = requestAnimationFrame(tick); }
    },
    stop() {
      cancelAnimationFrame(id);
      id = 0;
    },
  };
}
