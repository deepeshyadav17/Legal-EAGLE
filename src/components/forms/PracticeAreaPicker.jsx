import { useId } from 'react';
import { Check } from 'lucide-react';
import { PRACTICE_AREAS } from '../../mock/referenceData';
import { PRACTICE_ICONS } from '../../utils/practiceIcons';
import { cn } from '../../utils/format';

/** Multi-select chip group for practice areas (keyboard accessible checkboxes). */
export default function PracticeAreaPicker({ label = 'Practice areas', value = [], onChange, error, max }) {
  const id = useId();
  const toggle = (slug) => {
    if (value.includes(slug)) onChange(value.filter((s) => s !== slug));
    else if (!max || value.length < max) onChange([...value, slug]);
  };
  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="label">
        {label} <span className="font-normal text-muted">({value.length} selected{max ? ` · max ${max}` : ''})</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {PRACTICE_AREAS.map((p) => {
          const active = value.includes(p.slug);
          const Icon = PRACTICE_ICONS[p.slug];
          return (
            <label
              key={p.slug}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-within:ring-4 focus-within:ring-gold/30',
                active ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink hover:border-gold',
              )}
            >
              <input type="checkbox" className="sr-only" checked={active} onChange={() => toggle(p.slug)} />
              {active ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Icon className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />}
              {p.name}
            </label>
          );
        })}
      </div>
      {error && <p id={`${id}-err`} className="mt-1.5 text-xs font-medium text-red-700" role="alert">{error}</p>}
    </fieldset>
  );
}
