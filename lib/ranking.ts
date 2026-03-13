import type { StoryScoreContext } from "@/lib/types";
import { clamp, hoursBetween, roundScore } from "@/lib/utils";

function computeMomentumScore(publishedAtValues: string[]) {
  const now = new Date();
  const withinSixHours = publishedAtValues.filter((value) => hoursBetween(value, now) <= 6).length;
  const withinTwelveHours = publishedAtValues.filter((value) => hoursBetween(value, now) <= 12).length;

  return clamp(withinSixHours * 4 + withinTwelveHours * 2, 0, 20);
}

function computeRecencyScore(lastUpdatedAt: string) {
  const ageHours = hoursBetween(lastUpdatedAt, new Date());
  return clamp(36 - ageHours * 1.35, 4, 36);
}

function computePersistenceScore(firstSeenAt: string, lastUpdatedAt: string) {
  const spanHours = hoursBetween(firstSeenAt, lastUpdatedAt);
  return clamp(spanHours * 1.1, 0, 18);
}

function computeSourceDiversityScore(context: StoryScoreContext) {
  const sourceRegions = new Set(context.articles.map((article) => article.sourceRegion));
  const topicSpread = new Set(context.articles.map((article) => article.topic)).size;

  return clamp(
    context.internationalSourceCount * 3.5 + sourceRegions.size * 2 + topicSpread * 1.2,
    0,
    20,
  );
}

export function computeRadarScore(context: StoryScoreContext) {
  const recency = computeRecencyScore(context.lastUpdatedAt);
  const sourceCoverage = clamp(context.sourceCount * 6.5, 0, 24);
  const momentum = computeMomentumScore(context.articles.map((article) => article.publishedAt));
  const diversity = computeSourceDiversityScore(context);
  const persistence = computePersistenceScore(context.firstSeenAt, context.lastUpdatedAt);

  return roundScore(clamp(recency + sourceCoverage + momentum + diversity + persistence, 0, 100));
}

export function computeOverlookedScore(context: StoryScoreContext) {
  if (context.sourceCount <= 1) {
    return 0;
  }

  const multiSourceBase = clamp(context.sourceCount * 8, 0, 32);
  const lowMajorPickup = clamp((context.sourceCount - context.majorSourceCount) * 7.5, 0, 28);
  const persistence = computePersistenceScore(context.firstSeenAt, context.lastUpdatedAt);
  const internationalLift = clamp(context.internationalSourceCount * 4, 0, 16);
  const majorPenalty = clamp(context.majorSourceCount * 6, 0, 22);

  return roundScore(
    clamp(multiSourceBase + lowMajorPickup + persistence + internationalLift - majorPenalty, 0, 100),
  );
}
