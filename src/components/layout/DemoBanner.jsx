import { useState } from 'react';
import { FlaskConical, RotateCcw, X } from 'lucide-react';
import { resetDb } from '../../services/mockDb';
import ConfirmDialog from '../common/ConfirmDialog';

/** Global Demo Mode strip with a reset-data action. */
export default function DemoBanner() {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('le-hide-demo') === '1');
  const [confirm, setConfirm] = useState(false);
  if (hidden) return null;

  return (
    <div className="bg-amber-50 text-amber-900">
      <div className="container-page flex items-center gap-3 py-2 text-xs sm:text-sm">
        <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="flex-1">
          <strong>Demo Mode:</strong> fictional data stored in your browser. Login and role checks are UI demonstrations, not real security.
        </p>
        <button type="button" onClick={() => setConfirm(true)} className="hidden items-center gap-1 font-semibold underline-offset-2 hover:underline sm:flex">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset demo data
        </button>
        <button type="button" aria-label="Hide demo notice" className="rounded p-1 hover:bg-amber-100" onClick={() => { sessionStorage.setItem('le-hide-demo', '1'); setHidden(true); }}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => { resetDb(); window.location.reload(); }}
        title="Reset demo data?"
        message="All edits, bookmarks, registrations and membership changes made in this browser will be replaced with the original fictional seed data."
        confirmLabel="Reset"
      />
    </div>
  );
}
