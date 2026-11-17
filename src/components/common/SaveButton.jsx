import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useSaved } from '../../context/SavedContext';
import { cn } from '../../utils/format';

/** Bookmark toggle — rendered only for client accounts. */
export default function SaveButton({ type, id, name, variant = 'icon', className = '' }) {
  const { canSave, isSaved, toggle } = useSaved();
  const [busy, setBusy] = useState(false);
  if (!canSave) return null;
  const saved = isSaved(type, id);

  const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    await toggle(type, id, name);
    setBusy(false);
  };
  const Icon = saved ? BookmarkCheck : Bookmark;
  const label = saved ? `Remove ${name} from saved` : `Save ${name}`;

  if (variant === 'button') {
    return (
      <button type="button" onClick={onClick} disabled={busy} aria-pressed={saved} className={cn('btn', saved ? 'btn-gold' : 'btn-outline', className)}>
        <Icon className="h-4 w-4" aria-hidden="true" /> {saved ? 'Saved' : 'Save'}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(
        'relative z-10 grid h-9 w-9 place-items-center rounded-full border transition',
        saved ? 'border-gold bg-gold-100 text-gold-600' : 'border-line bg-white text-muted hover:border-gold hover:text-gold-600',
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
