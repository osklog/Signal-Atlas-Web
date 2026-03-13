import { LoadingGrid } from "@/components/loading-grid";

export default function Loading() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-meta">
          <span className="eyebrow">Loading</span>
        </div>
        <h1>Composing the newsroom view</h1>
        <p className="hero-copy">
          Pulling together clusters, source counts, and score signals.
        </p>
      </section>
      <LoadingGrid />
    </div>
  );
}
