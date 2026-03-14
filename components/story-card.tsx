import Link from "next/link";

import { SaveStoryButton } from "@/components/save-story-button";
import { freshnessBand } from "@/lib/normalize";
import type { ClusteredStory } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface StoryCardProps {
  story: ClusteredStory;
  saved: boolean;
  variant?: "radar" | "overlooked" | "potential" | "saved";
}

function getScoreLabel(variant: string) {
  if (variant === "overlooked") return "Overlooked";
  if (variant === "potential") return "Potential";
  return "Radar";
}

function getScoreValue(story: ClusteredStory, variant: string) {
  if (variant === "overlooked") return story.overlookedScore;
  if (variant === "potential") return story.potentialScore;
  return story.radarScore;
}

function getNoteLabel(variant: string) {
  if (variant === "overlooked") return "Why overlooked";
  if (variant === "potential") return "Why potential";
  return "Why this matters";
}

function getNoteText(story: ClusteredStory, variant: string) {
  if (variant === "overlooked") return story.overlookedReason;
  return story.whyItMatters;
}

export function StoryCard({
  story,
  saved,
  variant = "radar",
}: StoryCardProps) {
  return (
    <article className="story-card">
      <div className="story-card-topline">
        <div className="story-score-block">
          <span className="story-score-label">
            {getScoreLabel(variant)}
          </span>
          <strong className="story-score-value">
            {getScoreValue(story, variant)}
          </strong>
        </div>
        <div className="story-badges">
          {story.isWireDriven && (
            <span className="story-badge wire-badge">Wire-driven</span>
          )}
          {!story.isWireDriven && story.sourceCount >= 2 && (
            <span className="story-badge independent-badge">Independent</span>
          )}
          <SaveStoryButton storyId={story.id} initialSaved={saved} />
        </div>
      </div>

      <div className="story-card-header">
        <div className="story-tags">
          <span>{story.topic}</span>
          <span>{story.region}</span>
          <span>{freshnessBand(story.lastUpdatedAt)}</span>
          {story.entityTags && story.entityTags.length > 0 && (
            <span className="entity-tag">{story.entityTags[0]}</span>
          )}
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
          {getNoteLabel(variant)}
        </span>
        <p>{getNoteText(story, variant)}</p>
      </div>

      <div className="story-card-footer">
        <span>
          {story.majorSourceCount} major outlet
          {story.majorSourceCount === 1 ? "" : "s"}
          {story.municipalitySpread && story.municipalitySpread > 1
            ? ` · ${story.municipalitySpread} municipalities`
            : ""}
          {story.regionSpread && story.regionSpread > 1
            ? ` · ${story.regionSpread} regions`
            : ""}
        </span>
        <Link href={`/story/${story.id}`} className="story-card-link">
          Open story
        </Link>
      </div>
    </article>
  );
}
