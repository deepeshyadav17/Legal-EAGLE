import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Play, Trash2, Video } from 'lucide-react';
import ConfirmDialog from '../common/ConfirmDialog';
import { resizeImage } from '../../utils/image';
import { createMediaPost, deleteMediaPost, listMediaPosts } from '../../services/mediaPostService';
import { useToast } from '../../context/ToastContext';

const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const MAX_CAPTION_LENGTH = 500;

function MediaPost({ post, editable, onDelete }) {
  const [mediaUrl, setMediaUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(post.mediaBlob);
    setMediaUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [post.mediaBlob]);

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="relative aspect-[4/3] bg-navy/5">
        {mediaUrl && post.mediaType === 'image' && (
          <img src={mediaUrl} alt={post.caption || 'Profile post'} className="h-full w-full object-cover" />
        )}
        {mediaUrl && post.mediaType === 'video' && (
          <>
            <video
              controls
              preload="metadata"
              playsInline
              className="h-full w-full bg-navy object-contain"
              aria-label={post.caption || 'Profile video'}
            >
              <source src={mediaUrl} type={post.mediaBlob.type} />
              Your browser does not support this video format.
            </video>
            <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-navy/80 px-2 py-1 text-[11px] font-medium text-white">
              <Play className="h-3 w-3" aria-hidden="true" /> Video
            </span>
          </>
        )}
      </div>
      <div className="flex items-start gap-3 p-3.5">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
          {post.caption || <span className="italic text-muted">No caption</span>}
        </p>
        {editable && (
          <button
            type="button"
            className="btn btn-danger-outline btn-sm shrink-0"
            onClick={() => onDelete(post)}
            aria-label="Delete post"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="border-t border-line px-3.5 py-2 text-xs text-muted">
        {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(post.createdAt))}
      </p>
    </article>
  );
}

export default function MediaGallery({ profileType, profileId, editable = false }) {
  const { notify } = useToast();
  const inputRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadPosts = async () => {
    setLoading(true);
    setError('');
    try {
      setPosts(await listMediaPosts(profileType, profileId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setPosts([]);
    setLoading(true);
    setError('');
    listMediaPosts(profileType, profileId)
      .then((items) => {
        if (active) setPosts(items);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [profileType, profileId]);

  const handleFile = (event) => {
    const selected = event.target.files?.[0] || null;
    event.target.value = '';
    setError('');
    if (!selected) return;

    const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(selected.type);
    const isVideo = ['video/mp4', 'video/webm', 'video/quicktime'].includes(selected.type);
    if (!isImage && !isVideo) {
      setFile(null);
      setError('Choose a JPG, PNG or WebP photo, or an MP4, WebM or MOV video.');
      return;
    }
    if (isImage && selected.size > 5 * 1024 * 1024) {
      setFile(null);
      setError('Photos must be smaller than 5 MB.');
      return;
    }
    if (isVideo && selected.size > MAX_VIDEO_SIZE) {
      setFile(null);
      setError('Videos must be smaller than 25 MB.');
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Choose a photo or video to create a post.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const isImage = file.type.startsWith('image/');
      const mediaBlob = isImage
        ? await fetch(await resizeImage(file, 1200, 0.82)).then((response) => response.blob())
        : file;
      const post = await createMediaPost(profileType, profileId, {
        caption,
        mediaBlob,
        mediaType: isImage ? 'image' : 'video',
      });
      setPosts((current) => [post, ...current]);
      setCaption('');
      setFile(null);
      notify('Post added to your public profile.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const deleted = await deleteMediaPost(profileType, profileId, deleteTarget.id);
      if (deleted) {
        setPosts((current) => current.filter((post) => post.id !== deleteTarget.id));
        notify('Post removed from your public profile.', 'info');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!editable && !loading && !error && posts.length === 0) return null;

  return (
    <section className={editable ? 'card p-5 sm:p-6' : 'space-y-4'} aria-labelledby={`${profileType}-posts-heading`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">From the profile</p>
          <h2 id={`${profileType}-posts-heading`} className="mt-1 text-lg font-semibold text-navy">
            Photos & videos
          </h2>
        </div>
        {editable && <p className="text-xs text-muted">Posts appear publicly on this profile.</p>}
      </div>

      {editable && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-3 border-y border-line py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-navy">Create a post</p>
            <p className="text-xs text-muted">Photos up to 5 MB · videos up to 25 MB</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()}>
              {file?.type.startsWith('video/') ? (
                <Video className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
              )}
              {file ? 'Choose a different file' : 'Choose photo or video'}
            </button>
            {file && <span className="max-w-full truncate text-xs text-muted">{file.name}</span>}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              className="sr-only"
              onChange={handleFile}
              aria-label="Choose a photo or video"
            />
          </div>

          <div>
            <label htmlFor={`${profileType}-post-caption`} className="label">Caption <span className="font-normal text-muted">(optional)</span></label>
            <textarea
              id={`${profileType}-post-caption`}
              className="input min-h-20 resize-y"
              rows={3}
              maxLength={MAX_CAPTION_LENGTH}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Add a caption to your post"
            />
            <p className="mt-1 text-right text-xs text-muted">{caption.length}/{MAX_CAPTION_LENGTH}</p>
          </div>

          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-xs leading-relaxed text-muted">
              Media is stored in this browser for the demo and is visible to anyone visiting your public profile.
            </p>
            <button type="submit" className="btn btn-primary" disabled={saving || !file}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
              {saving ? 'Posting…' : 'Post to profile'}
            </button>
          </div>
        </form>
      )}

      {!editable && error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          Could not load profile posts: {error}
        </p>
      )}
      {editable && error && (
        <button type="button" onClick={loadPosts} className="text-sm font-medium text-navy underline underline-offset-2">
          Reload profile posts
        </button>
      )}
      {loading ? (
        <p className="py-4 text-sm text-muted" role="status">Loading posts…</p>
      ) : posts.length > 0 ? (
        <div className={`grid gap-4 sm:grid-cols-2 ${editable ? 'mt-5 lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {posts.map((post) => (
            <MediaPost key={post.id} post={post} editable={editable} onDelete={setDeleteTarget} />
          ))}
        </div>
      ) : editable && !error ? (
        <p className="py-4 text-sm text-muted">Your profile has no posts yet. Add a photo or video above.</p>
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this post?"
        message="This photo or video and its caption will be removed from your public profile."
        confirmLabel="Delete post"
      />
    </section>
  );
}
