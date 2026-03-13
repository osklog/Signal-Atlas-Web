import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { StoryCard } from "@/components/story-card";
import { getStoryCollection } from "@/lib/repository";

export const dynamic = "force-dynamic";

function pickValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const topic = pickValue(params.topic);
  const region = pickValue(params.region);
  const collection = await getStoryCollection({
    sortBy: "radar",
    topic,
    region,
  });

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-meta">
          <span className="eyebrow">Radar</span>
          <span className="mode-pill">
            {collection.mode === "demo" ? "Demo data path" : "Supabase data path"}
          </span>
        </div>
        <h1>Signal Atlas Radar</h1>
        <p className="hero-copy">
          Clustered world stories ranked by recency, pickup momentum, and source diversity.
          The goal is clarity, not noise.
        </p>
        <div className="hero-stat-row">
          <div>
            <span>Stories in view</span>
            <strong>{collection.clusters.length}</strong>
          </div>
          <div>
            <span>Tracked topics</span>
            <strong>{collection.filters.topics.length}</strong>
          </div>
          <div>
            <span>Tracked regions</span>
            <strong>{collection.filters.regions.length}</strong>
          </div>
        </div>
      </section>

      <FilterBar
        basePath="/"
        filters={collection.filters}
        currentTopic={topic}
        currentRegion={region}
      />

      {collection.clusters.length ? (
        <section className="story-grid">
          {collection.clusters.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              saved={collection.savedStoryIds.includes(story.id)}
              variant="radar"
            />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No radar stories match those filters"
          copy="Try widening the topic or region filters to reopen the field."
          actionLabel="Reset filters"
          actionHref="/"
        />
      )}
    </div>
  );
}
