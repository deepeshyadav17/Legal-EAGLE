import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../utils/format';

/**
 * Labelled form control with error/hint messaging.
 * as: 'input' | 'select' | 'textarea' | 'password'
 */
export default function FormField({ label, as = 'input', error, hint, required, options = [], placeholder, className = '', id: idProp, ...props }) {
  const autoId = useId();
  const id = idProp || `${props.name || 'field'}-${autoId}`;
  const [show, setShow] = useState(false);
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    'aria-invalid': !!error,
    'aria-describedby': describedBy,
    'aria-required': required || undefined,
    className: cn('input', error && 'input-error'),
    placeholder,
    ...props,
  };

  let control;
  if (as === 'select') {
    control = (
      <select {...common}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  } else if (as === 'textarea') {
    control = <textarea rows={4} {...common} className={cn(common.className, 'resize-y')} />;
  } else if (as === 'password') {
    control = (
      <div className="relative">
        <input {...common} type={show ? 'text' : 'password'} className={cn(common.className, 'pr-11')} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-navy"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  } else {
    control = <input type="text" {...common} />;
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label} {required && <span className="text-red-600" aria-hidden="true">*</span>}
        </label>
      )}
      {control}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-700" role="alert">{error}</p>}
    </div>
  );
}
