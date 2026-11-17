/** Shimmer placeholders used while mock requests resolve. */
export function CardSkeleton() {
  return (
    <div className="card p-5" aria-hidden="true">
      <div className="flex items-center gap-4">
        <div className="skeleton h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-4/5" />
      </div>
      <div className="skeleton mt-5 h-9 w-full rounded-lg" />
    </div>
  );
}

export function GridSkeleton({ count = 6, className = 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3' }) {
  return (
    <div className={className} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="container-page py-8" role="status" aria-label="Loading profile">
      <div className="card overflow-hidden">
        <div className="skeleton h-40 rounded-none sm:h-56" />
        <div className="p-6">
          <div className="skeleton -mt-20 h-32 w-32 rounded-full border-4 border-white" />
          <div className="skeleton mt-4 h-6 w-64" />
          <div className="skeleton mt-2 h-4 w-96 max-w-full" />
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {[1, 2].map((i) => <div key={i} className="card skeleton h-40" />)}
        </div>
        <div className="card skeleton h-60" />
      </div>
    </div>
  );
}

export function LineSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => <div key={i} className="skeleton h-12 w-full" />)}
    </div>
  );
}

export default GridSkeleton;
