import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Save, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import FormField from '../../components/forms/FormField';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getOwnLawyerProfile, updateLawyer } from '../../services/lawyerService';
import { rules } from '../../utils/validators';
import { cn } from '../../utils/format';

const SCHEMA = {
  email: [rules.required('Contact email'), rules.email()],
  phone: [rules.required('Contact phone'), rules.phone()],
};

export default function LawyerSettings() {
  useDocumentTitle('Contact & Privacy Settings');
  const { user, updateAccount } = useAuth();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: lawyer, loading, error, reload } = useAsync(
    () => getOwnLawyerProfile(user.profileId),
    [user.profileId],
  );

  const form = useForm(
    {
      email: '',
      phone: '',
      contactVisibility: 'clients',
    },
    SCHEMA,
  );

  useEffect(() => {
    if (lawyer) {
      form.reset({
        email: lawyer.contact?.email || user.email,
        phone: lawyer.contact?.phone || '',
        contactVisibility: lawyer.contactVisibility || 'clients',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawyer?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.validateAll()) return;
    setSaving(true);
    try {
      await updateLawyer(user.profileId, {
        contact: {
          email: form.values.email.trim(),
          phone: form.values.phone.trim(),
        },
        contactVisibility: form.values.contactVisibility,
      });
      await updateAccount({ email: form.values.email.trim() });
      notify('Contact details and visibility settings saved.');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LineSkeleton lines={4} />;
  if (error || !lawyer) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy & Contact"
        title="Contact & Visibility Settings"
        description="Configure the fictional contact details shown on your profile and choose whether logged-in clients can view them."
      />

      <form onSubmit={handleSubmit} noValidate className="card max-w-2xl space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold text-navy">Contact Visibility Rule</h2>
          <p className="mt-1 text-xs text-muted">
            Public guests never see your contact details. Choose whether authenticated client accounts can view them.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                value: 'clients',
                icon: Eye,
                title: 'Visible to Logged-In Clients',
                desc: 'Authenticated client accounts can view your email and phone number.',
              },
              {
                value: 'hidden',
                icon: EyeOff,
                title: 'Hidden from Everyone',
                desc: 'Your email and phone number remain hidden even from logged-in clients.',
              },
            ].map(({ value, icon: Icon, title, desc }) => {
              const selected = form.values.contactVisibility === value;
              return (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer flex-col rounded-2xl border p-4 transition',
                    selected ? 'border-navy bg-navy text-white' : 'border-line bg-cream/50 text-ink hover:border-gold',
                  )}
                >
                  <input
                    type="radio"
                    name="contactVisibility"
                    value={value}
                    checked={selected}
                    onChange={form.handleChange}
                    className="sr-only"
                  />
                  <Icon className={cn('h-5 w-5', selected ? 'text-gold' : 'text-navy')} aria-hidden="true" />
                  <span className="mt-2 font-semibold">{title}</span>
                  <span className={cn('mt-1 text-xs', selected ? 'text-white/75' : 'text-muted')}>{desc}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <FormField
            label="Professional Contact Email"
            type="email"
            required
            placeholder="advocate@example.com"
            {...form.field('email')}
          />
          <FormField
            label="Professional Phone Number"
            type="tel"
            required
            placeholder="+91 90000 20001"
            {...form.field('phone')}
          />
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-cream p-3.5 text-xs text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
          <p>
            In production, contact visibility is enforced by the backend API before returning contact fields. Use fictional demonstration contact details only.
          </p>
        </div>

        <div className="flex justify-end border-t border-line pt-4">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}

