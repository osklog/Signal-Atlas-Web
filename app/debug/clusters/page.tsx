import { getStoryCollection } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function DebugClustersPage() {
  const collection = await getStoryCollection({ limit: 500 });
  const clusters = collection.clusters;

  // Cluster size distribution
  const singletons = clusters.filter((c) => c.articles.length === 1).length;
  const size2to3 = clusters.filter((c) => c.articles.length >= 2 && c.articles.length <= 3).length;
  const size4to10 = clusters.filter((c) => c.articles.length >= 4 && c.articles.length <= 10).length;
  const size10plus = clusters.filter((c) => c.articles.length > 10).length;
  const totalArticles = clusters.reduce((sum, c) => sum + c.articles.length, 0);
  const singletonRate = clusters.length > 0
    ? Math.round((singletons / clusters.length) * 100)
    : 0;

  // Recent merges (multi-article clusters, sorted by last update)
  const recentMerges = [...clusters]
    .filter((c) => c.articles.length > 1)
    .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime())
    .slice(0, 20);

  // Wire-driven clusters
  const wireDriven = clusters.filter((c) => c.isWireDriven);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-meta">
          <span className="eyebrow">Debug</span>
          <span className="mode-pill">{collection.mode} mode</span>
        </div>
        <h1>Cluster Debug</h1>
        <p className="hero-copy">
          Cluster size distribution, recent merges, and quality diagnostics.
        </p>
      </section>

      <section className="debug-section">
        <h2 className="debug-heading">Distribution</h2>
        <div className="debug-stats-grid">
          <div className="debug-stat">
            <span className="debug-stat-label">Total articles</span>
            <strong>{totalArticles}</strong>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Total clusters</span>
            <strong>{clusters.length}</strong>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Singleton rate</span>
            <strong>{singletonRate}%</strong>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Size 1</span>
            <strong>{singletons}</strong>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Size 2–3</span>
            <strong>{size2to3}</strong>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Size 4–10</span>
            <strong>{size4to10}</strong>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Size 10+</span>
            <strong>{size10plus}</strong>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Wire-driven</span>
            <strong>{wireDriven.length}</strong>
          </div>
        </div>

        <div className="debug-bar-chart">
          <div className="debug-bar" style={{ width: `${(singletons / Math.max(clusters.length, 1)) * 100}%` }}>
            <span>1: {singletons}</span>
          </div>
          <div className="debug-bar" style={{ width: `${(size2to3 / Math.max(clusters.length, 1)) * 100}%` }}>
            <span>2–3: {size2to3}</span>
          </div>
          <div className="debug-bar" style={{ width: `${(size4to10 / Math.max(clusters.length, 1)) * 100}%` }}>
            <span>4–10: {size4to10}</span>
          </div>
          <div className="debug-bar" style={{ width: `${(size10plus / Math.max(clusters.length, 1)) * 100}%` }}>
            <span>10+: {size10plus}</span>
          </div>
        </div>
      </section>

      <section className="debug-section">
        <h2 className="debug-heading">Recent Merges (top 20)</h2>
        <div className="debug-cluster-list">
          {recentMerges.map((cluster) => (
            <details key={cluster.id} className="debug-cluster-item">
              <summary className="debug-cluster-summary">
                <span className="debug-cluster-size">{cluster.articles.length} articles</span>
                <span className="debug-cluster-title">{cluster.clusterTitle}</span>
                <span className="debug-cluster-scores">
                  R:{cluster.radarScore} O:{cluster.overlookedScore} P:{cluster.potentialScore}
                </span>
                {cluster.isWireDriven && <span className="debug-badge wire">Wire</span>}
              </summary>
              <div className="debug-cluster-detail">
                {cluster.entityTags && cluster.entityTags.length > 0 && (
                  <p className="debug-entities">
                    Entities: {cluster.entityTags.join(", ")}
                  </p>
                )}
                {cluster.scoreBreakdown && Object.keys(cluster.scoreBreakdown).length > 0 && (
                  <pre className="debug-breakdown">
                    {JSON.stringify(cluster.scoreBreakdown, null, 2)}
                  </pre>
                )}
                <div className="debug-article-list">
                  {cluster.articles.map((article) => (
                    <div key={article.id} className="debug-article-row">
                      <span className="debug-article-source">{article.sourceName}</span>
                      <span className="debug-article-title">{article.title}</span>
                      <span className="debug-article-time">
                        {new Date(article.publishedAt).toISOString().slice(0, 16)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="debug-section">
        <h2 className="debug-heading">All Clusters ({clusters.length})</h2>
        <div className="debug-cluster-list">
          {clusters.map((cluster) => (
            <div key={cluster.id} className="debug-cluster-row">
              <span className="debug-cluster-size">{cluster.articles.length}</span>
              <span className="debug-cluster-title">{cluster.clusterTitle.slice(0, 80)}</span>
              <span className="debug-cluster-scores">
                R:{cluster.radarScore} O:{cluster.overlookedScore} P:{cluster.potentialScore}
              </span>
              {cluster.isWireDriven && <span className="debug-badge wire">W</span>}
              {(cluster.country === "SE") && <span className="debug-badge se">SE</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
