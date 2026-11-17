import { GraduationCap, Briefcase, BadgeCheck, Award, Pencil, Trash2 } from 'lucide-react';
import { formatDateRange, formatMonth } from '../../utils/format';

/** Shared row layout; edit/delete actions appear only when handlers are passed. */
function RecordRow({ icon: Icon, title, subtitle, meta, children, onEdit, onDelete, label }) {
  return (
    <li className="group flex gap-4 py-4 first:pt-0 last:pb-0">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-cream text-navy">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold text-navy">{title}</h4>
        {subtitle && <p className="text-sm text-ink">{subtitle}</p>}
        {meta && <p className="mt-0.5 text-xs text-muted">{meta}</p>}
        {children && <p className="mt-2 text-sm leading-relaxed text-ink/90">{children}</p>}
      </div>
      {(onEdit || onDelete) && (
        <div className="flex shrink-0 items-start gap-1">
          {onEdit && (
            <button type="button" onClick={onEdit} className="btn-ghost rounded-lg p-2" aria-label={`Edit ${label}`}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className="rounded-lg p-2 text-red-700 hover:bg-red-50" aria-label={`Delete ${label}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function EducationCard({ item, ...actions }) {
  return (
    <RecordRow icon={GraduationCap} title={item.institution} subtitle={`${item.degree}${item.field ? `, ${item.field}` : ''}`}
      meta={`${item.startYear} – ${item.endYear || 'Present'}`} label={`${item.degree} at ${item.institution}`} {...actions} />
  );
}

export function ExperienceCard({ item, ...actions }) {
  return (
    <RecordRow icon={Briefcase} title={item.designation} subtitle={item.organization}
      meta={formatDateRange(item.startDate, item.endDate)} label={`${item.designation} at ${item.organization}`} {...actions}>
      {item.description}
    </RecordRow>
  );
}

export function QualificationCard({ item, ...actions }) {
  return (
    <RecordRow icon={BadgeCheck} title={item.title} subtitle={item.issuer} meta={`Issued ${formatMonth(item.issueDate)}`} label={item.title} {...actions} />
  );
}

export function AchievementCard({ item, ...actions }) {
  return (
    <RecordRow icon={Award} title={item.title} meta={formatMonth(item.date)} label={item.title} {...actions}>
      {item.description}
    </RecordRow>
  );
}
