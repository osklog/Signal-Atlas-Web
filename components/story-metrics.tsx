import { freshnessBand } from "@/lib/normalize";
import type { ClusteredStory } from "@/lib/types";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/utils";

interface StoryMetricsProps {
  story: ClusteredStory;
}

export function StoryMetrics({ story }: StoryMetricsProps) {
  const metrics = [
    { label: "Radar", value: String(story.radarScore) },
    { label: "Overlooked", value: String(story.overlookedScore) },
    { label: "Sources", value: String(story.sourceCount) },
    { label: "Major outlets", value: String(story.majorSourceCount) },
    {
      label: "International pickup",
      value: String(story.internationalSourceCount),
    },
    { label: "Freshness", value: freshnessBand(story.lastUpdatedAt) },
    {
      label: "First seen",
      value: `${formatRelativeTime(story.firstSeenAt)} · ${formatAbsoluteTime(
        story.firstSeenAt,
      )}`,
    },
    {
      label: "Last updated",
      value: `${formatRelativeTime(story.lastUpdatedAt)} · ${formatAbsoluteTime(
        story.lastUpdatedAt,
      )}`,
    },
  ];

  return (
    <section className="metrics-grid" aria-label="Story metrics">
      {metrics.map((metric) => (
        <article key={metric.label} className="metric-panel">
          <span className="metric-label">{metric.label}</span>
          <strong className="metric-value">{metric.value}</strong>
        </article>
      ))}
    </section>
  );
}
