import { FlaskConical } from 'lucide-react';
import { cn } from '../../utils/format';

/** "Demo Mode" indicator for mocked functionality. */
export default function DemoBadge({ label = 'Demo Mode', className = '' }) {
  return (
    <span className={cn('badge border border-amber-300 bg-amber-50 text-amber-800', className)} title="This feature uses fictional demo data stored in your browser.">
      <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
