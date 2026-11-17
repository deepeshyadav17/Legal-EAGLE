import { CheckCircle2, Circle } from 'lucide-react';

/** Circular progress + checklist of missing profile items. */
export default function ProfileCompletion({ percent, missing = [], compact = false }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <section className="card p-6" aria-labelledby="completion-heading">
      <h2 id="completion-heading" className="text-lg font-semibold">Profile completion</h2>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
            <circle cx="40" cy="40" r={r} fill="none" stroke="#EEE9DD" strokeWidth="8" />
            <circle cx="40" cy="40" r={r} fill="none" stroke="#C8A96B" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c - (percent / 100) * c} className="transition-all duration-700" />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-lg font-semibold text-navy">{percent}%</span>
        </div>
        <p className="text-sm text-muted">
          {percent === 100 ? 'Your profile is complete. Great work!' : `Add ${missing.length} more item${missing.length === 1 ? '' : 's'} to complete your profile.`}
        </p>
      </div>
      {!compact && missing.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {missing.slice(0, 5).map((m) => (
            <li key={m} className="flex items-center gap-2 text-ink"><Circle className="h-3.5 w-3.5 text-muted" aria-hidden="true" /> {m}</li>
          ))}
        </ul>
      )}
      {!compact && percent === 100 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> All sections filled</p>
      )}
    </section>
  );
}
