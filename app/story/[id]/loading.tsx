export default function Loading() {
  return (
    <div className="page-stack">
      <article className="story-detail-card">
        <div className="skeleton-line short" />
        <div className="skeleton-line tall" />
        <div className="skeleton-line" />
        <div className="metrics-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <article key={index} className="metric-panel">
              <div className="skeleton-line short" />
              <div className="skeleton-line" />
            </article>
          ))}
        </div>
      </article>
    </div>
  );
}
