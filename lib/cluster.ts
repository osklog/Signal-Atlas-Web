import {
  createStableId,
  extractKeywords,
  headlineSimilarity,
  jaccardSimilarity,
} from "@/lib/normalize";
import { computeOverlookedScore, computeRadarScore } from "@/lib/ranking";
import type { ArticleRecord, ClusteredStory, StoryScoreContext } from "@/lib/types";
import { countBy, hoursBetween, sortByFrequency, unique } from "@/lib/utils";
import { buildOverlookedReason, buildWhyItMatters } from "@/lib/why-it-matters";

interface WorkingCluster {
  articles: ArticleRecord[];
}

function dedupeArticles(articles: ArticleRecord[]) {
  const seen = new Set<string>();
  const kept: ArticleRecord[] = [];

  for (const article of articles) {
    const fingerprint = `${article.sourceId}|${article.url}|${article.normalizedTitle}`;

    if (seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    kept.push(article);
  }

  return kept;
}

function pickRepresentativeArticle(articles: ArticleRecord[]) {
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

function computeMatchScore(article: ArticleRecord, cluster: WorkingCluster) {
  const representative = pickRepresentativeArticle(cluster.articles);
  const clusterKeywords = unique(
    cluster.articles.flatMap((item) => (item.keywords.length ? item.keywords : extractKeywords(item.title))),
  );
  const titleScore = headlineSimilarity(article.normalizedTitle, representative.normalizedTitle);
  const keywordScore = jaccardSimilarity(article.keywords, clusterKeywords);
  const timeGapHours = Math.min(
    ...cluster.articles.map((existing) => hoursBetween(existing.publishedAt, article.publishedAt)),
  );
  const timeScore =
    timeGapHours <= 12 ? 1 : timeGapHours <= 24 ? 0.7 : timeGapHours <= 48 ? 0.4 : 0;
  const sameSourcePenalty = cluster.articles.some((existing) => existing.sourceId === article.sourceId)
    ? 0.08
    : 0;

  return titleScore * 0.52 + keywordScore * 0.34 + timeScore * 0.14 - sameSourcePenalty;
}

function summarizeCluster(articles: ArticleRecord[]) {
  const summarySource = [...articles]
    .map((article) => article.summary || article.contentSnippet)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)[0];

  return summarySource ?? "Coverage is still thin, but several outlets are converging on the same story.";
}

function dominantValue(values: string[], fallback: string) {
  const counts = countBy(values);
  const winner = Object.entries(counts).sort((left, right) => {
    if (right[1] === left[1]) {
      return left[0].localeCompare(right[0]);
    }

    return right[1] - left[1];
  })[0]?.[0];

  return winner ?? fallback;
}

function buildStoryScoreContext(articles: ArticleRecord[], region: string, topic: string): StoryScoreContext {
  const sourceIds = unique(articles.map((article) => article.sourceId));
  const majorSourceIds = unique(
    articles.filter((article) => article.majorOutlet).map((article) => article.sourceId),
  );
  const internationalSourceIds = unique(
    articles
      .filter((article) => article.sourceRegion !== region || article.sourceRegion === "Global")
      .map((article) => article.sourceId),
  );
  const publishedAtValues = articles.map((article) => article.publishedAt);
  const firstSeenAt = publishedAtValues.reduce((earliest, current) =>
    new Date(current) < new Date(earliest) ? current : earliest,
  );
  const lastUpdatedAt = publishedAtValues.reduce((latest, current) =>
    new Date(current) > new Date(latest) ? current : latest,
  );

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
  };
}

export function buildClusterRecord(articlesInput: ArticleRecord[]): ClusteredStory {
  const cluster: WorkingCluster = {
    articles: articlesInput,
  };
  const articles = [...cluster.articles].sort(
    (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
  );
  const representative = pickRepresentativeArticle(articles);
  const region = dominantValue(articles.map((article) => article.region), representative.region);
  const topic = dominantValue(articles.map((article) => article.topic), representative.topic);
  const scoreContext = buildStoryScoreContext(articles, region, topic);
  const sourceFrequency = sortByFrequency(articles.map((article) => article.sourceName));
  const firstSeenDay = scoreContext.firstSeenAt.slice(0, 10);
  const stableKey = unique(articles.map((article) => article.normalizedTitle))
    .sort()
    .slice(0, 3)
    .join("|");
  const now = new Date().toISOString();

  return {
    id: createStableId(`${stableKey}|${firstSeenDay}`, "cluster"),
    clusterTitle: representative.title,
    summary: summarizeCluster(articles),
    firstSeenAt: scoreContext.firstSeenAt,
    lastUpdatedAt: scoreContext.lastUpdatedAt,
    sourceCount: scoreContext.sourceCount,
    majorSourceCount: scoreContext.majorSourceCount,
    internationalSourceCount: scoreContext.internationalSourceCount,
    radarScore: computeRadarScore(scoreContext),
    overlookedScore: computeOverlookedScore(scoreContext),
    topic,
    region,
    whyItMatters: buildWhyItMatters(scoreContext),
    overlookedReason: buildOverlookedReason(scoreContext),
    representativeArticleId: representative.id,
    topSourceNames: sourceFrequency.slice(0, 3),
    articles,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildStoryClusters(articles: ArticleRecord[]) {
  const sortedArticles = dedupeArticles(articles).sort(
    (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
  );
  const clusters: WorkingCluster[] = [];

  for (const article of sortedArticles) {
    let bestMatch: WorkingCluster | null = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score = computeMatchScore(article, cluster);
      const closestTimeGap = Math.min(
        ...cluster.articles.map((existing) => hoursBetween(existing.publishedAt, article.publishedAt)),
      );

      if (closestTimeGap > 60) {
        continue;
      }

      if (score > 0.49 && score > bestScore) {
        bestScore = score;
        bestMatch = cluster;
      }
    }

    if (bestMatch) {
      bestMatch.articles.push(article);
    } else {
      clusters.push({
        articles: [article],
      });
    }
  }

  return clusters
    .map((cluster) => buildClusterRecord(cluster.articles))
    .filter((cluster) => cluster.articles.length > 0)
    .sort((left, right) => right.radarScore - left.radarScore);
}
