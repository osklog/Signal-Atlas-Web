import Link from "next/link";

interface EmptyStateProps {
  title: string;
  copy: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  title,
  copy,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-state-orbit" />
      <div className="empty-state-copy">
        <p className="eyebrow">Signal gap</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="ghost-link">
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}
