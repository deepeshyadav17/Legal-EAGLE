import { Link } from 'react-router-dom';
import { Scale, Users, Building2, ShieldCheck, Search, ArrowRight } from 'lucide-react';
import DemoBadge from '../../components/common/DemoBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const PILLARS = [
  {
    icon: Search,
    title: 'For Clients',
    description:
      'Search advocates and law firms across 12 Indian legal practice areas and cities, compare factual credentials, bookmark profiles, and view permitted contact information.',
    cta: { to: '/search', label: 'Explore the Directory' },
  },
  {
    icon: Scale,
    title: 'For Individual Lawyers',
    description:
      'Maintain a structured professional portfolio covering education, court experience, bar enrolments, achievements, firm affiliation and contact privacy controls.',
    cta: { to: '/signup?role=lawyer', label: 'Create Lawyer Profile' },
  },
  {
    icon: Building2,
    title: 'For Law Firms',
    description:
      'Present your chambers or LLP, manage team memberships through invitations and approvals, and display an automatically verified count of active advocates.',
    cta: { to: '/signup?role=firm', label: 'Register a Law Firm' },
  },
];

export default function AboutPage() {
  useDocumentTitle('About Legal Eagle');

  return (
    <div>
      <section className="hero-pattern py-14 text-white sm:py-16">
        <div className="container-page">
          <div className="max-w-4xl">
            <DemoBadge className="mb-4" />
            <h1 className="font-serif text-3xl font-semibold text-white sm:text-5xl">
              Making Legal Professional Discovery Simple, Transparent & Accessible
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              Legal Eagle is an Indian legal professional discovery and networking platform connecting clients with individual advocates and law firms based on factual expertise and location.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, description, cta }) => (
            <div key={title} className="border-t-2 border-navy py-6">
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-gold-600" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-navy">{title}</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
              <Link to={cta.to} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:text-gold-600">
                {cta.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>

        <div className="card mt-12 grid gap-8 p-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">Regulatory & Ethical Standards</p>
            <h2 className="section-title mt-1">Neutral, Factual Directory Design</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink">
              Legal Eagle is designed for the Indian legal ecosystem. In keeping with professional ethics, the platform presents factual biographical, academic and practice-area information without arbitrary rankings, promotional ratings, fabricated reviews, or claims regarding case outcomes.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Individual lawyers retain complete ownership of their personal portfolios even when affiliated with a law firm, while law firms maintain their organizational profile and active team roster.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-cream p-6">
            <div className="flex items-center gap-2.5 text-navy">
              <ShieldCheck className="h-5 w-5 text-gold-600" aria-hidden="true" />
              <h3 className="font-semibold">Frontend MVP Prototype Scope</h3>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-ink">
              <li>• All lawyer, firm and client profiles are 100% fictional demonstration records.</li>
              <li>• Changes made in dashboards persist locally in your browser via a modular mock service layer.</li>
              <li>• Role-based workspaces and contact visibility rules simulate future backend API enforcement.</li>
              <li>• Ready for drop-in REST API integration via the service layer in <code className="rounded bg-white px-1.5 py-0.5 text-xs">src/services/</code>.</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/login" className="btn btn-primary btn-sm">
                Explore Demo Workspaces
              </Link>
              <Link to="/search" className="btn btn-outline btn-sm">
                <Users className="h-4 w-4" aria-hidden="true" /> Browse Directory
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
