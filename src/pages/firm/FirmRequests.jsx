import { useState } from 'react';
import { Inbox, Send, Check, X, Loader2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MemberCard from '../../components/firm/MemberCard';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  getFirmMemberships,
  approveRequest,
  rejectRequest,
  cancelInvitation,
} from '../../services/membershipService';

export default function FirmRequests() {
  useDocumentTitle('Requests & Invitations');
  const { user } = useAuth();
  const { notify } = useToast();
  const [busyId, setBusyId] = useState('');

  const { data, loading, error, reload } = useAsync(
    () => getFirmMemberships(user.profileId),
    [user.profileId],
  );

  const handleAction = async (id, fn, message, type = 'success') => {
    setBusyId(id);
    try {
      await fn();
      notify(message, type);
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyId('');
    }
  };

  if (loading) return <LineSkeleton lines={4} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const { requests, invitations } = data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Membership Workflow"
        title="Requests & Invitations"
        description="Approve or reject incoming lawyer join requests, and manage invitations sent by your firm."
      />

      {/* Incoming Join Requests */}
      <section className="card p-6" aria-labelledby="incoming-requests-heading">
        <h2 id="incoming-requests-heading" className="flex items-center gap-2 text-lg font-semibold text-navy">
          <Inbox className="h-5 w-5 text-gold-600" aria-hidden="true" /> Incoming Join Requests
          <span className="badge bg-cream text-muted">{requests.length}</span>
        </h2>
        <p className="mt-1 text-xs text-muted">
          Lawyers who have requested to join your firm. Approving a request adds them to your public team immediately.
        </p>

        {requests.length > 0 ? (
          <div className="mt-5 space-y-3">
            {requests.map((req) => (
              <MemberCard
                key={req.id}
                lawyer={req.lawyer}
                note="Requested to join your firm"
                actions={
                  <>
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() =>
                        handleAction(
                          req.id,
                          () => approveRequest(req.id),
                          `${req.lawyer.name} approved and added to your active team.`,
                        )
                      }
                      className="btn btn-primary btn-sm"
                    >
                      {busyId === req.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() =>
                        handleAction(
                          req.id,
                          () => rejectRequest(req.id),
                          `Rejected join request from ${req.lawyer.name}.`,
                          'info',
                        )
                      }
                      className="btn btn-danger-outline btn-sm"
                    >
                      <X className="h-4 w-4" aria-hidden="true" /> Reject
                    </button>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-line bg-cream/60 p-6 text-center text-sm text-muted">
            No pending join requests from lawyers.
          </p>
        )}
      </section>

      {/* Sent Invitations */}
      <section className="card p-6" aria-labelledby="sent-invitations-heading">
        <h2 id="sent-invitations-heading" className="flex items-center gap-2 text-lg font-semibold text-navy">
          <Send className="h-5 w-5 text-gold-600" aria-hidden="true" /> Sent Invitations
          <span className="badge bg-cream text-muted">{invitations.length}</span>
        </h2>
        <p className="mt-1 text-xs text-muted">
          Invitations sent by your firm awaiting response from the lawyer.
        </p>

        {invitations.length > 0 ? (
          <div className="mt-5 space-y-3">
            {invitations.map((inv) => (
              <MemberCard
                key={inv.id}
                lawyer={inv.lawyer}
                note="Invitation pending lawyer acceptance"
                actions={
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() =>
                      handleAction(
                        inv.id,
                        () => cancelInvitation(inv.id),
                        `Cancelled invitation to ${inv.lawyer.name}.`,
                        'info',
                      )
                    }
                    className="btn btn-outline btn-sm"
                  >
                    {busyId === inv.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Cancel Invitation
                  </button>
                }
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-line bg-cream/60 p-6 text-center text-sm text-muted">
            No pending outgoing invitations. Visit the Members tab to invite registered lawyers.
          </p>
        )}
      </section>
    </div>
  );
}

