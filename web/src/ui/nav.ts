import { h, s } from '../util/dom';
import { PROFILE, emailAddress } from '../data/career';
import { currentTheme, toggleTheme, type Theme } from './theme';

const SUN = 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z';
const MOON = 'M20.4 14.5A8.5 8.5 0 0 1 9.5 3.6 8.5 8.5 0 1 0 20.4 14.5Z';

export function mountNav(root: HTMLElement) {
  const mark = s('svg', { viewBox: '-14 -14 28 28', class: 'mark', 'aria-hidden': 'true' }, [
    s('polygon', { points: '0,-11 10,-5.5 0,0 -10,-5.5', fill: '#5cdcf5', opacity: 0.9 }),
    s('polygon', { points: '-10,-5.5 0,0 0,11 -10,5.5', fill: '#8f6cf7', opacity: 0.85 }),
    s('polygon', { points: '10,-5.5 0,0 0,11 10,5.5', fill: '#ec8a3f', opacity: 0.85 }),
  ]);
  const link = (href: string, label: string, route: string) => h('a', { href, 'data-route': route }, [label]);

  const icon = s('path', {});
  const toggle = h('button', { class: 'theme-toggle', type: 'button' }, [s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [icon])]);
  const showTheme = (t: Theme) => {
    // The icon shows where the button takes you.
    icon.setAttribute('d', t === 'dark' ? SUN : MOON);
    const label = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  };
  showTheme(currentTheme());
  toggle.addEventListener('click', () => {
    const r = toggle.getBoundingClientRect();
    showTheme(toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 }));
  });
  new MutationObserver(() => showTheme(currentTheme())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const contact = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, ['Contact']);
  contact.addEventListener('click', () => { window.location.href = `mailto:${emailAddress()}?subject=Hello%20Yatin`; });

  root.append(
    h('a', { class: 'brand', href: '#/' }, [mark, h('span', {}, [PROFILE.name])]),
    h('nav', { class: 'nav-links', 'aria-label': 'Sections' }, [
      link('#/', 'System', 'overview'),
      link('#/decisions', 'Decisions', 'decisions'),
      link('#/resume', 'Résumé', 'resume'),
    ]),
    h('div', { class: 'nav-right' }, [toggle, contact]),
  );

  return {
    setRoute(route: string) {
      root.querySelectorAll<HTMLAnchorElement>('[data-route]').forEach((a) => {
        if (a.dataset.route === route) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    },
  };
}
