import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import FormField from '../../components/forms/FormField';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { updateFirm } from '../../services/firmService';
import { rules } from '../../utils/validators';

const SCHEMA = {
  name: [rules.required('Firm name'), rules.minLength(3, 'Firm name')],
  representative: [rules.required('Representative name')],
  email: [rules.required('Account email'), rules.email()],
};

export default function FirmSettings() {
  useDocumentTitle('Firm Account Settings');
  const { user, updateAccount } = useAuth();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  const form = useForm(
    {
      name: user.name || '',
      representative: user.representative || 'Authorized Representative',
      email: user.email || '',
    },
    SCHEMA,
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.validateAll()) return;
    setSaving(true);
    try {
      await updateFirm(user.profileId, {
        name: form.values.name.trim(),
        email: form.values.email.trim(),
      });
      await updateAccount({
        name: form.values.name.trim(),
        representative: form.values.representative.trim(),
        email: form.values.email.trim(),
      });
      notify('Firm account settings saved.');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Law Firm Workspace"
        title="Account & Representative Settings"
        description="Manage the authorized representative and login email associated with this law firm account."
      />

      <form onSubmit={handleSubmit} noValidate className="card max-w-2xl space-y-5 p-6">
        <FormField
          label="Organization / Law Firm Name"
          required
          {...form.field('name')}
        />
        <FormField
          label="Authorized Representative Name"
          required
          placeholder="e.g. Kavya Mehra"
          {...form.field('representative')}
        />
        <FormField
          label="Account Email Address"
          type="email"
          required
          {...form.field('email')}
        />

        <div className="flex justify-end border-t border-line pt-4">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save Account Settings
          </button>
        </div>
      </form>
    </div>
  );
}

