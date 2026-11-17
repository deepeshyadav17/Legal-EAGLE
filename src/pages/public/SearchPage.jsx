import { useSearchParams } from 'react-router-dom';
import { Scale, Building2, X, RotateCcw } from 'lucide-react';
import FilterPanel from '../../components/search/FilterPanel';
import LawyerCard from '../../components/lawyer/LawyerCard';
import FirmCard from '../../components/firm/FirmCard';
import Pagination from '../../components/common/Pagination';
import { GridSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import { searchLawyers, searchFirms } from '../../services/searchService';
import { practiceName } from '../../mock/referenceData';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cn } from '../../utils/format';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'firms' ? 'firms' : 'lawyers';
  const filters = {
    q: searchParams.get('q') || '',
    practice: searchParams.get('practice') || '',
    city: searchParams.get('city') || '',
    minExp: searchParams.get('minExp') || '',
    maxExp: searchParams.get('maxExp') || '',
    page: Number(searchParams.get('page')) || 1,
  };

  useDocumentTitle(tab === 'firms' ? 'Find Law Firms' : 'Find Lawyers');

  const updateParams = (patch, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) next.delete(k);
      else next.set(k, String(v));
    });
    if (resetPage) next.delete('page');
    setSearchParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (tab === 'firms') next.set('tab', 'firms');
    setSearchParams(next);
  };

  const activeFilterKeys = ['q', 'practice', 'city', ...(tab === 'lawyers' ? ['minExp', 'maxExp'] : [])].filter(
    (k) => Boolean(filters[k]),
  );

  const { data, loading, error, reload } = useAsync(
    () => (tab === 'firms' ? searchFirms(filters) : searchLawyers(filters)),
    [tab, filters.q, filters.practice, filters.city, filters.minExp, filters.maxExp, filters.page],
  );

  const activeChips = [
    filters.q && { key: 'q', label: `Keyword: “${filters.q}”` },
    filters.practice && { key: 'practice', label: practiceName(filters.practice) },
    filters.city && { key: 'city', label: `City: ${filters.city}` },
    tab === 'lawyers' && filters.minExp && { key: 'minExp', label: `Min ${filters.minExp} yrs` },
    tab === 'lawyers' && filters.maxExp && { key: 'maxExp', label: `Max ${filters.maxExp} yrs` },
  ].filter(Boolean);

  return (
    <div className="container-page py-8 sm:py-10">
      {/* Header + Tabs */}
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Legal Directory</p>
          <h1 className="section-title mt-1">
            {tab === 'firms' ? 'Find Law Firms' : 'Find Legal Professionals'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Filter by legal practice area, city and years of experience. Results are listed in neutral alphabetical order.
          </p>
        </div>

        <div role="tablist" aria-label="Directory type" className="inline-flex rounded-xl border border-line bg-white p-1 shadow-xs self-start">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'lawyers'}
            onClick={() => updateParams({ tab: 'lawyers' })}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
              tab === 'lawyers' ? 'bg-navy text-white shadow-xs' : 'text-muted hover:text-navy',
            )}
          >
            <Scale className="h-4 w-4" aria-hidden="true" /> Lawyers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'firms'}
            onClick={() => updateParams({ tab: 'firms' })}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
              tab === 'firms' ? 'bg-navy text-white shadow-xs' : 'text-muted hover:text-navy',
            )}
          >
            <Building2 className="h-4 w-4" aria-hidden="true" /> Law Firms
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sidebar Filters */}
        <div className="lg:col-span-4 xl:col-span-3">
          <FilterPanel
            filters={filters}
            onChange={(patch) => updateParams(patch, true)}
            onClear={clearFilters}
            showExperience={tab === 'lawyers'}
            activeCount={activeFilterKeys.length}
          />
        </div>

        {/* Results Column */}
        <div className="lg:col-span-8 xl:col-span-9">
          {/* Result count & active filter chips */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted" aria-live="polite">
              {loading ? (
                'Searching directory…'
              ) : data ? (
                <>
                  Showing <strong className="font-semibold text-navy">{data.items.length}</strong> of{' '}
                  <strong className="font-semibold text-navy">{data.total}</strong>{' '}
                  {tab === 'firms' ? (data.total === 1 ? 'law firm' : 'law firms') : data.total === 1 ? 'lawyer' : 'lawyers'}
                </>
              ) : null}
            </p>

            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => updateParams({ [chip.key]: '' })}
                    className="badge border border-gold/40 bg-gold-100 text-navy hover:bg-gold/30"
                    title={`Remove ${chip.label}`}
                  >
                    {chip.label} <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <GridSkeleton count={6} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : data.items.length === 0 ? (
            <EmptyState
              title={`No matching ${tab === 'firms' ? 'law firms' : 'lawyers'} found`}
              message="Try broadening your search keyword, selecting a different city, or clearing active filters."
              action={
                activeFilterKeys.length > 0 && (
                  <button type="button" onClick={clearFilters} className="btn btn-primary">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Clear all filters
                  </button>
                )
              }
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {tab === 'firms'
                  ? data.items.map((firm) => <FirmCard key={firm.id} firm={firm} />)
                  : data.items.map((lawyer) => <LawyerCard key={lawyer.id} lawyer={lawyer} />)}
              </div>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onChange={(p) => {
                  updateParams({ page: p }, false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

