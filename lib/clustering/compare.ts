/**
 * Phase 1, Stages 2–3: Pairwise comparison and composite scoring.
 *
 * Signals: headline similarity, entity overlap, time decay, body overlap,
 *          cross-source bonus.
 *
 * Gating: 72h window, ≥1 shared entity, headline sim ≥ 0.15.
 */

import type { ArticleRecord } from "@/lib/types";
import { charShingles, normalizeHeadline, wordBigrams } from "./normalize";

export interface ComparisonResult {
  articleAId: string;
  articleBId: string;
  headlineSimilarity: number;
  entitySimilarity: number;
  timeSimilarity: number;
  bodySimilarity: number;
  crossSourceBonus: number;
  compositeScore: number;
  decision: "merge" | "related" | "reject";
  sharedEntities: string[];
}

// ─── Precomputed article data for fast pairwise comparison ──────────────────

export interface PreparedArticle {
  article: ArticleRecord;
  slug: string;
  tokens: string[];
  entities: string[];
  bodyBigrams: Set<string>;
  bodyShingles: Set<string>;
  publishedAtMs: number;
}

export function prepareArticle(article: ArticleRecord): PreparedArticle {
  const { slug, tokens, entities } = normalizeHeadline(article.title);
  const bodyText = article.contentSnippet || article.summary || "";
  return {
    article,
    slug,
    tokens,
    entities,
    bodyBigrams: wordBigrams(bodyText),
    bodyShingles: charShingles(bodyText),
    publishedAtMs: new Date(article.publishedAt).getTime(),
  };
}

// ─── Similarity functions ───────────────────────────────────────────────────

function jaccardTokens(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  const smaller = a.size < b.size ? a : b;
  const larger = a.size < b.size ? b : a;
  for (const item of smaller) {
    if (larger.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function entityOverlap(a: string[], b: string[]): { similarity: number; shared: string[] } {
  if (!a.length || !b.length) return { similarity: 0, shared: [] };
  const setA = new Set(a);
  const shared: string[] = [];
  for (const entity of b) {
    if (setA.has(entity)) shared.push(entity);
  }
  const union = new Set([...a, ...b]).size;
  return {
    similarity: union === 0 ? 0 : shared.length / union,
    shared,
  };
}

function timeSimilarity(msA: number, msB: number): number {
  const hours = Math.abs(msA - msB) / (1000 * 60 * 60);
  if (hours <= 6) return 1.0;
  if (hours <= 12) return 0.85;
  if (hours <= 24) return 0.65;
  if (hours <= 48) return 0.35;
  if (hours <= 72) return 0.15;
  return 0;
}

// ─── Composite comparison ───────────────────────────────────────────────────

const WEIGHTS = {
  headline: 0.30,
  entity: 0.30,
  time: 0.15,
  body: 0.15,
  crossSource: 0.10,
} as const;

const MERGE_THRESHOLD = 0.45;
const RELATED_THRESHOLD = 0.30;
const HEADLINE_GATE = 0.15;
const MAX_TIME_WINDOW_HOURS = 72;

export function compareArticles(a: PreparedArticle, b: PreparedArticle): ComparisonResult | null {
  // Gate: 72h window
  const hourDiff = Math.abs(a.publishedAtMs - b.publishedAtMs) / (1000 * 60 * 60);
  if (hourDiff > MAX_TIME_WINDOW_HOURS) return null;

  // Gate: entity overlap
  const { similarity: entitySim, shared: sharedEntities } = entityOverlap(a.entities, b.entities);
  if (sharedEntities.length === 0) {
    // Relaxed gate: if headline similarity is very high, allow entity-less pairs
    const headSim = jaccardTokens(a.tokens, b.tokens);
    if (headSim < 0.4) return null;
    // Proceed but entitySim stays 0
  }

  // Headline similarity
  const headlineSim = jaccardTokens(a.tokens, b.tokens);
  if (headlineSim < HEADLINE_GATE) return null;

  // Body similarity (use bigrams primarily, fall back to shingles)
  let bodySim = jaccardSets(a.bodyBigrams, b.bodyBigrams);
  if (bodySim === 0) {
    bodySim = jaccardSets(a.bodyShingles, b.bodyShingles);
  }

  // Time similarity
  const timeSim = timeSimilarity(a.publishedAtMs, b.publishedAtMs);

  // Cross-source bonus
  const crossSourceBonus = a.article.sourceId !== b.article.sourceId ? 1.0 : 0.0;

  // Composite score
  const compositeScore =
    WEIGHTS.headline * headlineSim +
    WEIGHTS.entity * entitySim +
    WEIGHTS.time * timeSim +
    WEIGHTS.body * bodySim +
    WEIGHTS.crossSource * crossSourceBonus;

  const decision: ComparisonResult["decision"] =
    compositeScore >= MERGE_THRESHOLD ? "merge"
    : compositeScore >= RELATED_THRESHOLD ? "related"
    : "reject";

  return {
    articleAId: a.article.id,
    articleBId: b.article.id,
    headlineSimilarity: Math.round(headlineSim * 10000) / 10000,
    entitySimilarity: Math.round(entitySim * 10000) / 10000,
    timeSimilarity: Math.round(timeSim * 10000) / 10000,
    bodySimilarity: Math.round(bodySim * 10000) / 10000,
    crossSourceBonus: Math.round(crossSourceBonus * 10000) / 10000,
    compositeScore: Math.round(compositeScore * 10000) / 10000,
    decision,
    sharedEntities,
  };
}
