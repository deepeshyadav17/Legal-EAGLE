import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, Save } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MediaGallery from '../../components/profile/MediaGallery';
import FormField from '../../components/forms/FormField';
import ImageUpload from '../../components/forms/ImageUpload';
import PracticeAreaPicker from '../../components/forms/PracticeAreaPicker';
import RecordManager from '../../components/lawyer/RecordManager';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getOwnLawyerProfile, updateLawyer, RECORD_SECTIONS } from '../../services/lawyerService';
import { CITIES } from '../../mock/referenceData';
import { rules } from '../../utils/validators';

const cityOptions = CITIES.map((c) => ({ value: c, label: c }));

const SCHEMA = {
  name: [rules.required('Full name'), rules.minLength(2, 'Full name')],
  headline: [rules.required('Professional headline'), rules.minLength(6, 'Headline')],
  city: [rules.required('City')],
  experienceYears: [rules.required('Years of experience'), rules.range(0, 60, 'Years of experience')],
  practiceAreas: [rules.required('Select at least one practice area')],
  about: [rules.maxLength(1200, 'About section')],
};

export default function LawyerEditProfile() {
  useDocumentTitle('Edit Lawyer Profile');
  const { user, updateAccount } = useAuth();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: lawyer, loading, error, reload, setData } = useAsync(
    () => getOwnLawyerProfile(user.profileId),
    [user.profileId],
  );

  const form = useForm(
    {
      name: '',
      headline: '',
      city: '',
      experienceYears: 0,
      practiceAreas: [],
      languagesText: 'English, Hindi',
      about: '',
      photo: '',
    },
    SCHEMA,
  );

  useEffect(() => {
    if (lawyer) {
      form.reset({
        name: lawyer.name,
        headline: lawyer.headline,
        city: lawyer.city,
        experienceYears: lawyer.experienceYears,
        practiceAreas: lawyer.practiceAreas,
        languagesText: (lawyer.languages || ['English']).join(', '),
        about: lawyer.about || '',
        photo: lawyer.photo || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawyer?.id]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!form.validateAll()) return;
    setSaving(true);
    try {
      const languages = form.values.languagesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const updated = await updateLawyer(user.profileId, {
        name: form.values.name.trim(),
        headline: form.values.headline.trim(),
        city: form.values.city,
        experienceYears: Number(form.values.experienceYears),
        practiceAreas: form.values.practiceAreas,
        languages: languages.length ? languages : ['English'],
        about: form.values.about.trim(),
        photo: form.values.photo,
      });
      if (form.values.name.trim() !== user.name) {
        await updateAccount({ name: form.values.name.trim() });
      }
      setData(updated);
      notify('Profile overview saved.');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LineSkeleton lines={6} />;
  if (error || !lawyer) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Portfolio Editor"
        title="Edit Lawyer Profile"
        description="Update your biographical details, practice areas, education, work experience, qualifications and achievements."
        actions={
          <Link to={`/lawyers/${lawyer.id}`} className="btn btn-outline btn-sm">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> View Public Profile
          </Link>
        }
      />

      {/* Primary Profile Information Form */}
      <form onSubmit={handleSaveProfile} noValidate className="card space-y-6 p-6">
        <h2 className="text-lg font-semibold text-navy">Basic Information & Practice Areas</h2>

        <ImageUpload
          label="Profile Photo"
          name={form.values.name || lawyer.name}
          value={form.values.photo}
          onChange={(val) => form.setField('photo', val)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Full Name"
            required
            {...form.field('name')}
          />
          <FormField
            label="Professional Headline"
            required
            placeholder="e.g. Advocate · Criminal & Civil Litigation"
            {...form.field('headline')}
          />
          <FormField
            as="select"
            label="Primary City"
            required
            options={cityOptions}
            {...form.field('city')}
          />
          <FormField
            label="Years of Experience"
            type="number"
            min={0}
            max={60}
            required
            {...form.field('experienceYears')}
          />
          <FormField
            label="Languages Spoken"
            placeholder="English, Hindi, Marathi"
            hint="Comma-separated list of languages"
            className="sm:col-span-2"
            {...form.field('languagesText')}
          />
        </div>

        <PracticeAreaPicker
          label="Legal Practice Areas *"
          value={form.values.practiceAreas}
          onChange={(next) => form.setField('practiceAreas', next)}
          error={form.errors.practiceAreas}
        />

        <FormField
          as="textarea"
          label="About / Professional Summary"
          placeholder="Describe your background, areas of practice and approach to client representation…"
          hint="At least 60 characters recommended for profile completion. Keep descriptions factual."
          {...form.field('about')}
        />

        <div className="flex justify-end border-t border-line pt-4">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save Profile Overview
          </button>
        </div>
      </form>

      <MediaGallery profileType="lawyer" profileId={lawyer.id} editable />

      {/* Structured Record Managers (Education, Experience, Qualifications, Achievements) */}
      <div className="space-y-6">
        {RECORD_SECTIONS.map((section) => (
          <RecordManager
            key={section}
            lawyerId={lawyer.id}
            section={section}
            items={lawyer[section] || []}
            onChange={(nextItems) => setData((prev) => ({ ...prev, [section]: nextItems }))}
          />
        ))}
      </div>
    </div>
  );
}
