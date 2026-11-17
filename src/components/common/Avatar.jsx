import { cn, gradientFor, initials } from '../../utils/format';

const SIZES = {
  xs: 'h-8 w-8 text-xs',
  sm: 'h-11 w-11 text-sm',
  md: 'h-14 w-14 text-base',
  lg: 'h-20 w-20 text-xl',
  xl: 'h-28 w-28 sm:h-36 sm:w-36 text-3xl sm:text-4xl',
};

/**
 * Photo or monogram avatar. `square` is used for firm logos.
 * Seed profiles have no photos (fictional people), so monograms are shown.
 */
export default function Avatar({ name = '', src, size = 'md', square = false, className = '', alt }) {
  const shape = square ? 'rounded-xl' : 'rounded-full';
  if (src) {
    return <img src={src} alt={alt ?? `${name} ${square ? 'logo' : 'profile photo'}`} className={cn(SIZES[size], shape, 'shrink-0 object-cover', className)} />;
  }
  return (
    <span
      role="img"
      aria-label={alt ?? `${name} ${square ? 'logo' : 'avatar'}`}
      className={cn(SIZES[size], shape, 'grid shrink-0 place-items-center font-semibold text-white', className)}
      style={{ background: gradientFor(name) }}
    >
      <span aria-hidden="true" className={square ? 'font-serif text-gold-100' : ''}>{initials(name)}</span>
    </span>
  );
}
