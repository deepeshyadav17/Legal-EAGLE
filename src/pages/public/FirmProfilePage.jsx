import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MapPin, CalendarDays, Users, Globe, Mail, Phone, ArrowLeft, UserPen, Building2,
} from 'lucide-react';
import ProfileHeader from '../../components/lawyer/ProfileHeader';
import LawyerCard from '../../components/lawyer/LawyerCard';
import PracticeAreaBadge from '../../components/common/PracticeAreaBadge';
import SaveButton from '../../components/common/SaveButton';
import DemoBadge from '../../components/common/DemoBadge';
import MediaGallery from '../../components/profile/MediaGallery';
import { ProfileSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import { getFirm } from '../../services/firmService';
import { recordView } from '../../services/clientService';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export default function FirmProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: firm, loading, error, reload } = useAsync(() => getFirm(id), [id]);

  useDocumentTitle(firm?.name || 'Law Firm Profile');

  useEffect(() => {
    if (firm && user?.role === 'client') {
      recordView(user.profileId, 'firm', firm.id);
    }
  }, [firm, user]);

  if (loading) return <ProfileSkeleton />;
  if (error || !firm) {
    return (
      <div className="container-page py-12">
        <ErrorState title="Law firm profile not found" error={error} onRetry={reload} />
        <div className="mt-4 text-center">
          <Link to="/search?tab=firms" className="btn btn-outline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to law firms
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.role === 'firm' && user.profileId === firm.id;

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-4">
        <Link to="/search?tab=firms" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Law Firms
        </Link>
      </div>

      <ProfileHeader
        name={firm.name}
        photo={firm.logo}
        cover={firm.cover}
        square
        seed={firm.id}
        subtitle={firm.address || firm.city}
        meta={[
          { icon: MapPin, label: firm.city },
          { icon: CalendarDays, label: `Established ${firm.established}` },
          {
            icon: Users,
            label: `${firm.activeMemberCount} active ${firm.activeMemberCount === 1 ? 'lawyer' : 'lawyers'}`,
          },
        ]}
        badges={firm.practiceAreas.map((slug, idx) => (
          <PracticeAreaBadge key={slug} slug={slug} linked primary={idx === 0} withIcon />
        ))}
        actions={
          <>
            <SaveButton type="firm" id={firm.id} name={firm.name} variant="button" />
            {isOwner && (
              <Link to="/firm/edit-profile" className="btn btn-primary">
                <UserPen className="h-4 w-4" aria-hidden="true" /> Edit Firm Profile
              </Link>
            )}
          </>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* About the Firm */}
          <section className="card p-6" aria-labelledby="firm-about-heading">
            <h2 id="firm-about-heading" className="text-lg font-semibold">About the Firm</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">
              {firm.about || 'No organization description has been added yet.'}
            </p>
          </section>

          {/* Practice Areas */}
          <section className="card p-6" aria-labelledby="firm-practices-heading">
            <h2 id="firm-practices-heading" className="text-lg font-semibold">Practice Areas</h2>
            <p className="mt-1 text-xs text-muted">
              Legal services and specializations covered by {firm.name}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {firm.practiceAreas.map((slug, idx) => (
                <PracticeAreaBadge key={slug} slug={slug} linked primary={idx === 0} withIcon />
              ))}
            </div>
          </section>

          <MediaGallery profileType="firm" profileId={firm.id} />

          {/* Our Team */}
          <section className="card p-6" aria-labelledby="firm-team-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="firm-team-heading" className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="h-5 w-5 text-gold-600" aria-hidden="true" /> Our Team
                  <span className="badge bg-cream text-muted">{firm.activeMemberCount}</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Only approved active members of {firm.name} appear in this public directory.
                </p>
              </div>
              {isOwner && (
                <Link to="/firm/members" className="btn btn-outline btn-sm">
                  Manage members
                </Link>
              )}
            </div>

            {firm.members.length > 0 ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {firm.members.map((lawyer) => (
                  <LawyerCard key={lawyer.id} lawyer={lawyer} />
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  icon={Building2}
                  title="No active lawyers listed yet"
                  message="Approved firm lawyers will automatically appear here once their membership is active."
                />
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <section className="card p-6" aria-labelledby="firm-contact-heading">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="firm-contact-heading" className="text-lg font-semibold">Organization Details</h2>
              <DemoBadge label="Demo" />
            </div>
            <dl className="space-y-3.5 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Office Location</dt>
                <dd className="mt-1 flex items-start gap-2 font-medium text-ink">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                  <span>{firm.address || firm.city}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Established</dt>
                <dd className="mt-1 flex items-center gap-2 font-medium text-ink">
                  <CalendarDays className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                  <span>{firm.established}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">Active Team Size</dt>
                <dd className="mt-1 flex items-center gap-2 font-medium text-ink">
                  <Users className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                  <span>
                    {firm.activeMemberCount} {firm.activeMemberCount === 1 ? 'Advocate' : 'Advocates'} (derived from active memberships)
                  </span>
                </dd>
              </div>
              {firm.email && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">Official Email</dt>
                  <dd className="mt-1 flex items-center gap-2 font-medium text-navy">
                    <Mail className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                    <a href={`mailto:${firm.email}`} className="break-all hover:underline">{firm.email}</a>
                  </dd>
                </div>
              )}
              {firm.phone && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">Office Phone</dt>
                  <dd className="mt-1 flex items-center gap-2 font-medium text-navy">
                    <Phone className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                    <a href={`tel:${firm.phone.replace(/\s/g, '')}`} className="hover:underline">{firm.phone}</a>
                  </dd>
                </div>
              )}
              {firm.website && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">Website</dt>
                  <dd className="mt-1 flex items-center gap-2 font-medium text-navy">
                    <Globe className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                    <span>{firm.website}</span>
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-4 rounded-lg bg-cream p-3 text-xs text-muted">
              Fictional organization details for frontend demonstration only.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
