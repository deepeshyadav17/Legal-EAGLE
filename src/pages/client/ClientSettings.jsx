import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import FormField from '../../components/forms/FormField';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getClient, updateClient } from '../../services/clientService';
import { CITIES } from '../../mock/referenceData';
import { rules } from '../../utils/validators';

const cityOptions = CITIES.map((c) => ({ value: c, label: c }));

const SCHEMA = {
  name: [rules.required('Full name'), rules.minLength(2, 'Full name')],
  email: [rules.required('Email address'), rules.email()],
};

export default function ClientSettings() {
  useDocumentTitle('Client Account Settings');
  const { user, updateAccount } = useAuth();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: client, loading, error, reload } = useAsync(
    () => getClient(user.profileId),
    [user.profileId],
  );

  const form = useForm({ name: user.name, email: user.email, city: '' }, SCHEMA);

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name || user.name,
        email: client.email || user.email,
        city: client.city || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.validateAll()) return;
    setSaving(true);
    try {
      await updateAccount({ name: form.values.name, email: form.values.email });
      await updateClient(user.profileId, form.values);
      notify('Account settings updated.');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LineSkeleton lines={4} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client Workspace"
        title="Account Settings"
        description="Manage your personal account details and default search location."
      />

      <form onSubmit={handleSubmit} noValidate className="card max-w-2xl space-y-5 p-6">
        <FormField
          label="Full name"
          required
          {...form.field('name')}
        />
        <FormField
          label="Email address"
          type="email"
          required
          {...form.field('email')}
        />
        <FormField
          as="select"
          label="Preferred city"
          placeholder="All cities"
          options={cityOptions}
          hint="Pre-fills the city selector on your dashboard quick search."
          {...form.field('city')}
        />

        <div className="flex justify-end border-t border-line pt-4">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

