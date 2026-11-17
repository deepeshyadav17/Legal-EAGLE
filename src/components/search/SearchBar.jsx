import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Scale } from 'lucide-react';
import { CITIES, PRACTICE_AREAS } from '../../mock/referenceData';
import { cn } from '../../utils/format';

/** Builds a /search URL; a keyword that names a practice area becomes a filter. */
export function buildSearchUrl({ keyword = '', city = '', tab }) {
  const params = new URLSearchParams();
  const term = keyword.trim();
  const match = PRACTICE_AREAS.find((p) => p.name.toLowerCase() === term.toLowerCase() || p.slug === term.toLowerCase());
  if (match) params.set('practice', match.slug);
  else if (term) params.set('q', term);
  if (city) params.set('city', city);
  if (tab) params.set('tab', tab);
  return `/search${params.toString() ? `?${params}` : ''}`;
}

/** Keyword + city search used by the hero and dashboards. */
export default function SearchBar({ variant = 'hero', defaultCity = '' }) {
  const navigate = useNavigate();
  const id = useId();
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState(defaultCity);
  const hero = variant === 'hero';

  const submit = (e) => {
    e.preventDefault();
    navigate(buildSearchUrl({ keyword, city }));
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Search legal professionals"
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg bg-white p-2 md:flex-row md:items-center',
        hero ? 'shadow-2xl shadow-black/30 ring-1 ring-white/20' : 'border border-line shadow-card',
      )}
    >
      <label htmlFor={`${id}-kw`} className="sr-only">Legal category or keyword</label>
      <div className="flex flex-1 items-center gap-2 rounded-md px-3 focus-within:bg-cream">
        <Scale className="h-5 w-5 shrink-0 text-gold-600" aria-hidden="true" />
        <input
          id={`${id}-kw`}
          list={`${id}-areas`}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Legal category or keyword, e.g. Criminal Law"
          className="w-full bg-transparent py-3 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
        <datalist id={`${id}-areas`}>
          {PRACTICE_AREAS.map((p) => <option key={p.slug} value={p.name} />)}
        </datalist>
      </div>
      <div className="hidden h-8 w-px bg-line md:block" aria-hidden="true" />
      <label htmlFor={`${id}-city`} className="sr-only">City</label>
      <div className="flex items-center gap-2 rounded-md px-3 focus-within:bg-cream md:w-52">
        <MapPin className="h-5 w-5 shrink-0 text-gold-600" aria-hidden="true" />
        <select id={`${id}-city`} value={city} onChange={(e) => setCity(e.target.value)} className="w-full cursor-pointer bg-transparent py-3 text-sm text-ink focus:outline-none">
          <option value="">All cities</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button type="submit" className={cn('btn w-full md:w-auto', hero ? 'btn-gold btn-lg' : 'btn-primary')}>
        <Search className="h-4 w-4" aria-hidden="true" /> Search
      </button>
    </form>
  );
}
