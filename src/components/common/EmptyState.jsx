import { SearchX, AlertOctagon, RotateCcw } from 'lucide-react';

export function EmptyState({ icon: Icon = SearchX, title, message, description, action }) {
  const text = message || description;
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center animate-fade-up">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gold-100 text-gold-600">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1.5 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <div role="alert" className="card flex flex-col items-center border-red-100 px-6 py-14 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-700">
        <AlertOctagon className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">{error?.message || 'Please try again.'}</p>
      {onRetry && (
        <button type="button" onClick={() => onRetry()} className="btn btn-outline mt-5">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}

export default EmptyState;
