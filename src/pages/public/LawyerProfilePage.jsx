import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MapPin, Briefcase, Building2, Languages, GraduationCap, BadgeCheck, Award,
  ArrowLeft, UserPen, ArrowRight, CalendarCheck, Video, Users,
} from 'lucide-react';
import ProfileHeader from '../../components/lawyer/ProfileHeader';
import ContactSection from '../../components/lawyer/ContactSection';
import {
  EducationCard, ExperienceCard, QualificationCard, AchievementCard,
} from '../../components/lawyer/RecordCards';
import PracticeAreaBadge from '../../components/common/PracticeAreaBadge';
import SaveButton from '../../components/common/SaveButton';
import Avatar from '../../components/common/Avatar';
import MediaGallery from '../../components/profile/MediaGallery';
import { ProfileSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { getLawyer } from '../../services/lawyerService';
import { recordView } from '../../services/clientService';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatINR, MODE_LABEL, yearsLabel } from '../../utils/format';

export default function LawyerProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: lawyer, loading, error, reload } = useAsync(() => getLawyer(id), [id]);

  useDocumentTitle(lawyer?.name || 'Advocate Profile');

  useEffect(() => {
    if (lawyer && user?.role === 'client') {
      recordView(user.profileId, 'lawyer', lawyer.id);
    }
  }, [lawyer, user]);

  if (loading) return <ProfileSkeleton />;
  if (error || !lawyer) {
    return (
      <div className="container-page py-12">
        <ErrorState
          title="Lawyer profile not found"
          error={error}
          onRetry={reload}
        />
        <div className="mt-4 text-center">
          <Link to="/search?tab=lawyers" className="btn btn-outline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to lawyer directory
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.role === 'lawyer' && user.profileId === lawyer.id;

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-4">
        <Link to="/search?tab=lawyers" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Lawyers
        </Link>
      </div>

      <ProfileHeader
        name={lawyer.name}
        photo={lawyer.photo}
        subtitle={lawyer.headline}
        seed={lawyer.id}
        meta={[
          { icon: MapPin, label: lawyer.city },
          { icon: Briefcase, label: yearsLabel(lawyer.experienceYears) },
          lawyer.firm
            ? { icon: Building2, label: `Affiliated with ${lawyer.firm.name}` }
            : { icon: Building2, label: 'Independent Practice' },
          lawyer.languages?.length > 0 && { icon: Languages, label: lawyer.languages.join(', ') },
        ]}
        badges={lawyer.practiceAreas.map((slug, idx) => (
          <PracticeAreaBadge key={slug} slug={slug} linked primary={idx === 0} withIcon />
        ))}
        actions={
          <>
            <SaveButton type="lawyer" id={lawyer.id} name={lawyer.name} variant="button" />
            <Link to={`/lawyers/${lawyer.id}/book`} className="btn btn-gold">
              <CalendarCheck className="h-4 w-4" aria-hidden="true" /> Book Consultation · {formatINR(lawyer.consultation?.fee ?? 1500)}
            </Link>
            {isOwner && (
              <Link to="/lawyer/edit-profile" className="btn btn-primary">
                <UserPen className="h-4 w-4" aria-hidden="true" /> Edit Profile
              </Link>
            )}
          </>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main Portfolio Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* About */}
          <section className="card p-6" aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-lg font-semibold">About</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">
              {lawyer.about || 'No professional summary has been added to this profile yet.'}
            </p>
          </section>

          {/* Practice Areas */}
          <section className="card p-6" aria-labelledby="practices-heading">
            <h2 id="practices-heading" className="text-lg font-semibold">Areas of Practice</h2>
            <p className="mt-1 text-xs text-muted">Click any specialization to find other professionals in that area.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {lawyer.practiceAreas.map((slug, idx) => (
                <PracticeAreaBadge key={slug} slug={slug} linked primary={idx === 0} withIcon />
              ))}
            </div>
          </section>

          <MediaGallery profileType="lawyer" profileId={lawyer.id} />

          {/* Work Experience */}
          <section className="card p-6" aria-labelledby="experience-heading">
            <h2 id="experience-heading" className="flex items-center gap-2 text-lg font-semibold">
              <Briefcase className="h-5 w-5 text-gold-600" aria-hidden="true" /> Work Experience
            </h2>
            {lawyer.experience?.length > 0 ? (
              <ul className="mt-4 divide-y divide-line">
                {lawyer.experience.map((item) => (
                  <ExperienceCard key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No work experience records listed.</p>
            )}
          </section>

          {/* Education */}
          <section className="card p-6" aria-labelledby="education-heading">
            <h2 id="education-heading" className="flex items-center gap-2 text-lg font-semibold">
              <GraduationCap className="h-5 w-5 text-gold-600" aria-hidden="true" /> Education
            </h2>
            {lawyer.education?.length > 0 ? (
              <ul className="mt-4 divide-y divide-line">
                {lawyer.education.map((item) => (
                  <EducationCard key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No educational records listed.</p>
            )}
          </section>

          {/* Professional Qualifications */}
          <section className="card p-6" aria-labelledby="qualifications-heading">
            <h2 id="qualifications-heading" className="flex items-center gap-2 text-lg font-semibold">
              <BadgeCheck className="h-5 w-5 text-gold-600" aria-hidden="true" /> Professional Qualifications
            </h2>
            {lawyer.qualifications?.length > 0 ? (
              <ul className="mt-4 divide-y divide-line">
                {lawyer.qualifications.map((item) => (
                  <QualificationCard key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No professional qualifications listed.</p>
            )}
          </section>

          {/* Achievements */}
          <section className="card p-6" aria-labelledby="achievements-heading">
            <h2 id="achievements-heading" className="flex items-center gap-2 text-lg font-semibold">
              <Award className="h-5 w-5 text-gold-600" aria-hidden="true" /> Achievements & Seminars
            </h2>
            {lawyer.achievements?.length > 0 ? (
              <ul className="mt-4 divide-y divide-line">
                {lawyer.achievements.map((item) => (
                  <AchievementCard key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No achievements listed.</p>
            )}
          </section>
        </div>

        {/* Right Sidebar */}
        <aside className="space-y-6">
          {/* Book 1-Hour Consultation Card */}
          <section className="card border-gold/50 bg-gradient-to-br from-white to-gold-100/40 p-6" aria-labelledby="book-card-heading">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="eyebrow">1-Hour Consultation</p>
                <h2 id="book-card-heading" className="mt-0.5 text-xl font-semibold text-navy">
                  {formatINR(lawyer.consultation?.fee ?? 1500)}{' '}
                  <span className="text-xs font-normal text-muted">/ 60 mins</span>
                </h2>
              </div>
              <span className="badge border border-gold/40 bg-white text-navy">IST</span>
            </div>

            <div className="mt-4 space-y-2 text-xs text-ink">
              <p className="font-semibold text-navy">Offered Meeting Modes:</p>
              <div className="flex flex-wrap gap-2">
                {(lawyer.consultation?.availableModes || ['ONLINE', 'IN_PERSON']).map((m) => (
                  <span key={m} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 font-medium text-navy">
                    {m === 'ONLINE' ? (
                      <Video className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                    ) : (
                      <Users className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                    )}
                    {MODE_LABEL[m] || m}
                  </span>
                ))}
              </div>
              {lawyer.consultation?.availableModes?.includes('IN_PERSON') && lawyer.consultation?.officeLocation && (
                <p className="mt-2 text-muted">
                  <strong>Office:</strong> {lawyer.consultation.officeLocation}
                </p>
              )}
            </div>

            <Link to={`/lawyers/${lawyer.id}/book`} className="btn btn-primary mt-5 w-full">
              <CalendarCheck className="h-4 w-4" aria-hidden="true" /> Book Consultation
            </Link>
            {isOwner && (
              <Link to="/lawyer/availability" className="btn btn-outline btn-sm mt-2 w-full">
                Manage My Availability Slots
              </Link>
            )}
          </section>

          <ContactSection lawyerId={lawyer.id} lawyerName={lawyer.name} />

          {/* Firm Affiliation */}
          <section className="card p-6" aria-labelledby="affiliation-heading">
            <h2 id="affiliation-heading" className="text-lg font-semibold">Firm Affiliation</h2>
            {lawyer.firm ? (
              <Link
                to={`/firms/${lawyer.firm.id}`}
                className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-cream/60 p-3.5 transition hover:border-gold hover:bg-gold-100/50"
              >
                <Avatar name={lawyer.firm.name} src={lawyer.firm.logo} size="sm" square />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{lawyer.firm.name}</p>
                  <p className="text-xs text-muted">View Law Firm Profile</p>
                </div>
                <ArrowRight className="h-4 w-4 text-navy" aria-hidden="true" />
              </Link>
            ) : (
              <p className="mt-3 rounded-xl border border-line bg-cream/50 p-4 text-sm text-muted">
                Independent legal practitioner — not currently affiliated with a law firm on Legal Eagle.
              </p>
            )}
          </section>

          {/* Languages & Overview */}
          <section className="card p-6" aria-labelledby="details-heading">
            <h2 id="details-heading" className="text-lg font-semibold">Practice Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-2 border-b border-line pb-2.5">
                <dt className="text-muted">Primary City</dt>
                <dd className="font-medium text-navy">{lawyer.city}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-line pb-2.5">
                <dt className="text-muted">Experience</dt>
                <dd className="font-medium text-navy">{yearsLabel(lawyer.experienceYears)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Languages</dt>
                <dd className="text-right font-medium text-navy">
                  {lawyer.languages?.length ? lawyer.languages.join(', ') : 'English'}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
