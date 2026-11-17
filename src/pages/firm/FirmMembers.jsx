import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserMinus, UserPlus, Users, Loader2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MemberCard from '../../components/firm/MemberCard';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getFirmMemberships, inviteLawyer, removeMember } from '../../services/membershipService';
import { listLawyers } from '../../services/lawyerService';

export default function FirmMembers() {
  useDocumentTitle('Firm Team Members');
  const { user } = useAuth();
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState(null);
  const [invitingId, setInvitingId] = useState('');

  const { data, loading, error, reload } = useAsync(
    async () => {
      const [memberships, allLawyers] = await Promise.all([
        getFirmMemberships(user.profileId),
        listLawyers(),
      ]);
      return { memberships, allLawyers };
    },
    [user.profileId],
  );

  const handleInvite = async (lawyer) => {
    setInvitingId(lawyer.id);
    try {
      await inviteLawyer(user.profileId, lawyer.id);
      notify(`Invitation sent to ${lawyer.name}.`);
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setInvitingId('');
    }
  };

  const handleConfirmRemove = async () => {
    if (!removing) return;
    try {
      await removeMember(removing.id);
      notify(`${removing.lawyer.name} removed from active firm members.`, 'info');
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  if (loading) return <LineSkeleton lines={5} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const { memberships, allLawyers } = data;
  const activeIds = new Set(memberships.active.map((m) => m.lawyerId));
  const pendingIds = new Set([
    ...memberships.requests.map((m) => m.lawyerId),
    ...memberships.invitations.map((m) => m.lawyerId),
  ]);

  const term = query.trim().toLowerCase();
  const filteredLawyers = allLawyers.filter(
    (l) => !term || l.name.toLowerCase().includes(term) || l.city.toLowerCase().includes(term),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Team Management"
        title="Firm Members & Invitations"
        description="Manage your active lawyers or invite registered advocates to join your firm."
        actions={
          <Link to={`/firms/${user.profileId}`} className="btn btn-outline btn-sm">
            View Public Team Count ({memberships.active.length})
          </Link>
        }
      />

      {/* Active Members List */}
      <section className="card p-6" aria-labelledby="active-members-heading">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 id="active-members-heading" className="flex items-center gap-2 text-lg font-semibold text-navy">
              <Users className="h-5 w-5 text-gold-600" aria-hidden="true" /> Active Lawyers
              <span className="badge bg-cream text-muted">{memberships.active.length}</span>
            </h2>
            <p className="text-xs text-muted">
              Removing a member updates your firm’s public lawyer count immediately without deleting the lawyer’s personal profile.
            </p>
          </div>
        </div>

        {memberships.active.length > 0 ? (
          <div className="space-y-3">
            {memberships.active.map((m) => (
              <MemberCard
                key={m.id}
                lawyer={m.lawyer}
                actions={
                  <>
                    <Link to={`/lawyers/${m.lawyer.id}`} className="btn btn-outline btn-sm">
                      View Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => setRemoving(m)}
                      className="btn btn-danger-outline btn-sm"
                    >
                      <UserMinus className="h-4 w-4" aria-hidden="true" /> Remove
                    </button>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No active members"
            message="Invite lawyers below or approve pending join requests to build your firm’s team directory."
          />
        )}
      </section>

      {/* Invite Registered Lawyers */}
      <section className="card p-6" aria-labelledby="invite-lawyers-heading">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 id="invite-lawyers-heading" className="text-lg font-semibold text-navy">
              Invite Registered Lawyers
            </h2>
            <p className="text-xs text-muted">
              Search advocates on Legal Eagle by name or city to send a firm membership invitation.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or city…"
              aria-label="Search registered lawyers"
              className="input pl-9"
            />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {filteredLawyers.map((lawyer) => {
            const isMember = activeIds.has(lawyer.id);
            const isPending = pendingIds.has(lawyer.id);
            const inOtherFirm = lawyer.firm && lawyer.firm.id !== user.profileId;

            return (
              <MemberCard
                key={lawyer.id}
                lawyer={lawyer}
                note={lawyer.firm ? `Affiliated: ${lawyer.firm.name}` : 'Independent'}
                actions={
                  isMember ? (
                    <span className="badge bg-emerald-100 text-emerald-900">Active Member</span>
                  ) : isPending ? (
                    <Link to="/firm/requests" className="badge border border-amber-300 bg-amber-50 text-amber-900 hover:underline">
                      Pending in Requests
                    </Link>
                  ) : inOtherFirm ? (
                    <span className="badge bg-cream text-muted" title="MVP supports one active firm per lawyer">
                      In {lawyer.firm.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={invitingId === lawyer.id}
                      onClick={() => handleInvite(lawyer)}
                      className="btn btn-primary btn-sm"
                    >
                      {invitingId === lawyer.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                      )}
                      Invite to Firm
                    </button>
                  )
                }
              />
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={handleConfirmRemove}
        title={`Remove ${removing?.lawyer.name}?`}
        message={`${removing?.lawyer.name} will be removed from your firm’s public team directory and your active lawyer count will decrease by one.`}
        confirmLabel="Remove Member"
      />
    </div>
  );
}

