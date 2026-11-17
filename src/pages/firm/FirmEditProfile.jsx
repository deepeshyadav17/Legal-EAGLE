import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, Save } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import MediaGallery from '../../components/profile/MediaGallery';
import FormField from '../../components/forms/FormField';
import ImageUpload from '../../components/forms/ImageUpload';
import PracticeAreaPicker from '../../components/forms/PracticeAreaPicker';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getFirm, updateFirm } from '../../services/firmService';
import { CITIES } from '../../mock/referenceData';
import { rules } from '../../utils/validators';

const cityOptions = CITIES.map((c) => ({ value: c, label: c }));

const SCHEMA = {
  name: [rules.required('Firm name'), rules.minLength(3, 'Firm name')],
  city: [rules.required('City')],
  address: [rules.required('Office address')],
  established: [rules.required('Establishment year'), rules.year('Establishment year')],
  practiceAreas: [rules.required('Select at least one practice area')],
  email: [rules.required('Official email'), rules.email()],
  phone: [rules.phone()],
  about: [rules.maxLength(1500, 'About section')],
};

export default function FirmEditProfile() {
  useDocumentTitle('Edit Firm Profile');
  const { user, refreshUser } = useAuth();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: firm, loading, error, reload, setData } = useAsync(
    () => getFirm(user.profileId),
    [user.profileId],
  );

  const form = useForm(
    {
      name: '',
      city: '',
      address: '',
      established: 2010,
      practiceAreas: [],
      about: '',
      email: '',
      phone: '',
      website: '',
      logo: '',
    },
    SCHEMA,
  );

  useEffect(() => {
    if (firm) {
      form.reset({
        name: firm.name || '',
        city: firm.city || '',
        address: firm.address || '',
        established: firm.established || 2010,
        practiceAreas: firm.practiceAreas || [],
        about: firm.about || '',
        email: firm.email || '',
        phone: firm.phone || '',
        website: firm.website || '',
        logo: firm.logo || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firm?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.validateAll()) return;
    setSaving(true);
    try {
      const updated = await updateFirm(user.profileId, {
        name: form.values.name.trim(),
        city: form.values.city,
        address: form.values.address.trim(),
        established: Number(form.values.established),
        practiceAreas: form.values.practiceAreas,
        about: form.values.about.trim(),
        email: form.values.email.trim(),
        phone: form.values.phone.trim(),
        website: form.values.website.trim(),
        logo: form.values.logo,
      });
      refreshUser();
      setData(updated);
      notify('Law firm profile updated.');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LineSkeleton lines={6} />;
  if (error || !firm) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organization Editor"
        title="Edit Law Firm Profile"
        description="Update your firm logo, description, practice areas and official contact information."
        actions={
          <Link to={`/firms/${firm.id}`} className="btn btn-outline btn-sm">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> View Public Firm Page
          </Link>
        }
      />

      <form onSubmit={handleSubmit} noValidate className="card space-y-6 p-6">
        <ImageUpload
          label="Firm Logo"
          name={form.values.name || firm.name}
          value={form.values.logo}
          onChange={(val) => form.setField('logo', val)}
          square
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Law Firm Name"
            required
            {...form.field('name')}
          />
          <FormField
            label="Establishment Year"
            type="number"
            min={1950}
            max={2035}
            required
            {...form.field('established')}
          />
          <FormField
            as="select"
            label="Primary City"
            required
            options={cityOptions}
            {...form.field('city')}
          />
          <FormField
            label="Office Address"
            required
            placeholder="e.g. C-Scheme, Jaipur, Rajasthan"
            {...form.field('address')}
          />
        </div>

        <PracticeAreaPicker
          label="Firm Practice Areas *"
          value={form.values.practiceAreas}
          onChange={(next) => form.setField('practiceAreas', next)}
          error={form.errors.practiceAreas}
        />

        <FormField
          as="textarea"
          label="About the Firm"
          placeholder="Provide an overview of the firm’s areas of practice, courts of appearance and history…"
          hint="At least 80 characters recommended for profile completion."
          {...form.field('about')}
        />

        <div className="grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
          <FormField
            label="Official Email"
            type="email"
            required
            placeholder="office@firm.example.com"
            {...form.field('email')}
          />
          <FormField
            label="Office Phone"
            type="tel"
            placeholder="+91 90000 10001"
            {...form.field('phone')}
          />
          <FormField
            label="Website"
            placeholder="firm.example.com"
            {...form.field('website')}
          />
        </div>

        <div className="flex justify-end border-t border-line pt-4">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save Firm Profile
          </button>
        </div>
      </form>

      <MediaGallery profileType="firm" profileId={firm.id} editable />
    </div>
  );
}
