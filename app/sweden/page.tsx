import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { StoryCard } from "@/components/story-card";
import { getStoryCollection } from "@/lib/repository";

export const dynamic = "force-dynamic";

function pickValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SwedenDeskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const topic = pickValue(params.topic);
  const region = pickValue(params.region);
  const tab = pickValue(params.tab) ?? "aktuellt";

  const sortBy = tab === "under-radarn" ? "overlooked" as const
    : tab === "potential" ? "potential" as const
    : "radar" as const;

  const collection = await getStoryCollection({
    sortBy,
    topic,
    region,
    country: "SE",
    limit: 30,
  });

  const tabLabel = tab === "under-radarn" ? "Under radarn"
    : tab === "potential" ? "Potential"
    : "Aktuellt";

  const variant = tab === "under-radarn" ? "overlooked" as const
    : tab === "potential" ? "potential" as const
    : "radar" as const;

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="hero-meta">
          <span className="eyebrow">Sverige</span>
          <span className="subtle-chip">{tabLabel}</span>
        </div>
        <h1>Sweden Desk</h1>
        <p className="hero-copy">
          {tab === "under-radarn"
            ? "Stories with credible regional traction that SVT, DN, and Aftonbladet have not picked up yet."
            : tab === "potential"
            ? "Early signals that may become nationally or systemically important. The flagship Sweden signal."
            : "What matters most in Swedish news right now, clustered and ranked."}
        </p>
        <div className="hero-stat-row">
          <div>
            <span>Stories</span>
            <strong>{collection.clusters.length}</strong>
          </div>
          <div>
            <span>Topics</span>
            <strong>{collection.filters.topics.length}</strong>
          </div>
          <div>
            <span>Mode</span>
            <strong>{collection.mode}</strong>
          </div>
        </div>
      </section>

      <nav className="sweden-tabs" aria-label="Sweden desk views">
        <a
          href="/sweden?tab=aktuellt"
          className={`sweden-tab ${tab === "aktuellt" ? "sweden-tab-active" : ""}`}
        >
          Aktuellt
        </a>
        <a
          href="/sweden?tab=under-radarn"
          className={`sweden-tab ${tab === "under-radarn" ? "sweden-tab-active" : ""}`}
        >
          Under radarn
        </a>
        <a
          href="/sweden?tab=potential"
          className={`sweden-tab ${tab === "potential" ? "sweden-tab-active" : ""}`}
        >
          Potential
        </a>
      </nav>

      <FilterBar
        basePath={`/sweden?tab=${tab}`}
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
              variant={variant}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No Swedish stories match those filters"
          copy="Try widening the filters or check back soon — the Sweden desk runs on Swedish-only or Sweden-relevant clusters."
          actionLabel="Reset filters"
          actionHref="/sweden"
        />
      )}
    </div>
  );
}
