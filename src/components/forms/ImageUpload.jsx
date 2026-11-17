import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import Avatar from '../common/Avatar';
import { resizeImage } from '../../utils/image';

/** Photo/logo picker with preview. Produces a compact data URL (demo only). */
export default function ImageUpload({ label, name, value, onChange, square = false, maxSize = 320 }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setError('');
      onChange(await resizeImage(file, maxSize));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-center gap-4">
        <Avatar name={name} src={value} size="lg" square={square} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()}>
            <Camera className="h-4 w-4" aria-hidden="true" /> {value ? 'Change' : 'Upload'}
          </button>
          {value && (
            <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => onChange('')}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onFile} aria-label={`Upload ${label}`} />
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted">JPG, PNG or WebP up to 5 MB. Stored only in this browser for the demo.</p>
      {error && <p className="mt-1 text-xs font-medium text-red-700" role="alert">{error}</p>}
    </div>
  );
}
