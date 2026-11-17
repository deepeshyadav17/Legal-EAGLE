import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import Avatar from '../common/Avatar';
import { practiceName } from '../../mock/referenceData';
import { yearsLabel } from '../../utils/format';

/**
 * Compact lawyer row used in firm team directories and membership lists.
 * `actions` renders management buttons (dashboard); otherwise links to profile.
 */
export default function MemberCard({ lawyer, actions, note }) {
  return (
    <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={lawyer.name} src={lawyer.photo} size="sm" />
        <div className="min-w-0">
          <Link to={`/lawyers/${lawyer.id}`} className="block truncate font-semibold text-navy hover:underline">
            {lawyer.name}
          </Link>
          <p className="truncate text-sm text-gold-600">{practiceName(lawyer.practiceAreas[0])}</p>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{lawyer.city}</span>
            <span>{yearsLabel(lawyer.experienceYears)}</span>
            {note && <span>{note}</span>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {actions ?? (
          <Link to={`/lawyers/${lawyer.id}`} className="btn btn-outline btn-sm" aria-label={`View profile of ${lawyer.name}`}>
            View Profile
          </Link>
        )}
      </div>
    </div>
  );
}
