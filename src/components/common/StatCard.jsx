import { cn } from '../../utils/format';

export default function StatCard({ icon: Icon, label, value, hint, accent = false }) {
  return (
    <div className={cn('card p-5', accent && 'border-gold/40 bg-gradient-to-br from-white to-gold-100/60')}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && (
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy/5 text-navy">
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
