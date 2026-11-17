import { Link } from 'react-router-dom';
import Logo from '../common/Logo';
import { PRACTICE_AREAS, CITIES } from '../../mock/referenceData';

export default function Footer() {
  return (
    <footer className="site-footer mt-auto text-white/80">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:gap-12">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
            Making legal professional discovery simple, transparent and accessible across India.
          </p>
          <p className="mt-5 max-w-sm border-l border-white/25 pl-3 text-xs leading-relaxed text-white/60">
            Legal Eagle is a directory. It does not provide legal advice, rank advocates or guarantee outcomes. All profiles shown in this prototype are fictional.
          </p>
        </div>
        <FooterCol title="Practice Areas" links={PRACTICE_AREAS.slice(0, 6).map((p) => ({ to: `/search?practice=${p.slug}`, label: p.name }))} />
        <FooterCol title="Cities" links={CITIES.slice(0, 6).map((c) => ({ to: `/search?city=${c}`, label: `Lawyers in ${c}` }))} />
        <FooterCol
          title="Platform"
          links={[
            { to: '/about', label: 'About Legal Eagle' },
            { to: '/search?tab=lawyers', label: 'Find Lawyers' },
            { to: '/search?tab=firms', label: 'Find Firms' },
            { to: '/signup?role=lawyer', label: 'Join as a Lawyer' },
            { to: '/signup?role=firm', label: 'Register a Firm' },
          ]}
        />
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Legal Eagle. Frontend prototype — Demo Mode.</p>
          <p>Content subject to professional regulatory review before public launch.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gold">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.to}><Link to={l.to} className="transition hover:text-white">{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
