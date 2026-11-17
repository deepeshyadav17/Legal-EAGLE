import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Check, X, LogOut, Send, Clock, MapPin, Users, Loader2,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Avatar from '../../components/common/Avatar';
import PracticeAreaBadge from '../../components/common/PracticeAreaBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  getLawyerMemberships,
  acceptInvitation,
  declineInvitation,
  requestToJoin,
  withdrawRequest,
  leaveFirm,
} from '../../services/membershipService';

export default function LawyerFirmMembership() {
  useDocumentTitle('Firm Membership');
  const { user } = useAuth();
  const { notify } = useToast();
  const [busyId, setBusyId] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => getLawyerMemberships(user.profileId),
    [user.profileId],
  );

  const runAction = async (id, fn, message, type = 'success') => {
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

  const { active, invitations, requests, allFirms } = data;
  const pendingFirmIds = new Set([
    ...invitations.map((i) => i.firmId),
    ...requests.map((r) => r.firmId),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organization Affiliation"
        title="Firm Membership"
        description="Manage your law firm affiliation, respond to invitations, or request to join a registered law firm."
      />

      {/* Active Firm Section */}
      <section className="card p-6" aria-labelledby="active-firm-heading">
        <h2 id="active-firm-heading" className="text-lg font-semibold text-navy">
          Current Firm Affiliation
        </h2>
        {active ? (
          <div className="mt-4 flex flex-col justify-between gap-4 rounded-2xl border border-gold/40 bg-gold-100/40 p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Avatar name={active.firm.name} src={active.firm.logo} size="md" square />
              <div>
                <span className="badge bg-emerald-100 text-emerald-900">Active Member</span>
                <Link to={`/firms/${active.firm.id}`} className="mt-1 block text-lg font-semibold text-navy hover:underline">
                  {active.firm.name}
                </Link>
                <p className="text-xs text-muted">
                  {active.firm.city} · Est. {active.firm.established} · {active.firm.activeMemberCount} active lawyers
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/firms/${active.firm.id}`} className="btn btn-outline btn-sm">
                View Firm Page
              </Link>
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className="btn btn-danger-outline btn-sm"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" /> Leave Firm
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-cream/60 p-5 text-sm text-muted">
            You are currently listed as an <strong>Independent Practitioner</strong>. Accept an invitation below or request to join a firm to link your profile to a law firm.
          </p>
        )}
      </section>

      {/* Pending Firm Invitations */}
      <section className="card p-6" aria-labelledby="invitations-heading">
        <h2 id="invitations-heading" className="flex items-center gap-2 text-lg font-semibold text-navy">
          Invitations from Law Firms
          <span className="badge bg-cream text-muted">{invitations.length}</span>
        </h2>
        {invitations.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={inv.firm.name} src={inv.firm.logo} size="sm" square />
                  <div>
                    <Link to={`/firms/${inv.firm.id}`} className="font-semibold text-navy hover:underline">
                      {inv.firm.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {inv.firm.city} · Invited you to join their team directory
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busyId || !!active}
                    title={active ? 'Leave your current firm before accepting another invitation' : undefined}
                    onClick={() =>
                      runAction(inv.id, () => acceptInvitation(inv.id), `You are now an active member of ${inv.firm.name}.`)
                    }
                    className="btn btn-primary btn-sm"
                  >
                    {busyId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() =>
                      runAction(inv.id, () => declineInvitation(inv.id), `Declined invitation from ${inv.firm.name}.`, 'info')
                    }
                    className="btn btn-outline btn-sm"
                  >
                    <X className="h-4 w-4" aria-hidden="true" /> Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No pending invitations from law firms.</p>
        )}
      </section>

      {/* Sent Join Requests */}
      {requests.length > 0 && (
        <section className="card p-6" aria-labelledby="sent-requests-heading">
          <h2 id="sent-requests-heading" className="flex items-center gap-2 text-lg font-semibold text-navy">
            Your Pending Join Requests
            <span className="badge bg-cream text-muted">{requests.length}</span>
          </h2>
          <ul className="mt-4 space-y-3">
            {requests.map((req) => (
              <li
                key={req.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={req.firm.name} src={req.firm.logo} size="sm" square />
                  <div>
                    <Link to={`/firms/${req.firm.id}`} className="font-semibold text-navy hover:underline">
                      {req.firm.name}
                    </Link>
                    <p className="flex items-center gap-1 text-xs text-amber-800">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Awaiting approval from firm representative
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!!busyId}
                  onClick={() =>
                    runAction(req.id, () => withdrawRequest(req.id), `Withdrew join request to ${req.firm.name}.`, 'info')
                  }
                  className="btn btn-danger-outline btn-sm self-start sm:self-auto"
                >
                  Withdraw Request
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Request to Join a Firm */}
      <section className="card p-6" aria-labelledby="browse-firms-heading">
        <h2 id="browse-firms-heading" className="flex items-center gap-2 text-lg font-semibold text-navy">
          <Building2 className="h-5 w-5 text-gold-600" aria-hidden="true" /> Request to Join a Law Firm
        </h2>
        <p className="mt-1 text-xs text-muted">
          One active firm affiliation is supported per lawyer in the MVP. Your personal profile remains under your control.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {allFirms.map((firm) => {
            const isCurrent = active?.firm.id === firm.id;
            const isPending = pendingFirmIds.has(firm.id);
            return (
              <div key={firm.id} className="flex flex-col justify-between rounded-2xl border border-line p-4">
                <div>
                  <div className="flex items-start gap-3">
                    <Avatar name={firm.name} src={firm.logo} size="sm" square />
                    <div className="min-w-0 flex-1">
                      <Link to={`/firms/${firm.id}`} className="block truncate font-semibold text-navy hover:underline">
                        {firm.name}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden="true" /> {firm.city}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" aria-hidden="true" /> {firm.activeMemberCount} active
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {firm.practiceAreas.slice(0, 3).map((s) => (
                      <PracticeAreaBadge key={s} slug={s} />
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-line pt-3">
                  {isCurrent ? (
                    <span className="text-xs font-semibold text-emerald-700">Currently affiliated</span>
                  ) : isPending ? (
                    <span className="text-xs font-medium text-amber-800">Pending invitation or request</span>
                  ) : (
                    <button
                      type="button"
                      disabled={!!active || !!busyId}
                      onClick={() =>
                        runAction(firm.id, () => requestToJoin(user.profileId, firm.id), `Join request sent to ${firm.name}.`)
                      }
                      className="btn btn-outline btn-sm w-full"
                    >
                      {busyId === firm.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {active ? 'Leave current firm to request' : 'Request to Join'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={async () => {
          await leaveFirm(active.id);
          notify(`You have left ${active.firm.name}.`, 'info');
          await reload(true);
        }}
        title={`Leave ${active?.firm.name}?`}
        message="You will be removed from the firm’s public team directory and listed as an independent practitioner."
        confirmLabel="Leave Firm"
      />
    </div>
  );
}

