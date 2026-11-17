import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/format';

function pageList(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i && p - sorted[i - 1] > 1 ? ['…', p] : [p]));
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1.5">
      <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Prev</span>
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-2 text-muted">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn('h-9 min-w-9 rounded-lg px-3 text-sm font-semibold transition', p === page ? 'bg-navy text-white' : 'text-ink hover:bg-navy/5')}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
        <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
