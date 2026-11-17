import { Link } from 'react-router-dom';
import { Bookmark, Building2, Clock, Scale, ArrowRight, Trash2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import SearchBar from '../../components/search/SearchBar';
import StatCard from '../../components/common/StatCard';
import LawyerCard from '../../components/lawyer/LawyerCard';
import FirmCard from '../../components/firm/FirmCard';
import Avatar from '../../components/common/Avatar';
import { GridSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useSaved } from '../../context/SavedContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getClient, getSavedProfiles, getRecentlyViewed, clearRecentlyViewed } from '../../services/clientService';
import { PRACTICE_AREAS, practiceName } from '../../mock/referenceData';
import { timeAgo } from '../../utils/format';

export default function ClientDashboard() {
  useDocumentTitle('Client Dashboard');
  const { user } = useAuth();
  const { saved } = useSaved();
  const { notify } = useToast();

  const { data, loading, error, reload } = useAsync(
    async () => {
      const [client, savedItems, recent] = await Promise.all([
        getClient(user.profileId),
        getSavedProfiles(user.profileId),
        getRecentlyViewed(user.profileId),
      ]);
      return { client, savedItems, recent };
    },
    [user.profileId, saved.lawyers.length, saved.firms.length],
  );

  const handleClearRecent = async () => {
    try {
      await clearRecentlyViewed(user.profileId);
      notify('Recently viewed history cleared.', 'info');
      reload(true);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Client Workspace"
        title={`Welcome, ${user.name}`}
        description="Search legal professionals, revisit profiles you have viewed, and manage your saved shortlist."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/client/consultations" className="btn btn-outline btn-sm">
              My Consultations
            </Link>
            <Link to="/search" className="btn btn-primary btn-sm">
              Browse Directory <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        }
      />

      {/* Quick Search Box */}
      <section className="card p-6" aria-labelledby="quick-search-heading">
        <h2 id="quick-search-heading" className="text-base font-semibold text-navy">
          Quick Legal Professional Search
        </h2>
        <p className="mt-1 mb-4 text-xs text-muted">
          Enter a legal category or name and choose a city to find matching lawyers and firms.
        </p>
        <SearchBar variant="dashboard" defaultCity={data?.client?.city || ''} />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-muted">Quick categories:</span>
          {PRACTICE_AREAS.slice(0, 6).map((area) => (
            <Link
              key={area.slug}
              to={`/search?practice=${area.slug}`}
              className="rounded-full border border-line bg-cream px-3 py-1 font-medium text-ink transition hover:border-gold hover:bg-gold-100"
            >
              {area.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Scale}
          label="Saved Lawyers"
          value={saved.lawyers.length}
          hint="Bookmarked individual advocates"
          accent
        />
        <StatCard
          icon={Building2}
          label="Saved Law Firms"
          value={saved.firms.length}
          hint="Bookmarked legal chambers"
        />
        <StatCard
          icon={Clock}
          label="Recently Viewed"
          value={data?.recent?.length ?? 0}
          hint="Profiles opened in this session"
        />
      </div>

      {loading ? (
        <GridSkeleton count={4} className="grid gap-5 sm:grid-cols-2" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          {/* Saved Lawyers */}
          <section className="space-y-4" aria-labelledby="saved-lawyers-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="saved-lawyers-heading" className="text-lg font-semibold text-navy">
                Saved Lawyers
              </h2>
              <Link to="/client/saved" className="text-xs font-semibold text-navy hover:underline">
                Manage all saved ({saved.lawyers.length + saved.firms.length}) →
              </Link>
            </div>
            {data.savedItems.lawyers.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {data.savedItems.lawyers.slice(0, 4).map((lawyer) => (
                  <LawyerCard key={lawyer.id} lawyer={lawyer} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Bookmark}
                title="No saved lawyers yet"
                message="Click the bookmark icon on any lawyer card or profile to shortlist them here."
                action={
                  <Link to="/search?tab=lawyers" className="btn btn-primary btn-sm">
                    Find Lawyers
                  </Link>
                }
              />
            )}
          </section>

          {/* Saved Law Firms */}
          <section className="space-y-4" aria-labelledby="saved-firms-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="saved-firms-heading" className="text-lg font-semibold text-navy">
                Saved Law Firms
              </h2>
              <Link to="/search?tab=firms" className="text-xs font-semibold text-navy hover:underline">
                Explore more firms →
              </Link>
            </div>
            {data.savedItems.firms.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {data.savedItems.firms.slice(0, 4).map((firm) => (
                  <FirmCard key={firm.id} firm={firm} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Building2}
                title="No saved law firms yet"
                message="Bookmark law firms while browsing to keep track of organizations that match your needs."
                action={
                  <Link to="/search?tab=firms" className="btn btn-outline btn-sm">
                    Find Law Firms
                  </Link>
                }
              />
            )}
          </section>

          {/* Recently Viewed Profiles */}
          <section className="card p-6" aria-labelledby="recent-heading">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 id="recent-heading" className="text-lg font-semibold text-navy">
                  Recently Viewed Profiles
                </h2>
                <p className="text-xs text-muted">
                  Lawyers and law firms you have recently visited while signed in.
                </p>
              </div>
              {data.recent.length > 0 && (
                <button type="button" onClick={handleClearRecent} className="btn btn-ghost btn-sm text-xs text-muted">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Clear history
                </button>
              )}
            </div>

            {data.recent.length > 0 ? (
              <ul className="mt-4 divide-y divide-line">
                {data.recent.map(({ type, at, item }) => {
                  const to = type === 'lawyer' ? `/lawyers/${item.id}` : `/firms/${item.id}`;
                  return (
                    <li key={`${type}-${item.id}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 group">
                        <Avatar name={item.name} src={item.photo || item.logo} size="sm" square={type === 'firm'} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-navy group-hover:underline">
                            {item.name}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {type === 'lawyer' ? 'Advocate' : 'Law Firm'} · {practiceName(item.practiceAreas[0])} · {item.city}
                          </p>
                        </div>
                      </Link>
                      <span className="shrink-0 text-xs text-muted">{timeAgo(at)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-line bg-cream/60 p-6 text-center text-sm text-muted">
                No recently viewed profiles yet. Visit any lawyer or law firm profile to see it listed here.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

