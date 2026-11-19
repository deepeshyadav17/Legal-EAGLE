import { Link } from 'react-router-dom';
import {
  Search, FileText, UserCheck, ArrowRight, Building2, Scale, ShieldCheck, MapPin,
} from 'lucide-react';
import SearchBar from '../../components/search/SearchBar';
import LawyerCard from '../../components/lawyer/LawyerCard';
import FirmCard from '../../components/firm/FirmCard';
import { GridSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { PRACTICE_AREAS, CITIES } from '../../mock/referenceData';
import { PRACTICE_ICONS } from '../../utils/practiceIcons';
import { getDiscoverData } from '../../services/searchService';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const STEPS = [
  {
    icon: Search,
    step: '01',
    title: 'Pick your need',
    description: 'Choose a practice area and city.',
  },
  {
    icon: FileText,
    step: '02',
    title: 'Compare profiles',
    description: 'Review experience, fees and credentials.',
  },
  {
    icon: UserCheck,
    step: '03',
    title: 'Shortlist & connect',
    description: 'Save professionals and connect directly.',
  },
];

export default function HomePage() {
  useDocumentTitle();
  const { data, loading, error, reload } = useAsync(getDiscoverData, []);

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-pattern text-white">
        <div className="container-page grid grid-cols-1 gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-20">
          <div>
            <p className="eyebrow text-gold">Indian legal professional directory</p>
            <h1 className="mt-5 max-w-2xl font-serif text-4xl font-medium leading-[1.12] text-white sm:text-5xl lg:text-[3.75rem]">
              Find legal counsel with clarity.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Find a lawyer or firm by legal need, city and experience.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link to="/search?tab=lawyers" className="btn btn-gold">
                <Search className="h-4 w-4" aria-hidden="true" /> Browse the directory
              </Link>
              <Link to="/about" className="text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline">
                How Legal Eagle works
              </Link>
            </div>

            <div className="mt-9 border-t border-white/15 pt-5">
              <p className="text-xs font-medium text-white/60">Popular practice areas</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {['criminal', 'property', 'family', 'corporate', 'cyber'].map((slug) => {
                  const area = PRACTICE_AREAS.find((p) => p.slug === slug);
                  return (
                    <Link
                      key={slug}
                      to={`/search?practice=${slug}`}
                      className="text-sm text-white/85 underline decoration-white/25 underline-offset-4 transition-colors hover:text-gold"
                    >
                      {area?.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 text-ink sm:p-7">
            <p className="eyebrow">Search the directory</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-navy sm:text-3xl">
              Start with what you need.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Search by name, legal area or city.
            </p>
            <div className="mt-5">
              <SearchBar variant="dashboard" />
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
              <div>
                <dt className="text-xs leading-tight text-muted">Practice areas</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold text-navy">
                  {data?.totals.practiceAreas ?? PRACTICE_AREAS.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs leading-tight text-muted">Lawyers</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold text-navy">
                  {data?.totals.lawyers ?? '22'}
                </dd>
              </div>
              <div>
                <dt className="text-xs leading-tight text-muted">Law firms</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold text-navy">
                  {data?.totals.firms ?? '6'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Explore Legal Practice Areas */}
      <section className="container-page py-16 sm:py-20" aria-labelledby="practice-areas-heading">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Browse by Specialization</p>
            <h2 id="practice-areas-heading" className="section-title mt-1">
              Explore Legal Practice Areas
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Explore lawyers by specialty.
            </p>
          </div>
          <Link to="/search" className="btn btn-outline self-start sm:self-auto">
            View all in directory <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRACTICE_AREAS.map((area) => {
            const Icon = PRACTICE_ICONS[area.slug] || Scale;
            const count = data?.practiceCounts?.[area.slug];
            return (
              <Link
                key={area.slug}
                to={`/search?practice=${area.slug}`}
                className="group flex min-w-0 items-start gap-3 rounded-lg border border-line bg-white p-4 transition-colors hover:border-gold-600"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-gold-100 text-gold-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-navy group-hover:text-gold-600">
                      {area.name}
                    </h3>
                    {count !== undefined && (
                      <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-sky-800">
                        {count} {count === 1 ? 'lawyer' : 'lawyers'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-muted">{area.description}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-sky-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* How Legal Eagle Works */}
      <section className="border-y border-line bg-white py-16 sm:py-20" aria-labelledby="how-heading">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Simple & Transparent</p>
            <h2 id="how-heading" className="section-title mt-1">
              How Legal Eagle Works
            </h2>
            <p className="mt-2 text-sm text-muted">
              Three simple steps to the right professional.
            </p>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, step, title, description }) => (
              <div key={step} className="rounded-lg border border-line bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-md bg-cream text-navy">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-serif text-sm font-semibold text-gold-600">{step}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-navy">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-line bg-cream p-4 text-xs text-muted">
            <span className="flex items-center gap-2 font-medium text-ink">
              <MapPin className="h-4 w-4 text-sky-700" aria-hidden="true" /> Popular cities
            </span>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {CITIES.map((city) => (
                <Link
                  key={city}
                  to={`/search?city=${encodeURIComponent(city)}`}
                  className="font-medium text-navy underline decoration-line underline-offset-4 transition-colors hover:text-gold-600 hover:decoration-gold"
                >
                  {city}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Discover Legal Professionals */}
      <section className="container-page py-16 sm:py-20" aria-labelledby="discover-lawyers-heading">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Individual Advocates</p>
            <h2 id="discover-lawyers-heading" className="section-title mt-1">
              Discover Legal Professionals
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Meet advocates across a range of specialties.
            </p>
          </div>
          <Link to="/search?tab=lawyers" className="btn btn-outline self-start sm:self-auto">
            Browse all lawyers <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-8">
          {loading ? (
            <GridSkeleton count={4} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {data.lawyers.map((lawyer) => (
                <LawyerCard key={lawyer.id} lawyer={lawyer} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Explore Law Firms */}
      <section className="border-t border-line bg-white py-16 sm:py-20" aria-labelledby="discover-firms-heading">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Legal Organizations</p>
              <h2 id="discover-firms-heading" className="section-title mt-1">
                Explore Law Firms
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                Explore firms and their active legal teams.
              </p>
            </div>
            <Link to="/search?tab=firms" className="btn btn-outline self-start sm:self-auto">
              Browse all firms <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-8">
            {loading ? (
              <GridSkeleton count={3} className="grid gap-5 md:grid-cols-3" />
            ) : error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : (
              <div className="grid gap-5 md:grid-cols-3">
                {data.firms.map((firm) => (
                  <FirmCard key={firm.id} firm={firm} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Join Legal Eagle Section */}
      <section className="container-page py-16 sm:py-20" aria-labelledby="join-heading">
        <div className="hero-pattern grid gap-8 p-6 text-white sm:p-9 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
            <div>
              <p className="eyebrow text-gold">For advocates and law chambers</p>
              <h2 id="join-heading" className="mt-3 max-w-2xl font-serif text-2xl font-semibold text-white sm:text-4xl">
                Join Legal Eagle as a Lawyer or Law Firm
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
                Build your profile, manage your team and meet new clients.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/signup?role=lawyer" className="btn btn-gold">
                  <Scale className="h-4 w-4" aria-hidden="true" /> Join as a Lawyer
                </Link>
                <Link to="/signup?role=firm" className="btn border border-white/25 bg-white/10 text-white hover:bg-white/20">
                  <Building2 className="h-4 w-4" aria-hidden="true" /> Register a Law Firm
                </Link>
                <Link to="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline">
                  Try demo login <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="divide-y divide-white/15 border-y border-white/15">
              <div className="flex gap-4 py-5">
                <Scale className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Advocate portfolios</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/70">
                    Showcase your experience and specialties.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 py-5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Firm directory and teams</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/70">
                    Grow your firm and keep your team up to date.
                  </p>
                </div>
              </div>
            </div>
        </div>
      </section>
    </div>
  );
}
