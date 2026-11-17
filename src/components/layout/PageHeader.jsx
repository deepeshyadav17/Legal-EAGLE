/** Consistent page heading for dashboard screens. */
export default function PageHeader({ title, description, subtitle, actions, action, eyebrow }) {
  const desc = description || subtitle;
  const act = actions || action;
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      {act && <div className="flex flex-wrap gap-2">{act}</div>}
    </div>
  );
}
