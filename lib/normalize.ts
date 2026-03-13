import type { ArticleRecord, FeedSource, RawFeedItem } from "@/lib/types";
import { clamp, truncate } from "@/lib/utils";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "to",
  "up",
  "with",
  "after",
  "amid",
  "over",
  "new",
  "say",
  "says",
]);

const TOPIC_KEYWORDS: Array<{ topic: string; keywords: string[] }> = [
  {
    topic: "Conflict",
    keywords: [
      "attack",
      "ceasefire",
      "clash",
      "defence",
      "fighter",
      "missile",
      "military",
      "rebel",
      "strike",
      "troops",
      "war",
    ],
  },
  {
    topic: "Politics",
    keywords: [
      "ballot",
      "cabinet",
      "court",
      "election",
      "government",
      "minister",
      "parliament",
      "policy",
      "president",
      "vote",
    ],
  },
  {
    topic: "Economy",
    keywords: [
      "budget",
      "copper",
      "debt",
      "economy",
      "inflation",
      "market",
      "mine",
      "shipping",
      "tariff",
      "trade",
    ],
  },
  {
    topic: "Climate",
    keywords: [
      "climate",
      "drought",
      "flood",
      "heatwave",
      "rainfall",
      "storm",
      "weather",
      "wildfire",
      "emissions",
      "ice",
    ],
  },
  {
    topic: "Health",
    keywords: [
      "cholera",
      "disease",
      "health",
      "hospital",
      "outbreak",
      "vaccine",
      "virus",
    ],
  },
  {
    topic: "Technology",
    keywords: [
      "cable",
      "chip",
      "connectivity",
      "cyber",
      "network",
      "satellite",
      "telecom",
      "technology",
      "undersea",
    ],
  },
  {
    topic: "Energy",
    keywords: [
      "electricity",
      "gas",
      "grid",
      "hydro",
      "oil",
      "power",
      "solar",
      "utility",
    ],
  },
];

const REGION_KEYWORDS: Array<{ region: string; keywords: string[] }> = [
  {
    region: "Africa",
    keywords: ["africa", "darfur", "ethiopia", "ghana", "kenya", "nigeria", "sahel", "sudan"],
  },
  {
    region: "Asia",
    keywords: ["asia", "china", "india", "japan", "mekong", "pacific", "seoul", "taiwan"],
  },
  {
    region: "Europe",
    keywords: ["armenia", "azerbaijan", "balkan", "brussels", "caucasus", "europe", "ukraine"],
  },
  {
    region: "Latin America",
    keywords: ["andes", "brazil", "chile", "colombia", "latin america", "peru"],
  },
  {
    region: "Middle East",
    keywords: ["gaza", "iran", "iraq", "israel", "lebanon", "middle east", "syria"],
  },
  {
    region: "North America",
    keywords: ["canada", "mexico", "north america", "united states", "washington"],
  },
  {
    region: "Oceania",
    keywords: ["australia", "fiji", "oceania", "pacific islands", "papua new guinea", "samoa"],
  },
  {
    region: "Global",
    keywords: ["global", "international", "world", "arctic"],
  },
];

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function stripHtml(html: string) {
  return normalizeWhitespace(html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " "));
}

export function normalizeTitle(title: string) {
  return normalizeWhitespace(
    title
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(" ")
      .filter((part) => part && !STOP_WORDS.has(part))
      .join(" "),
  );
}

export function extractKeywords(text: string, limit = 10) {
  const words = normalizeWhitespace(
    stripHtml(text)
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9\s]/g, " "),
  )
    .split(" ")
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] === left[1]) {
        return left[0].localeCompare(right[0]);
      }

      return right[1] - left[1];
    })
    .slice(0, limit)
    .map(([word]) => word);
}

export function jaccardSimilarity(left: string[], right: string[]) {
  if (!left.length || !right.length) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;

  return union === 0 ? 0 : intersection / union;
}

export function headlineSimilarity(left: string, right: string) {
  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);

  return jaccardSimilarity(leftTokens, rightTokens);
}

export function createStableId(seed: string, prefix: string) {
  let hash = 5381;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(index);
  }

  const normalized = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `${prefix}_${normalized || "item"}_${(hash >>> 0).toString(36)}`;
}

export function detectTopic(text: string, fallback = "World") {
  const normalized = stripHtml(text).toLowerCase();

  for (const rule of TOPIC_KEYWORDS) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.topic;
    }
  }

  return fallback;
}

export function detectRegion(text: string, fallback = "Global") {
  const normalized = stripHtml(text).toLowerCase();

  for (const rule of REGION_KEYWORDS) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.region;
    }
  }

  return fallback;
}

function pickImageUrl(item: RawFeedItem) {
  const mediaContent = item["media:content"];

  if (Array.isArray(mediaContent) && mediaContent[0]?.$?.url) {
    return mediaContent[0].$.url;
  }

  if (!Array.isArray(mediaContent) && mediaContent?.$?.url) {
    return mediaContent.$.url;
  }

  return item.enclosure?.url ?? null;
}

export function normalizeFeedItem(source: FeedSource, item: RawFeedItem): ArticleRecord | null {
  const title = normalizeWhitespace(item.title ?? "");
  const url = normalizeWhitespace(item.link ?? "");

  if (!title || !url) {
    return null;
  }

  const summaryBase =
    item.contentSnippet ?? item.summary ?? item["content:encoded"] ?? item.content ?? "";
  const summary = truncate(stripHtml(summaryBase), 220);
  const snippet = truncate(stripHtml(item.content ?? summaryBase), 280);
  const publishedAt = new Date(item.isoDate ?? item.pubDate ?? Date.now());
  const cleanPublishedAt = Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt;
  const now = new Date().toISOString();
  const combinedText = `${title} ${summary} ${snippet}`.trim();
  const region = detectRegion(combinedText, source.region);
  const topic = detectTopic(combinedText);
  const normalizedTitle = normalizeTitle(title);
  const keywords = extractKeywords(combinedText);

  return {
    id: createStableId(`${source.id}|${url}`, "article"),
    sourceId: source.id,
    sourceSlug: source.slug,
    sourceName: source.name,
    sourceHomepageUrl: source.homepageUrl,
    sourceRegion: source.region,
    title,
    url,
    publishedAt: cleanPublishedAt.toISOString(),
    summary,
    author: normalizeWhitespace(item.creator ?? item.author ?? "") || null,
    imageUrl: pickImageUrl(item),
    topic,
    language: source.language,
    region,
    normalizedTitle,
    contentSnippet: snippet,
    keywords,
    majorOutlet: source.isMajor,
    createdAt: now,
    updatedAt: now,
  };
}

export function freshnessBand(lastUpdatedAt: string) {
  const ageHours = clamp(
    Math.abs(Date.now() - new Date(lastUpdatedAt).getTime()) / (1000 * 60 * 60),
    0,
    240,
  );

  if (ageHours <= 6) {
    return "Very fresh";
  }

  if (ageHours <= 18) {
    return "Fresh";
  }

  if (ageHours <= 48) {
    return "Developing";
  }

  return "Ongoing";
}
