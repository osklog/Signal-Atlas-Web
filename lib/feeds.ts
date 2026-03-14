import type { FeedSource } from "@/lib/types";
import { ALL_SOURCES } from "@/lib/sources-metadata";

/**
 * Build feed sources from the centralized source metadata.
 * Only includes sources that have a feedUrl defined.
 */
function buildFeedSources(): FeedSource[] {
  return ALL_SOURCES
    .filter((meta) => meta.feedUrl)
    .map((meta) => ({
      id: `source_${meta.slug}`,
      slug: meta.slug,
      name: meta.name,
      feedUrl: meta.feedUrl!,
      homepageUrl: meta.homepageUrl ?? null,
      region: meta.region,
      language: meta.language,
      isMajor: meta.isMajor,
      tier: meta.tier,
      sourceType: meta.type,
      country: meta.country,
      isPublicService: meta.isPublicService,
      municipality: meta.municipality,
      ownershipGroup: meta.ownershipGroup,
    }));
}

export const FEED_SOURCES = buildFeedSources();

/** Only editorial (non-institutional) RSS feeds for the main ingest loop */
export const EDITORIAL_FEED_SOURCES = FEED_SOURCES.filter(
  (s) => s.sourceType !== "institutional",
);

/** Institutional RSS feeds for separate ingest */
export const INSTITUTIONAL_FEED_SOURCES = FEED_SOURCES.filter(
  (s) => s.sourceType === "institutional",
);

export const FEED_SOURCE_MAP = new Map(FEED_SOURCES.map((source) => [source.id, source]));
