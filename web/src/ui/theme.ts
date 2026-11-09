export type Theme = 'light' | 'dark';

const KEY = 'theme';
const BG: Record<Theme, string> = { dark: '#090b0f', light: '#f2f4f7' };

function saved(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

const system = (): Theme => (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

export const currentTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

type Origin = { x: number; y: number };

function set(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[t]);
}

/**
 * Switch themes. Where View Transitions exist, the new theme grows as a circle from the toggle
 * (or the top of the page), so every layer, SVG gradients included, changes at the same moment.
 * Elsewhere a short cross-fade; with reduced motion, an instant switch.
 */
function apply(t: Theme, fade: boolean, origin?: Origin) {
  const root = document.documentElement;
  if (!fade || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { set(t); return; }
  if (typeof document.startViewTransition === 'function') {
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? 0;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = document.startViewTransition(() => set(t));
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 560, easing: 'cubic-bezier(.3, .6, .2, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
    return;
  }
  root.classList.add('theme-fade');
  window.setTimeout(() => root.classList.remove('theme-fade'), 350);
  set(t);
}

/** Saved choice wins; otherwise follow the operating system, including later changes. */
export function initTheme() {
  apply(saved() ?? system(), false);
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (!saved()) apply(system(), true);
  });
}

export function toggleTheme(origin?: Origin): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  apply(next, true, origin);
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
  return next;
}
