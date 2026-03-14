/**
 * Clustering entry point — delegates to the new five-stage pipeline.
 * Preserves the old API surface (buildStoryClusters, buildClusterRecord)
 * so existing scripts and repository code continue to work.
 */

import type { ArticleRecord, ClusteredStory } from "@/lib/types";
import { runClusteringPipeline, recomputeCluster, type EnrichedCluster, type ClusteringOutput } from "@/lib/clustering/pipeline";

/**
 * Convert an EnrichedCluster to the standard ClusteredStory type.
 */
function toClusteredStory(ec: EnrichedCluster): ClusteredStory {
  return {
    id: ec.id,
    clusterTitle: ec.clusterTitle,
    summary: ec.summary,
    firstSeenAt: ec.firstSeenAt,
    lastUpdatedAt: ec.lastUpdatedAt,
    sourceCount: ec.sourceCount,
    majorSourceCount: ec.majorSourceCount,
    internationalSourceCount: ec.internationalSourceCount,
    radarScore: ec.radarScore,
    overlookedScore: ec.overlookedScore,
    potentialScore: ec.potentialScore,
    topic: ec.topic,
    region: ec.region,
    whyItMatters: ec.whyItMatters,
    overlookedReason: ec.overlookedReason,
    representativeArticleId: ec.representativeArticleId,
    topSourceNames: ec.topSourceNames,
    articles: ec.articles,
    createdAt: ec.createdAt,
    updatedAt: ec.updatedAt,
    scoreBreakdown: ec.scoreBreakdown,
    isWireDriven: ec.isWireDriven,
    entityTags: ec.entityTags,
    country: ec.country,
    municipalitySpread: ec.municipalitySpread,
    regionSpread: ec.regionSpread,
  };
}

/**
 * Main clustering entry point. Replaces the old greedy algorithm with
 * the five-stage pipeline (normalize, compare, score, merge, validate).
 */
export function buildStoryClusters(articles: ArticleRecord[]): ClusteredStory[] {
  const output = runClusteringPipeline(articles);
  return output.clusters.map(toClusteredStory);
}

/**
 * Full pipeline output including debug pairs and stats.
 */
export function buildStoryClustersWithDebug(articles: ArticleRecord[]): ClusteringOutput {
  return runClusteringPipeline(articles);
}

/**
 * Build a single cluster from a set of articles.
 */
export function buildClusterRecord(articles: ArticleRecord[]): ClusteredStory {
  const output = runClusteringPipeline(articles);
  // Return the first cluster, or build a single-article cluster
  if (output.clusters.length > 0) {
    return toClusteredStory(output.clusters[0]);
  }
  // Fallback: wrap all articles in one cluster
  return toClusteredStory(recomputeCluster("fallback", articles));
}

/**
 * Recompute scores for an existing cluster, keeping its ID.
 */
export function recomputeClusterKeepingId(clusterId: string, articles: ArticleRecord[]): ClusteredStory {
  return toClusteredStory(recomputeCluster(clusterId, articles));
}
