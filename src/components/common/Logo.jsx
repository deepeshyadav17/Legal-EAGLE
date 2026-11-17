import { Link } from 'react-router-dom';
import { cn } from '../../utils/format';

export default function Logo({ light = false, className = '' }) {
  return (
    <Link to="/" className={cn('group inline-flex items-center gap-2.5', className)} aria-label="Legal Eagle home">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-gold">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M12 3l8 4.5H4L12 3zm-6 6h2v7H6zm5 0h2v7h-2zm5 0h2v7h-2zM4 18h16v2.5H4z" fill="#101F35" />
        </svg>
      </span>
      <span className={cn('font-serif text-xl font-semibold tracking-tight', light ? 'text-white' : 'text-navy')}>
        Legal <span className="text-gold">Eagle</span>
      </span>
    </Link>
  );
}
