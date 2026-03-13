export function LoadingGrid() {
  return (
    <div className="story-grid" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <article key={index} className="story-card story-card-loading">
          <div className="skeleton-line short" />
          <div className="skeleton-line tall" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-grid">
            <div className="skeleton-line short" />
            <div className="skeleton-line short" />
            <div className="skeleton-line short" />
            <div className="skeleton-line short" />
          </div>
          <div className="skeleton-line" />
        </article>
      ))}
    </div>
  );
}
