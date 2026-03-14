/**
 * Phase 1: Five-stage clustering pipeline.
 *
 * 1. Normalize — prepare articles (headline normalization, entity extraction, body shingles)
 * 2. Compare  — pairwise comparison with composite scoring
 * 3. Score    — composite score per pair (done inside compare)
 * 4. Merge    — union-find with drift prevention
 * 5. Validate — wire detection, cluster quality checks
 *
 * This replaces the old buildStoryClusters() function.
 */

import { createStableId } from "@/lib/normalize";
import { getSourceMeta, type SourceMeta } from "@/lib/sources-metadata";
import type { ArticleRecord, ClusteredStory, StoryScoreContext } from "@/lib/types";
import { countBy, sortByFrequency, unique } from "@/lib/utils";
import { computeRadarScore, computeOverlookedScore, computePotentialScore, type ScoreBreakdown } from "@/lib/scoring/scores";
import { buildWhyItMattersV2, buildOverlookedReasonV2 } from "@/lib/scoring/insights";
import type { ComparisonResult } from "./compare";
import { prepareArticle, type PreparedArticle } from "./compare";
import { mergeArticles } from "./merge";
import { detectWireCluster } from "./wire-detect";

// ─── Deduplication ──────────────────────────────────────────────────────────

function dedupeArticles(articles: ArticleRecord[]): ArticleRecord[] {
  const seen = new Set<string>();
  const kept: ArticleRecord[] = [];
  for (const article of articles) {
    const fingerprint = `${article.sourceId}|${article.url}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    kept.push(article);
  }
  return kept;
}

// ─── Cluster record building ────────────────────────────────────────────────

function pickRepresentativeArticle(articles: ArticleRecord[]): ArticleRecord {
  return [...articles].sort((left, right) => {
    if (Number(right.majorOutlet) !== Number(left.majorOutlet)) {
      return Number(right.majorOutlet) - Number(left.majorOutlet);
    }
    if (right.title.length !== left.title.length) {
      return right.title.length - left.title.length;
    }
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
  })[0];
}

function dominantValue(values: string[], fallback: string): string {
  const counts = countBy(values);
  const winner = Object.entries(counts)
    .sort((left, right) => right[1] !== left[1] ? right[1] - left[1] : left[0].localeCompare(right[0]))
    [0]?.[0];
  return winner ?? fallback;
}

function summarizeCluster(articles: ArticleRecord[]): string {
  const best = [...articles]
    .map((a) => a.summary || a.contentSnippet)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];
  return best ?? "Coverage is still thin, but several outlets are converging on the same story.";
}

export interface EnrichedCluster extends ClusteredStory {
  potentialScore: number;
  scoreBreakdown: ScoreBreakdown;
  isWireDriven: boolean;
  entityTags: string[];
  country: string;
  municipalitySpread: number;
  regionSpread: number;
}

function buildEnrichedScoreContext(
  articles: ArticleRecord[],
  region: string,
  topic: string,
  entities: string[],
  isWireDriven: boolean,
): StoryScoreContext & {
  entities: string[];
  isWireDriven: boolean;
  sourceMetas: (SourceMeta | undefined)[];
} {
  const sourceIds = unique(articles.map((a) => a.sourceId));
  const majorSourceIds = unique(
    articles.filter((a) => a.majorOutlet).map((a) => a.sourceId),
  );
  const internationalSourceIds = unique(
    articles
      .filter((a) => a.sourceRegion !== region || a.sourceRegion === "Global")
      .map((a) => a.sourceId),
  );
  const publishedAtValues = articles.map((a) => a.publishedAt);
  const firstSeenAt = publishedAtValues.reduce((earliest, current) =>
    new Date(current) < new Date(earliest) ? current : earliest,
  );
  const lastUpdatedAt = publishedAtValues.reduce((latest, current) =>
    new Date(current) > new Date(latest) ? current : latest,
  );

  const sourceMetas = articles.map((a) => getSourceMeta(a.sourceSlug));

  return {
    articleCount: articles.length,
    sourceCount: sourceIds.length,
    majorSourceCount: majorSourceIds.length,
    internationalSourceCount: internationalSourceIds.length,
    firstSeenAt,
    lastUpdatedAt,
    region,
    topic,
    articles,
    entities,
    isWireDriven,
    sourceMetas,
  };
}

function buildClusterFromPrepared(
  preparedArticles: PreparedArticle[],
  clusterId?: string,
): EnrichedCluster {
  const articles = preparedArticles.map((pa) => pa.article);
  const sortedArticles = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const representative = pickRepresentativeArticle(sortedArticles);
  const region = dominantValue(sortedArticles.map((a) => a.region), representative.region);
  const topic = dominantValue(sortedArticles.map((a) => a.topic), representative.topic);

  // Collect all entities from the cluster
  const allEntities = unique(preparedArticles.flatMap((pa) => pa.entities));

  // Wire detection
  const wireResult = detectWireCluster(preparedArticles);

  // Score context
  const scoreContext = buildEnrichedScoreContext(
    sortedArticles, region, topic, allEntities, wireResult.isWireDriven,
  );

  // Source metadata analysis
  const sourceMetas = unique(sortedArticles.map((a) => a.sourceSlug))
    .map((slug) => getSourceMeta(slug))
    .filter(Boolean) as SourceMeta[];

  const municipalities = unique(sourceMetas.map((m) => m.municipality).filter(Boolean) as string[]);
  const regions = unique(sourceMetas.map((m) => m.region));
  const dominantCountry = dominantValue(sourceMetas.map((m) => m.country), "");

  // Compute scores
  const { score: radarScore, breakdown: radarBreakdown } = computeRadarScore(scoreContext);
  const { score: overlookedScore, breakdown: overlookedBreakdown } = computeOverlookedScore(scoreContext);
  const { score: potentialScore, breakdown: potentialBreakdown } = computePotentialScore(scoreContext);

  const scoreBreakdown: ScoreBreakdown = {
    radar: radarBreakdown,
    overlooked: overlookedBreakdown,
    potential: potentialBreakdown,
  };

  // Stable ID
  const sourceFrequency = sortByFrequency(sortedArticles.map((a) => a.sourceName));
  const firstSeenDay = scoreContext.firstSeenAt.slice(0, 10);
  const stableKey = unique(sortedArticles.map((a) => a.normalizedTitle))
    .sort()
    .slice(0, 3)
    .join("|");
  const now = new Date().toISOString();

  const finalId = clusterId ?? createStableId(`${stableKey}|${firstSeenDay}`, "cluster");

  return {
    id: finalId,
    clusterTitle: representative.title,
    summary: summarizeCluster(sortedArticles),
    firstSeenAt: scoreContext.firstSeenAt,
    lastUpdatedAt: scoreContext.lastUpdatedAt,
    sourceCount: scoreContext.sourceCount,
    majorSourceCount: scoreContext.majorSourceCount,
    internationalSourceCount: scoreContext.internationalSourceCount,
    radarScore,
    overlookedScore,
    potentialScore,
    topic,
    region,
    whyItMatters: buildWhyItMattersV2(scoreContext, radarBreakdown),
    overlookedReason: buildOverlookedReasonV2(scoreContext, overlookedBreakdown),
    representativeArticleId: representative.id,
    topSourceNames: sourceFrequency.slice(0, 3),
    articles: sortedArticles,
    createdAt: now,
    updatedAt: now,
    scoreBreakdown,
    isWireDriven: wireResult.isWireDriven,
    entityTags: allEntities.slice(0, 10),
    country: dominantCountry,
    municipalitySpread: municipalities.length,
    regionSpread: regions.length,
  };
}

// ─── Pipeline entry point ───────────────────────────────────────────────────

export interface ClusteringOutput {
  clusters: EnrichedCluster[];
  debugPairs: ComparisonResult[];
  stats: {
    totalArticles: number;
    totalClusters: number;
    singletons: number;
    size2to3: number;
    size4to10: number;
    size10plus: number;
  };
}

export function runClusteringPipeline(rawArticles: ArticleRecord[]): ClusteringOutput {
  // Stage 1: Normalize
  const deduped = dedupeArticles(rawArticles);
  const prepared = deduped.map(prepareArticle);

  // Stages 2-4: Compare, Score, Merge
  const { clusters: mergedClusters, debugPairs } = mergeArticles(prepared);

  // Stage 5: Validate — build enriched cluster records
  const clusters: EnrichedCluster[] = [];
  for (const [, preparedArticles] of mergedClusters) {
    const cluster = buildClusterFromPrepared(preparedArticles);
    clusters.push(cluster);
  }

  // Sort by radar score
  clusters.sort((a, b) => b.radarScore - a.radarScore);

  // Stats
  const singletons = clusters.filter((c) => c.articles.length === 1).length;
  const size2to3 = clusters.filter((c) => c.articles.length >= 2 && c.articles.length <= 3).length;
  const size4to10 = clusters.filter((c) => c.articles.length >= 4 && c.articles.length <= 10).length;
  const size10plus = clusters.filter((c) => c.articles.length > 10).length;

  return {
    clusters,
    debugPairs,
    stats: {
      totalArticles: deduped.length,
      totalClusters: clusters.length,
      singletons,
      size2to3,
      size4to10,
      size10plus,
    },
  };
}

/**
 * Recompute a cluster from its articles, keeping the existing cluster ID.
 */
export function recomputeCluster(clusterId: string, articles: ArticleRecord[]): EnrichedCluster {
  const prepared = articles.map(prepareArticle);
  return buildClusterFromPrepared(prepared, clusterId);
}
