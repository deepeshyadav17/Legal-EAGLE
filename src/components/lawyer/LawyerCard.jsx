import { Link } from 'react-router-dom';
import { MapPin, Briefcase, Building2, ArrowRight, IndianRupee } from 'lucide-react';
import Avatar from '../common/Avatar';
import PracticeAreaBadge from '../common/PracticeAreaBadge';
import SaveButton from '../common/SaveButton';
import { formatINR, yearsLabel } from '../../utils/format';
import { practiceName } from '../../mock/referenceData';

/** Directory card for an individual lawyer. Whole card navigates to the profile. */
export default function LawyerCard({ lawyer }) {
  const [primary, ...rest] = lawyer.practiceAreas;
  return (
    <article className="card card-hover group relative flex flex-col p-5">
      <div className="flex items-start gap-4">
        <Avatar name={lawyer.name} src={lawyer.photo} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">
            <Link to={`/lawyers/${lawyer.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
              {lawyer.name}
            </Link>
          </h3>
          <p className="text-sm font-medium text-gold-600">{practiceName(primary)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {lawyer.city}
          </p>
        </div>
        <SaveButton type="lawyer" id={lawyer.id} name={lawyer.name} />
      </div>

      <dl className="mt-4 grid gap-1.5 text-sm">
        <div className="flex items-center gap-2 text-ink">
          <Briefcase className="h-4 w-4 text-muted" aria-hidden="true" />
          <dt className="sr-only">Experience</dt>
          <dd>{yearsLabel(lawyer.experienceYears)}</dd>
        </div>
        <div className="flex items-center gap-2 text-ink">
          <Building2 className="h-4 w-4 text-muted" aria-hidden="true" />
          <dt className="sr-only">Firm</dt>
          <dd className="truncate">{lawyer.firm ? lawyer.firm.name : 'Independent practice'}</dd>
        </div>
        {lawyer.consultationFee && (
          <div className="flex items-center gap-2 text-ink">
            <IndianRupee className="h-4 w-4 text-gold-600" aria-hidden="true" />
            <dt className="sr-only">Consultation fee</dt>
            <dd className="text-xs font-medium text-navy">
              {formatINR(lawyer.consultationFee)} <span className="text-muted font-normal">/ 1 hr consultation</span>
            </dd>
          </div>
        )}
      </dl>

      {rest.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rest.slice(0, 2).map((s) => <PracticeAreaBadge key={s} slug={s} />)}
        </div>
      )}

      <span className="mt-auto flex items-center justify-between border-t border-line pt-4 text-sm font-semibold text-navy" aria-hidden="true">
        <span className="mt-0">View Profile & Book</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </article>
  );
}
