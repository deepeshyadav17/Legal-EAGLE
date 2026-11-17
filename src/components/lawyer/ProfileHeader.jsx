import Avatar from '../common/Avatar';
import { gradientFor } from '../../utils/format';

/**
 * LinkedIn-style profile header used by both lawyer and firm profiles.
 * `meta` is an array of { icon, label } items.
 */
export default function ProfileHeader({ name, photo, cover, title, subtitle, meta = [], badges, actions, square = false, seed }) {
  return (
    <header className="card overflow-hidden">
      <div
        className="relative h-36 sm:h-52"
        style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: gradientFor(seed || name) }}
        role="img"
        aria-label={cover ? `${name} cover image` : 'Decorative cover banner'}
      >
        {!cover && (
          <div className="grid-lines absolute inset-0 opacity-70">
            <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
          </div>
        )}
      </div>
      <div className="relative px-5 pb-6 sm:px-8">
        <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
          <Avatar name={name} src={photo} size="xl" square={square} className="border-4 border-white shadow-lift" />
          {actions && <div className="flex flex-wrap gap-2 sm:pb-2">{actions}</div>}
        </div>
        <div className="mt-4">
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">{title || name}</h1>
          {subtitle && <p className="mt-1 text-base text-ink">{subtitle}</p>}
          {meta.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {meta.filter(Boolean).map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                </li>
              ))}
            </ul>
          )}
          {badges && <div className="mt-4 flex flex-wrap gap-2">{badges}</div>}
        </div>
      </div>
    </header>
  );
}
