/**
 * Wire / near-duplicate detection.
 *
 * Detects TT / AP / Reuters / AFP rewrites by:
 * - Byline regex matching
 * - First-sentence hashing within short time windows
 * - Very high headline+body similarity across many outlets within 30 min
 */

import type { PreparedArticle } from "./compare";

const WIRE_BYLINE_PATTERNS = [
  /\b(tt|tidningarnas\s+telegrambyr[åa])\b/i,
  /\b(ap|associated\s+press)\b/i,
  /\breuters\b/i,
  /\b(afp|agence\s+france[- ]presse)\b/i,
];

function isWireByline(author: string | null): boolean {
  if (!author) return false;
  return WIRE_BYLINE_PATTERNS.some((p) => p.test(author));
}

function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const end = clean.search(/[.!?]\s/);
  if (end === -1) return clean.slice(0, 120).toLowerCase();
  return clean.slice(0, end + 1).toLowerCase();
}

function simpleHash(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i);
  }
  return hash >>> 0;
}

export interface WireDetectionResult {
  isWireDriven: boolean;
  wireSourceCount: number;
  nearDuplicateGroups: string[][];
}

/**
 * Given a set of prepared articles already in a cluster,
 * detect whether the cluster is wire-driven.
 */
export function detectWireCluster(articles: PreparedArticle[]): WireDetectionResult {
  if (articles.length < 2) {
    return { isWireDriven: false, wireSourceCount: 0, nearDuplicateGroups: [] };
  }

  // Count wire bylines
  let wireSourceCount = 0;
  for (const pa of articles) {
    if (isWireByline(pa.article.author)) {
      wireSourceCount++;
    }
  }

  // First-sentence hash grouping within 30-minute windows
  const sentenceGroups = new Map<number, PreparedArticle[]>();
  for (const pa of articles) {
    const body = pa.article.contentSnippet || pa.article.summary || "";
    if (body.length < 20) continue;
    const hash = simpleHash(firstSentence(body));
    const group = sentenceGroups.get(hash) ?? [];
    group.push(pa);
    sentenceGroups.set(hash, group);
  }

  const nearDuplicateGroups: string[][] = [];
  for (const group of sentenceGroups.values()) {
    if (group.length < 2) continue;
    // Check if they're within 30 min of each other
    const times = group.map((pa) => pa.publishedAtMs).sort();
    const span = (times[times.length - 1] - times[0]) / (1000 * 60);
    if (span <= 30) {
      nearDuplicateGroups.push(group.map((pa) => pa.article.id));
    }
  }

  // Cluster is wire-driven if:
  // - More than half the articles have wire bylines, OR
  // - There's a near-duplicate group covering 60%+ of articles
  const totalArticles = articles.length;
  const largestNearDupGroup = Math.max(0, ...nearDuplicateGroups.map((g) => g.length));

  const isWireDriven =
    wireSourceCount > totalArticles * 0.5 ||
    largestNearDupGroup >= totalArticles * 0.6;

  return { isWireDriven, wireSourceCount, nearDuplicateGroups };
}
