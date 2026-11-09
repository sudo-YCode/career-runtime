import { h } from '../util/dom';
import { PROFILE, SERVICES, emailAddress, experience, period } from '../data/career';
import portraitLarge from '../assets/portrait-1672.webp';
import portraitSmall from '../assets/portrait-960.webp';

/** Plain, printable résumé. "Save as PDF" prints this view with a light print stylesheet. */
export function resumeView(root: HTMLElement) {
  const xp = experience();
  const email = emailAddress();
  const print = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, ['Save as PDF']);
  print.addEventListener('click', () => window.print());

  // The portrait: fixed on the right on wide screens, a banner above the résumé on narrow ones.
  // Its inner edges fade into the page (resume.css). Lazy, so it loads only when this page opens.
  const portrait = h('figure', { class: 'r-portrait no-print' }, [
    h('img', {
      src: portraitLarge,
      srcset: `${portraitSmall} 960w, ${portraitLarge} 1672w`,
      sizes: '(max-width: 1100px) 100vw, 1500px',
      width: 1672, height: 941,
      alt: 'Portrait of Yatin Verma, one half drawn as circuitry',
      loading: 'lazy', decoding: 'async',
    }),
  ]);
  root.append(portrait);
  // Shown only once the whole picture is downloaded and decoded, then faded in. On a slow connection the
  // browser would otherwise paint it top-down as it arrives, hair first.
  const img = portrait.querySelector('img')!;
  const ready = () => portrait.classList.add('ready');
  if (img.complete && img.naturalWidth) ready();
  else img.addEventListener('load', () => { img.decode().then(ready, ready); }, { once: true });
  // Start the download as soon as someone points at, focuses or touches a link to this page,
  // so the picture is usually in the cache before the page opens. An eager image loads even while hidden.
  const intent = (e: Event) => {
    if (!(e.target instanceof Element) || !e.target.closest('a[href="#/resume"]')) return;
    img.loading = 'eager';
    for (const type of ['pointerover', 'focusin', 'touchstart']) document.removeEventListener(type, intent);
  };
  for (const type of ['pointerover', 'focusin', 'touchstart']) document.addEventListener(type, intent, { passive: true });

  root.append(h('article', { class: 'resume' }, [
    h('div', { class: 'resume-actions no-print' }, [
      h('a', { class: 'btn btn-ghost btn-sm', href: '#/' }, ['← Back to the system']),
      print,
    ]),
    h('header', { class: 'r-head' }, [
      h('h1', { class: 'display' }, [PROFILE.name]),
      h('p', { class: 'r-title' }, [`${PROFILE.title} · ${xp.label}`]),
      h('p', { class: 'r-contact' }, [
        `${PROFILE.location} · ${PROFILE.workMode} · `,
        h('a', { href: `mailto:${email}` }, [email]),
        ' · ',
        h('a', { href: PROFILE.linkedin, rel: 'noopener', target: '_blank' }, ['linkedin.com/in/yatinv']),
      ]),
      h('p', { class: 'r-avail' }, [PROFILE.availability]),
    ]),
    h('section', {}, [h('h2', {}, ['Summary']), ...PROFILE.summary.map((p) => h('p', {}, [p]))]),
    h('section', {}, [h('h2', {}, ['Highlights']), h('ul', {}, PROFILE.highlights.map((x) => h('li', {}, [x])))]),
    h('section', {}, [
      h('h2', {}, ['Experience']),
      ...PROFILE.experience.map((job) => h('div', { class: 'r-job' }, [
        h('div', { class: 'r-job-head' }, [
          h('h3', {}, [job.company]),
          h('span', { class: 'r-dates' }, [period(job)]),
        ]),
        h('p', { class: 'r-role' }, [job.title]),
        h('ul', {}, job.points.map((p) => h('li', {}, [p]))),
      ])),
    ]),
    h('section', {}, [
      h('h2', {}, ['Skills']),
      h('dl', { class: 'r-skills' }, PROFILE.skills.flatMap((g) => [h('dt', {}, [g.group]), h('dd', {}, [g.items.join(', ')])])),
    ]),
    h('section', {}, [
      h('h2', {}, ['Education']),
      h('p', {}, [`${PROFILE.education.degree}, ${PROFILE.education.school} · ${PROFILE.education.years}`]),
    ]),
    h('p', { class: 'r-foot no-print' }, [
      `This page is generated from the same data as the system view: ${SERVICES.filter((s) => !s.sealed).length} services, one hub.`,
    ]),
  ]));
}
