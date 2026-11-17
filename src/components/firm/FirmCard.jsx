import { Link } from 'react-router-dom';
import { MapPin, Users, CalendarDays, ArrowRight } from 'lucide-react';
import Avatar from '../common/Avatar';
import PracticeAreaBadge from '../common/PracticeAreaBadge';
import SaveButton from '../common/SaveButton';

/** Directory card for a law firm. Member count is derived from active memberships. */
export default function FirmCard({ firm }) {
  return (
    <article className="card card-hover group relative flex flex-col p-5">
      <div className="flex items-start gap-4">
        <Avatar name={firm.name} src={firm.logo} size="md" square />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug">
            <Link to={`/firms/${firm.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
              {firm.name}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {firm.city}
          </p>
        </div>
        <SaveButton type="firm" id={firm.id} name={firm.name} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {firm.practiceAreas.slice(0, 3).map((s) => <PracticeAreaBadge key={s} slug={s} />)}
        {firm.practiceAreas.length > 3 && <span className="badge bg-cream text-muted">+{firm.practiceAreas.length - 3}</span>}
      </div>

      <div className="mt-4 flex gap-4 text-sm text-ink">
        <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-muted" aria-hidden="true" /> {firm.activeMemberCount} active lawyer{firm.activeMemberCount === 1 ? '' : 's'}</span>
        <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-muted" aria-hidden="true" /> Est. {firm.established}</span>
      </div>

      <span className="mt-auto flex items-center justify-between border-t border-line pt-4 text-sm font-semibold text-navy" aria-hidden="true">
        View Firm <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </article>
  );
}
