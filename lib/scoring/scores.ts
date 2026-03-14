/**
 * Phase 3: Three explicit scoring models — radar, overlooked, potential.
 * Every score outputs a breakdown JSON showing factor contributions.
 */

import { getSourceMeta, type SourceMeta } from "@/lib/sources-metadata";
import type { StoryScoreContext } from "@/lib/types";
import { clamp, hoursBetween, roundScore, unique } from "@/lib/utils";

export interface ScoreFactors {
  [key: string]: number;
}

export interface ScoreBreakdown {
  radar: ScoreFactors;
  overlooked: ScoreFactors;
  potential: ScoreFactors;
  [key: string]: ScoreFactors;
}

type EnrichedScoreContext = StoryScoreContext & {
  entities?: string[];
  isWireDriven?: boolean;
  sourceMetas?: (SourceMeta | undefined)[];
};

function getSourceMetas(ctx: EnrichedScoreContext): SourceMeta[] {
  if (ctx.sourceMetas) {
    return ctx.sourceMetas.filter(Boolean) as SourceMeta[];
  }
  return unique(ctx.articles.map((a) => a.sourceSlug))
    .map((slug) => getSourceMeta(slug))
    .filter(Boolean) as SourceMeta[];
}

// ─── Shannon diversity ──────────────────────────────────────────────────────

function shannonDiversity(values: string[]): number {
  if (values.length <= 1) return 0;
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const total = values.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  // Normalize to 0-1 range
  const maxEntropy = Math.log2(counts.size);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

// ─── Ownership-aware diversity ──────────────────────────────────────────────

function ownershipAwareDiversity(metas: SourceMeta[]): number {
  if (metas.length <= 1) return 0;
  const groups = metas.map((m) => m.ownershipGroup ?? m.slug);
  return shannonDiversity(groups);
}

// ─── 1. RADAR SCORE ─────────────────────────────────────────────────────────

export function computeRadarScore(ctx: EnrichedScoreContext): { score: number; breakdown: ScoreFactors } {
  const metas = getSourceMetas(ctx);

  // Weighted source breadth (sublinear: breadth^0.8)
  const tierWeights = metas.map((m) => {
    switch (m.tier) {
      case 1: return 3;
      case 2: return 2;
      case 3: return 1;
      default: return 0.5;
    }
  });
  const weightedBreadth = tierWeights.reduce((s, w) => s + w, 0);
  const breadthScore = clamp(Math.pow(weightedBreadth, 0.8) * 3, 0, 28);

  // Source diversity (ownership-aware normalized shannon)
  const diversityRaw = ownershipAwareDiversity(metas);
  const diversityScore = clamp(diversityRaw * 22, 0, 22);

  // Pickup velocity (articles in last 6h)
  const now = Date.now();
  const articlesLast6h = ctx.articles.filter(
    (a) => (now - new Date(a.publishedAt).getTime()) / (1000 * 60 * 60) <= 6,
  ).length;
  const velocityScore = clamp(articlesLast6h * 4, 0, 16);

  // Acceleration (articles in last 3h vs 3-6h)
  const articlesLast3h = ctx.articles.filter(
    (a) => (now - new Date(a.publishedAt).getTime()) / (1000 * 60 * 60) <= 3,
  ).length;
  const articles3to6h = articlesLast6h - articlesLast3h;
  const acceleration = articles3to6h > 0 ? (articlesLast3h / articles3to6h) : (articlesLast3h > 0 ? 2 : 0);
  const accelerationScore = clamp(acceleration * 4, 0, 12);

  // Freshness decay (gravity-style)
  const ageHours = hoursBetween(ctx.lastUpdatedAt, new Date());
  const freshnessScore = clamp(24 / (1 + ageHours * 0.15), 2, 22);

  const total = roundScore(clamp(
    breadthScore + diversityScore + velocityScore + accelerationScore + freshnessScore,
    0, 100,
  ));

  return {
    score: total,
    breakdown: {
      breadth: roundScore(breadthScore),
      diversity: roundScore(diversityScore),
      velocity: roundScore(velocityScore),
      acceleration: roundScore(accelerationScore),
      freshness: roundScore(freshnessScore),
    },
  };
}

// ─── 2. OVERLOOKED SCORE ────────────────────────────────────────────────────

export function computeOverlookedScore(ctx: EnrichedScoreContext): { score: number; breakdown: ScoreFactors } {
  const metas = getSourceMetas(ctx);

  // Gate: at least 2 unique independent sources
  const independentSources = unique(
    metas.filter((m) => m.type !== "wire").map((m) => m.ownershipGroup ?? m.slug),
  );
  if (independentSources.length < 2) {
    return { score: 0, breakdown: { gated: 1 } };
  }

  // Gate: zero tier-1 outlets
  const tier1Count = metas.filter((m) => m.tier === 1).length;
  if (tier1Count > 0) {
    return { score: 0, breakdown: { tier1_present: tier1Count } };
  }

  // Gate: not wire-driven
  if (ctx.isWireDriven) {
    return { score: 0, breakdown: { wire_driven: 1 } };
  }

  // Source count
  const sourceCountScore = clamp(ctx.sourceCount * 8, 0, 28);

  // Regional diversity
  const regionDiv = shannonDiversity(metas.map((m) => m.region));
  const regionalScore = clamp(regionDiv * 20, 0, 20);

  // Time without major pickup
  const ageHours = hoursBetween(ctx.firstSeenAt, new Date());
  const timeWithoutPickup = clamp(ageHours * 0.6, 0, 18);

  // Public interest keywords
  const PUBLIC_INTEREST = [
    "miljö", "hälsa", "skola", "vård", "sjukvård", "kommun", "budget",
    "polis", "brott", "migration", "klimat", "corruption", "investigation",
    "environment", "health", "education", "budget", "police", "crime",
    "housing", "infrastructure", "rights", "safety", "water", "pollution",
  ];
  const allText = ctx.articles.map((a) => `${a.title} ${a.summary}`).join(" ").toLowerCase();
  const publicInterestHits = PUBLIC_INTEREST.filter((kw) => allText.includes(kw)).length;
  const publicInterestScore = clamp(publicInterestHits * 3, 0, 15);

  // Institutional relevance bonus
  const institutionalSources = metas.filter((m) => m.type === "institutional").length;
  const institutionalScore = clamp(institutionalSources * 5, 0, 12);

  // Penalties
  const LOCAL_FLUFF = ["väder", "trafik", "weather", "traffic", "sport", "fotboll"];
  const isLocalFluff = LOCAL_FLUFF.some((kw) => allText.includes(kw));
  const fluffPenalty = isLocalFluff ? 15 : 0;

  const total = roundScore(clamp(
    sourceCountScore + regionalScore + timeWithoutPickup +
    publicInterestScore + institutionalScore - fluffPenalty,
    0, 100,
  ));

  return {
    score: total,
    breakdown: {
      source_count: roundScore(sourceCountScore),
      regional_diversity: roundScore(regionalScore),
      time_without_pickup: roundScore(timeWithoutPickup),
      public_interest: roundScore(publicInterestScore),
      institutional: roundScore(institutionalScore),
      fluff_penalty: roundScore(-fluffPenalty),
    },
  };
}

// ─── 3. POTENTIAL SCORE ─────────────────────────────────────────────────────

export function computePotentialScore(ctx: EnrichedScoreContext): { score: number; breakdown: ScoreFactors } {
  const metas = getSourceMetas(ctx);
  if (metas.length === 0) {
    return { score: 0, breakdown: {} };
  }

  // Tier momentum: local→regional→national progression
  const tiers = metas.map((m) => m.tier).sort();
  const hasTier3 = tiers.includes(3);
  const hasTier2 = tiers.includes(2);
  const hasTier1 = tiers.includes(1);
  let tierMomentum = 0;
  if (hasTier3 && hasTier2 && !hasTier1) tierMomentum = 20;
  else if (hasTier3 && !hasTier2 && !hasTier1) tierMomentum = 12;
  else if (hasTier2 && !hasTier1) tierMomentum = 8;
  const tierMomentumScore = clamp(tierMomentum, 0, 20);

  // Geographic spread
  const geoRegions = unique(metas.map((m) => m.region));
  const geoSpreadScore = clamp(geoRegions.length * 4, 0, 16);

  // Institutional relevance
  const institutionalCount = metas.filter((m) => m.type === "institutional").length;
  const institutionalScore = clamp(institutionalCount * 6, 0, 14);

  // Persistence over time
  const spanHours = hoursBetween(ctx.firstSeenAt, ctx.lastUpdatedAt);
  const persistenceScore = clamp(spanHours * 0.5, 0, 12);

  // Acceleration
  const now = Date.now();
  const recent = ctx.articles.filter(
    (a) => (now - new Date(a.publishedAt).getTime()) / (1000 * 60 * 60) <= 6,
  ).length;
  const accelerationScore = clamp(recent * 3, 0, 12);

  // Absence of tier-1 pickup (bonus when tier-1 is not covering it)
  const noTier1Bonus = hasTier1 ? 0 : 10;

  // Resurgence bonus: if story went quiet (>12h gap) and is now active again
  const sortedTimes = ctx.articles
    .map((a) => new Date(a.publishedAt).getTime())
    .sort();
  let maxGap = 0;
  for (let i = 1; i < sortedTimes.length; i++) {
    const gap = sortedTimes[i] - sortedTimes[i - 1];
    if (gap > maxGap) maxGap = gap;
  }
  const maxGapHours = maxGap / (1000 * 60 * 60);
  const ageOfNewest = (now - sortedTimes[sortedTimes.length - 1]) / (1000 * 60 * 60);
  const resurgenceBonus = (maxGapHours > 12 && ageOfNewest < 6) ? 8 : 0;

  // Sweden-specific: municipality spread bonus
  const municipalities = unique(
    metas.map((m) => m.municipality).filter(Boolean) as string[],
  );
  const municipalityBonus = clamp(municipalities.length * 3, 0, 10);

  // National candidate bonus: story spanning 3+ Swedish regions
  const sweRegions = unique(
    metas.filter((m) => m.country === "SE").map((m) => m.region),
  );
  const nationalCandidateBonus = sweRegions.length >= 3 ? 8 : 0;

  const total = roundScore(clamp(
    tierMomentumScore + geoSpreadScore + institutionalScore +
    persistenceScore + accelerationScore + noTier1Bonus +
    resurgenceBonus + municipalityBonus + nationalCandidateBonus,
    0, 100,
  ));

  return {
    score: total,
    breakdown: {
      tier_momentum: roundScore(tierMomentumScore),
      geographic_spread: roundScore(geoSpreadScore),
      institutional: roundScore(institutionalScore),
      persistence: roundScore(persistenceScore),
      acceleration: roundScore(accelerationScore),
      no_tier1_bonus: roundScore(noTier1Bonus),
      resurgence: roundScore(resurgenceBonus),
      municipality_spread: roundScore(municipalityBonus),
      national_candidate: roundScore(nationalCandidateBonus),
    },
  };
}
