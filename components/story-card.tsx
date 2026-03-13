import Link from "next/link";

import { SaveStoryButton } from "@/components/save-story-button";
import { freshnessBand } from "@/lib/normalize";
import type { ClusteredStory } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface StoryCardProps {
  story: ClusteredStory;
  saved: boolean;
  variant?: "radar" | "overlooked" | "saved";
}

export function StoryCard({
  story,
  saved,
  variant = "radar",
}: StoryCardProps) {
  const emphasis =
    variant === "overlooked" ? story.overlookedReason : story.whyItMatters;

  return (
    <article className="story-card">
      <div className="story-card-topline">
        <div className="story-score-block">
          <span className="story-score-label">
            {variant === "overlooked" ? "Overlooked" : "Radar"}
          </span>
          <strong className="story-score-value">
            {variant === "overlooked" ? story.overlookedScore : story.radarScore}
          </strong>
        </div>
        <SaveStoryButton storyId={story.id} initialSaved={saved} />
      </div>

      <div className="story-card-header">
        <div className="story-tags">
          <span>{story.topic}</span>
          <span>{story.region}</span>
          <span>{freshnessBand(story.lastUpdatedAt)}</span>
        </div>
        <h2 className="story-card-title">
          <Link href={`/story/${story.id}`}>{story.clusterTitle}</Link>
        </h2>
        <p className="story-card-summary">{story.summary}</p>
      </div>

      <dl className="story-card-metrics">
        <div>
          <dt>Sources</dt>
          <dd>{story.sourceCount}</dd>
        </div>
        <div>
          <dt>Top sources</dt>
          <dd>{story.topSourceNames.join(", ")}</dd>
        </div>
        <div>
          <dt>First seen</dt>
          <dd>{formatRelativeTime(story.firstSeenAt)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatRelativeTime(story.lastUpdatedAt)}</dd>
        </div>
      </dl>

      <div className="story-card-note">
        <span className="story-note-label">
          {variant === "overlooked" ? "Why overlooked" : "Why this matters"}
        </span>
        <p>{emphasis}</p>
      </div>

      <div className="story-card-footer">
        <span>
          {story.majorSourceCount} major outlet
          {story.majorSourceCount === 1 ? "" : "s"}
        </span>
        <Link href={`/story/${story.id}`} className="story-card-link">
          Open story
        </Link>
      </div>
    </article>
  );
}
