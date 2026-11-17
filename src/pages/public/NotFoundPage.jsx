import { Link } from 'react-router-dom';
import { Compass, Home, Search } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page Not Found');

  return (
    <div className="container-page flex min-h-[65vh] items-center justify-center py-16">
      <div className="card max-w-lg p-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gold-100 text-gold-600">
          <Compass className="h-8 w-8" aria-hidden="true" />
        </span>
        <p className="eyebrow mt-4">404 Error</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-navy sm:text-3xl">
          Page Not Found
        </h1>
        <p className="mt-2 text-sm text-muted">
          The page or profile you are looking for does not exist or may have been moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn btn-primary">
            <Home className="h-4 w-4" aria-hidden="true" /> Back to Home
          </Link>
          <Link to="/search" className="btn btn-outline">
            <Search className="h-4 w-4" aria-hidden="true" /> Search Directory
          </Link>
        </div>
      </div>
    </div>
  );
}

