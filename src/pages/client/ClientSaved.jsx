import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Scale, Building2, Search } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import LawyerCard from '../../components/lawyer/LawyerCard';
import FirmCard from '../../components/firm/FirmCard';
import { GridSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useSaved } from '../../context/SavedContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getSavedProfiles } from '../../services/clientService';
import { cn } from '../../utils/format';

export default function ClientSaved() {
  useDocumentTitle('Saved Profiles');
  const { user } = useAuth();
  const { saved } = useSaved();
  const [tab, setTab] = useState('lawyers');

  const { data, loading, error, reload } = useAsync(
    () => getSavedProfiles(user.profileId),
    [user.profileId, saved.lawyers.length, saved.firms.length],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Shortlist"
        title="Saved Profiles"
        description="Review and manage the individual lawyers and law firms you have bookmarked."
        actions={
          <Link to="/search" className="btn btn-outline btn-sm">
            <Search className="h-4 w-4" aria-hidden="true" /> Find More Professionals
          </Link>
        }
      />

      {/* Tabs */}
      <div role="tablist" aria-label="Saved profile categories" className="inline-flex rounded-xl border border-line bg-white p-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'lawyers'}
          onClick={() => setTab('lawyers')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
            tab === 'lawyers' ? 'bg-navy text-white' : 'text-muted hover:text-navy',
          )}
        >
          <Scale className="h-4 w-4" aria-hidden="true" />
          Lawyers ({saved.lawyers.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'firms'}
          onClick={() => setTab('firms')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
            tab === 'firms' ? 'bg-navy text-white' : 'text-muted hover:text-navy',
          )}
        >
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Law Firms ({saved.firms.length})
        </button>
      </div>

      {loading ? (
        <GridSkeleton count={4} className="grid gap-5 sm:grid-cols-2" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : tab === 'lawyers' ? (
        data.lawyers.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {data.lawyers.map((lawyer) => (
              <LawyerCard key={lawyer.id} lawyer={lawyer} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Bookmark}
            title="No saved lawyers"
            message="Explore the lawyer directory and click the bookmark icon on any profile you want to save."
            action={
              <Link to="/search?tab=lawyers" className="btn btn-primary">
                Browse Lawyers
              </Link>
            }
          />
        )
      ) : data.firms.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {data.firms.map((firm) => (
            <FirmCard key={firm.id} firm={firm} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="No saved law firms"
          message="Browse law firms and bookmark organizations you wish to revisit."
          action={
            <Link to="/search?tab=firms" className="btn btn-primary">
              Browse Law Firms
            </Link>
          }
        />
      )}
    </div>
  );
}

