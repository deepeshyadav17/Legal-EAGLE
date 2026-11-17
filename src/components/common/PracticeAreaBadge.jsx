import { Link } from 'react-router-dom';
import { practiceName } from '../../mock/referenceData';
import { PRACTICE_ICONS } from '../../utils/practiceIcons';
import { cn } from '../../utils/format';

/** Practice area chip. Pass `linked` to make it a search shortcut. */
export default function PracticeAreaBadge({ slug, linked = false, primary = false, withIcon = false }) {
  const Icon = PRACTICE_ICONS[slug];
  const cls = cn(
    'badge border transition-colors',
    primary ? 'border-gold/40 bg-gold-100 text-navy' : 'border-line bg-cream text-ink',
    linked && 'hover:border-gold hover:bg-gold-100',
  );
  const content = (
    <>
      {withIcon && Icon && <Icon className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />}
      {practiceName(slug)}
    </>
  );
  return linked ? (
    <Link to={`/search?practice=${slug}`} className={cls}>{content}</Link>
  ) : (
    <span className={cls}>{content}</span>
  );
}
