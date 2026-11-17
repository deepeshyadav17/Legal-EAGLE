import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal from './Modal';

/** Confirmation dialog. `onConfirm` may be async; the dialog shows a busy state. */
export default function ConfirmDialog({ open, onClose, onConfirm, title, message, description, confirmLabel = 'Confirm', danger = true }) {
  const [busy, setBusy] = useState(false);
  const text = message || description;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy} data-autofocus>
            Cancel
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={handleConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${danger ? 'bg-red-50 text-red-700' : 'bg-gold-100 text-gold-600'}`}>
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm leading-relaxed text-ink">{text}</p>
      </div>
    </Modal>
  );
}
