/**
 * Phase 1, Stage 1: Headline normalization with Swedish support.
 *
 * Pipeline: lowercase → strip prefixes → remove punctuation → expand contractions
 *           → remove stopwords → stem → sort → join into comparison slug.
 */

import { ENTITY_ALIASES } from "@/lib/sources-metadata";

// ─── Stopwords ──────────────────────────────────────────────────────────────

const EN_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can",
  "did", "do", "does", "for", "from", "had", "has", "have", "he", "her",
  "him", "his", "how", "if", "in", "into", "is", "it", "its", "may",
  "more", "most", "new", "no", "not", "now", "of", "on", "one", "or",
  "our", "out", "over", "say", "says", "said", "she", "so", "some",
  "than", "that", "the", "their", "them", "then", "there", "these",
  "they", "this", "to", "too", "up", "us", "very", "was", "we", "were",
  "what", "when", "which", "who", "why", "will", "with", "would", "you",
  "your", "after", "amid", "about", "also", "been", "being", "could",
]);

const SV_STOPWORDS = new Set([
  "och", "i", "att", "en", "ett", "det", "som", "är", "av", "för",
  "med", "den", "har", "till", "på", "var", "inte", "om", "de", "så",
  "från", "vi", "kan", "ska", "men", "hade", "sedan", "vid", "efter",
  "där", "nu", "över", "under", "också", "sig", "sina", "sitt", "sin",
  "han", "hon", "dem", "detta", "dessa", "här", "där", "när", "hur",
  "alla", "andra", "bara", "eller", "igen", "ingen", "inget", "inte",
  "kommer", "kunde", "man", "mycket", "många", "måste", "mellan",
  "mot", "redan", "genom", "utan", "vara", "vill", "blir", "blev",
  "ska", "skulle", "samt", "dock", "enligt", "inom",
]);

const ALL_STOPWORDS = new Set([...EN_STOPWORDS, ...SV_STOPWORDS]);

// ─── Prefix / boilerplate patterns to strip ─────────────────────────────────

const STRIP_PREFIXES = /^(breaking|exclusive|opinion|update|updated|analysis|watch|live|just in|report|developing|alert|ap|reuters|afp|tt|nytt|uppdatering|debatt|krönika|ledare)[:\s\-–—|]*/i;

// ─── Simple English / Swedish stemmer ───────────────────────────────────────

function stemToken(token: string): string {
  // Swedish suffixes first
  if (token.length > 5) {
    for (const suffix of ["erna", "arna", "orna", "ande", "ningen", "ighet"]) {
      if (token.endsWith(suffix)) {
        return token.slice(0, -suffix.length);
      }
    }
    for (const suffix of ["ing", "ade", "isk", "ens", "ets", "ars"]) {
      if (token.endsWith(suffix)) {
        return token.slice(0, -suffix.length);
      }
    }
  }
  if (token.length > 4) {
    for (const suffix of ["en", "er", "ar", "or", "et", "na", "as", "es"]) {
      if (token.endsWith(suffix)) {
        return token.slice(0, -suffix.length);
      }
    }
  }
  // English suffixes
  if (token.length > 5) {
    for (const suffix of ["ation", "ment", "ness", "ting", "ous", "ive", "ing", "ies", "ied"]) {
      if (token.endsWith(suffix)) {
        return token.slice(0, -suffix.length);
      }
    }
  }
  if (token.length > 4) {
    for (const suffix of ["ed", "ly", "er", "es"]) {
      if (token.endsWith(suffix)) {
        return token.slice(0, -suffix.length);
      }
    }
  }
  if (token.endsWith("s") && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

// ─── Named entity extraction ────────────────────────────────────────────────

const ENTITY_PATTERN = /\b[A-ZÅÄÖ][a-zåäöé]{2,}(?:\s+(?:von|van|de|al|bin|del|af)\s+)?(?:[A-ZÅÄÖ][a-zåäöé]+)*/g;

/**
 * Extract capitalized multi-word names from the raw (pre-lowercased) title.
 * Returns normalized entity strings.
 */
export function extractEntities(rawText: string): string[] {
  const matches = rawText.match(ENTITY_PATTERN) ?? [];
  const entities = new Set<string>();
  for (const match of matches) {
    const normalized = match.toLowerCase().trim();
    if (normalized.length < 3) continue;
    if (ALL_STOPWORDS.has(normalized)) continue;
    const aliased = ENTITY_ALIASES[normalized] ?? normalized;
    entities.add(aliased);
  }
  return [...entities];
}

/**
 * Full headline normalization pipeline.
 * Returns { slug, tokens, entities } for downstream comparison.
 */
export function normalizeHeadline(rawTitle: string): {
  slug: string;
  tokens: string[];
  entities: string[];
} {
  const entities = extractEntities(rawTitle);

  let text = rawTitle.toLowerCase();
  // Strip outlet prefixes / boilerplate
  text = text.replace(STRIP_PREFIXES, "");
  // Remove punctuation except hyphens between word chars
  text = text
    .replace(/[''`]/g, "")
    .replace(/(?<=[a-zåäö0-9])-(?=[a-zåäö0-9])/g, "HYPHEN_PLACEHOLDER")
    .replace(/[^a-zåäö0-9\s]/g, " ")
    .replace(/HYPHEN_PLACEHOLDER/g, "-");

  const rawTokens = text.split(/\s+/).filter(Boolean);
  const tokens = rawTokens
    .filter((t) => !ALL_STOPWORDS.has(t) && t.length > 1)
    .map(stemToken);

  const slug = [...tokens].sort().join(" ");

  return { slug, tokens, entities };
}

/**
 * Build character-level shingles (for body similarity).
 */
export function charShingles(text: string, k = 5): Set<string> {
  const clean = text.toLowerCase().replace(/\s+/g, " ").trim();
  const shingles = new Set<string>();
  for (let i = 0; i <= clean.length - k; i++) {
    shingles.add(clean.slice(i, i + k));
  }
  return shingles;
}

/**
 * Build word bigrams (for body similarity).
 */
export function wordBigrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !ALL_STOPWORDS.has(w));
  const bigrams = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}
