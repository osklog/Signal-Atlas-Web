import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { StoryCard } from "@/components/story-card";
import { getStoryCollection } from "@/lib/repository";

export const dynamic = "force-dynamic";

function pickValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SavedPage({
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
    savedOnly: true,
    limit: 1000,
  });

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-meta">
          <span className="eyebrow">Saved</span>
          <span className="subtle-chip">{collection.savedStoryIds.length} stories bookmarked</span>
        </div>
        <h1>Your kept signals</h1>
        <p className="hero-copy">
          A quiet shelf for the stories you want to keep in view. Remove any item directly
          from the card or inside the story detail page.
        </p>
      </section>

      <FilterBar
        basePath="/saved"
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
              variant="saved"
            />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No saved stories yet"
          copy="Use the Save button on any radar or overlooked story to keep it here."
          actionLabel="Go to radar"
          actionHref="/"
        />
      )}
    </div>
  );
}
