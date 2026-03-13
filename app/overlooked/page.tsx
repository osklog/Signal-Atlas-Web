import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { StoryCard } from "@/components/story-card";
import { getStoryCollection } from "@/lib/repository";

export const dynamic = "force-dynamic";

function pickValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OverlookedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const topic = pickValue(params.topic);
  const region = pickValue(params.region);
  const collection = await getStoryCollection({
    sortBy: "overlooked",
    topic,
    region,
  });

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-meta">
          <span className="eyebrow">Overlooked</span>
          <span className="subtle-chip">Low major-outlet pickup, credible multi-source traction</span>
        </div>
        <h1>Stories that have signal without full amplification</h1>
        <p className="hero-copy">
          This view favors stories that are appearing across several sources, persisting over
          time, and still sitting below the loudest international coverage layer.
        </p>
      </section>

      <FilterBar
        basePath="/overlooked"
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
              variant="overlooked"
            />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No overlooked stories match those filters"
          copy="There may simply be no quiet but credible stories in that slice right now."
          actionLabel="Browse all overlooked stories"
          actionHref="/overlooked"
        />
      )}
    </div>
  );
}
