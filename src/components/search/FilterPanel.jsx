import { useEffect, useState } from 'react';
import { SlidersHorizontal, X, Search } from 'lucide-react';
import FormField from '../forms/FormField';
import { CITIES, EXPERIENCE_OPTIONS, PRACTICE_AREAS } from '../../mock/referenceData';

const practiceOptions = PRACTICE_AREAS.map((p) => ({ value: p.slug, label: p.name }));
const cityOptions = CITIES.map((c) => ({ value: c, label: c }));
const expOptions = EXPERIENCE_OPTIONS.map((n) => ({ value: String(n), label: `${n} years` }));

/**
 * Search filters. `filters` comes from URL params; `onChange(patch)` updates them.
 * Keyword input is debounced to avoid a request on every keystroke.
 */
export default function FilterPanel({ filters, onChange, onClear, showExperience = true, activeCount = 0 }) {
  const [keyword, setKeyword] = useState(filters.q || '');

  useEffect(() => {
    setKeyword(filters.q || '');
  }, [filters.q]);

  useEffect(() => {
    if (keyword === (filters.q || '')) return undefined;
    const t = setTimeout(() => onChange({ q: keyword }), 400);
    return () => clearTimeout(t);
  }, [keyword]); // eslint-disable-line react-hooks/exhaustive-deps

  const minErr = filters.minExp && filters.maxExp && Number(filters.minExp) > Number(filters.maxExp)
    ? 'Minimum cannot exceed maximum.' : '';

  return (
    <aside aria-labelledby="filters-heading" className="card h-fit p-5 lg:sticky lg:top-24">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="filters-heading" className="flex items-center gap-2 text-base font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-gold-600" aria-hidden="true" /> Filters
          {activeCount > 0 && <span className="badge bg-navy text-white">{activeCount}</span>}
        </h2>
        {activeCount > 0 && (
          <button type="button" onClick={onClear} className="flex items-center gap-1 text-xs font-semibold text-navy hover:underline">
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear filters
          </button>
        )}
      </div>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onChange({ q: keyword }); }}>
        <div>
          <label htmlFor="filter-keyword" className="label">Keyword</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input id="filter-keyword" type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Name, firm or topic" className="input pl-9" />
          </div>
        </div>
        <FormField as="select" label="Practice area" name="practice" value={filters.practice || ''} placeholder="All practice areas"
          options={practiceOptions} onChange={(e) => onChange({ practice: e.target.value })} />
        <FormField as="select" label="City" name="city" value={filters.city || ''} placeholder="All cities"
          options={cityOptions} onChange={(e) => onChange({ city: e.target.value })} />
        {showExperience ? (
          <fieldset>
            <legend className="label">Years of experience</legend>
            <div className="grid grid-cols-2 gap-2">
              <FormField as="select" aria-label="Minimum experience" name="minExp" value={filters.minExp || ''} placeholder="Min"
                options={expOptions} onChange={(e) => onChange({ minExp: e.target.value })} />
              <FormField as="select" aria-label="Maximum experience" name="maxExp" value={filters.maxExp || ''} placeholder="Max"
                options={expOptions} onChange={(e) => onChange({ maxExp: e.target.value })} />
            </div>
            {minErr && <p className="mt-1 text-xs font-medium text-red-700" role="alert">{minErr}</p>}
          </fieldset>
        ) : (
          <p className="rounded-lg bg-cream p-3 text-xs text-muted">Experience filters apply to individual lawyers only.</p>
        )}
      </form>
    </aside>
  );
}
