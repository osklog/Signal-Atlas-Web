import Link from "next/link";
import { notFound } from "next/navigation";

import { SaveStoryButton } from "@/components/save-story-button";
import { StoryMetrics } from "@/components/story-metrics";
import { getStoryCollection } from "@/lib/repository";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function ScoreBreakdownPanel({ breakdown }: { breakdown: Record<string, Record<string, number>> }) {
  const sections = Object.entries(breakdown);
  if (sections.length === 0) return null;

  return (
    <section className="breakdown-section">
      <p className="eyebrow">Score breakdown</p>
      <div className="breakdown-grid">
        {sections.map(([model, factors]) => (
          <div key={model} className="breakdown-card">
            <span className="breakdown-model">{model}</span>
            <dl className="breakdown-factors">
              {Object.entries(factors).map(([factor, value]) => (
                <div key={factor} className="breakdown-factor">
                  <dt>{factor.replace(/_/g, " ")}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const collection = await getStoryCollection({
    limit: 1000,
  });
  const story = collection.clusters.find((cluster) => cluster.id === id);

  if (!story) {
    notFound();
  }

  const isSaved = collection.savedStoryIds.includes(story.id);

  return (
    <div className="page-stack story-detail-stack">
      <Link href="/" className="back-link">
        Back to radar
      </Link>

      <article className="story-detail-card">
        <div className="story-detail-header">
          <div className="story-detail-copy">
            <div className="story-tags">
              <span>{story.topic}</span>
              <span>{story.region}</span>
              <span>{story.sourceCount} sources</span>
              {story.isWireDriven && (
                <span className="story-badge wire-badge">Wire-driven</span>
              )}
              {!story.isWireDriven && story.sourceCount >= 2 && (
                <span className="story-badge independent-badge">Independent</span>
              )}
            </div>
            {story.entityTags && story.entityTags.length > 0 && (
              <div className="entity-tag-row">
                {story.entityTags.slice(0, 5).map((tag) => (
                  <span key={tag} className="entity-tag">{tag}</span>
                ))}
              </div>
            )}
            <h1>{story.clusterTitle}</h1>
            <p className="story-detail-summary">{story.summary}</p>
          </div>
          <SaveStoryButton storyId={story.id} initialSaved={isSaved} />
        </div>

        <StoryMetrics story={story} />

        <section className="insight-grid">
          <article className="insight-panel">
            <span className="insight-label">Why this matters</span>
            <p>{story.whyItMatters}</p>
          </article>
          <article className="insight-panel">
            <span className="insight-label">Why it may be overlooked</span>
            <p>{story.overlookedReason}</p>
          </article>
        </section>

        {story.scoreBreakdown && Object.keys(story.scoreBreakdown).length > 0 && (
          <ScoreBreakdownPanel breakdown={story.scoreBreakdown} />
        )}

        <section className="article-list-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Related coverage</p>
              <h2>All linked articles in the cluster</h2>
            </div>
            <p className="section-note">
              First seen {formatRelativeTime(story.firstSeenAt)} from{" "}
              {story.topSourceNames.join(", ")}.
            </p>
          </div>

          <div className="article-list">
            {story.articles.map((article) => (
              <article key={article.id} className="article-row">
                <div className="article-row-meta">
                  <span className="article-source">{article.sourceName}</span>
                  <span>{formatRelativeTime(article.publishedAt)}</span>
                  <span>{formatAbsoluteTime(article.publishedAt)}</span>
                </div>
                <h3>{article.title}</h3>
                <p>{article.summary || article.contentSnippet}</p>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ghost-link"
                >
                  Open source article
                </a>
              </article>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
