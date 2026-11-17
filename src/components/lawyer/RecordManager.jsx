import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import FormField from '../forms/FormField';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../context/ToastContext';
import { RECORD_CONFIG } from './recordConfig';
import * as lawyerService from '../../services/lawyerService';

/** Add / edit / delete manager for one lawyer profile section. */
export default function RecordManager({ lawyerId, section, items, onChange }) {
  const config = RECORD_CONFIG[section];
  const { notify } = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | record
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const form = useForm(config.empty, config.schema);
  const { Card, icon: Icon } = config;

  const openNew = () => {
    form.reset(config.empty);
    setEditing('new');
  };
  const openEdit = (item) => {
    form.reset({ ...config.empty, ...item });
    setEditing(item);
  };
  const close = () => !saving && setEditing(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.validateAll()) return;
    setSaving(true);
    try {
      // eslint-disable-next-line no-unused-vars
      const { id, ...data } = form.values;
      if (editing === 'new') {
        const created = await lawyerService.addRecord(lawyerId, section, data);
        onChange([created, ...items]);
        notify(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} added.`);
      } else {
        const updated = await lawyerService.updateRecord(lawyerId, section, editing.id, data);
        onChange(items.map((i) => (i.id === updated.id ? updated : i)));
        notify('Changes saved.');
      }
      setEditing(null);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await lawyerService.deleteRecord(lawyerId, section, deleting.id);
      onChange(items.filter((i) => i.id !== deleting.id));
      notify(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} deleted.`, 'info');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <section className="card p-6" aria-labelledby={`${section}-heading`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id={`${section}-heading`} className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="h-5 w-5 text-gold-600" aria-hidden="true" /> {config.title}
          <span className="badge bg-cream text-muted">{items.length}</span>
        </h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add {config.singular}
        </button>
      </div>

      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <Card key={item.id} item={item} onEdit={() => openEdit(item)} onDelete={() => setDeleting(item)} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line bg-cream/60 p-6 text-center text-sm text-muted">
          No {config.title.toLowerCase()} added yet.
        </p>
      )}

      <Modal
        open={!!editing}
        onClose={close}
        title={`${editing === 'new' ? 'Add' : 'Edit'} ${config.singular}`}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={close} disabled={saving}>Cancel</button>
            <button type="submit" form={`${section}-form`} className="btn btn-primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save
            </button>
          </>
        }
      >
        <form id={`${section}-form`} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          {config.fields.map(({ full, ...f }) => (
            <FormField key={f.name} {...f} {...form.field(f.name)} className={full ? 'sm:col-span-2' : ''} />
          ))}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete ${config.singular}?`}
        message={`This will remove “${deleting?.title || deleting?.institution || deleting?.designation || ''}” from your profile.`}
        confirmLabel="Delete"
      />
    </section>
  );
}
