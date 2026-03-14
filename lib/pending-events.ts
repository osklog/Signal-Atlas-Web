/**
 * Phase 3 add-on: Pending-event detection.
 *
 * Parses article text for future temporal references:
 *   - nästa vecka, på fredag, planerar att, beslutas den
 *   - next week, on friday, scheduled to, will decide
 *
 * Creates pending_event records when found.
 */

import { createStableId } from "@/lib/normalize";
import type { ArticleRecord } from "@/lib/types";

export interface PendingEvent {
  id: string;
  articleId: string;
  clusterId?: string;
  eventText: string;
  eventType: string;
  detectedDate?: string;
  confidence: number;
}

interface PatternDef {
  pattern: RegExp;
  type: string;
  confidence: number;
}

const SWEDISH_PATTERNS: PatternDef[] = [
  { pattern: /nästa vecka\b/i, type: "future_reference", confidence: 0.7 },
  { pattern: /på (måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)/i, type: "future_reference", confidence: 0.65 },
  { pattern: /planerar att\b/i, type: "planned_action", confidence: 0.6 },
  { pattern: /beslutas den\b/i, type: "decision_pending", confidence: 0.7 },
  { pattern: /ska (beslutas|avgöras|presenteras|offentliggöras)/i, type: "decision_pending", confidence: 0.7 },
  { pattern: /i (morgon|övermorgon)\b/i, type: "future_reference", confidence: 0.75 },
  { pattern: /under (kommande|nästa) (vecka|månad)/i, type: "future_reference", confidence: 0.65 },
  { pattern: /väntas (komma|presentera|besluta|offentliggöra)/i, type: "expected_action", confidence: 0.6 },
  { pattern: /den \d{1,2} (januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)/i, type: "specific_date", confidence: 0.8 },
];

const ENGLISH_PATTERNS: PatternDef[] = [
  { pattern: /next week\b/i, type: "future_reference", confidence: 0.65 },
  { pattern: /on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, type: "future_reference", confidence: 0.6 },
  { pattern: /scheduled to\b/i, type: "planned_action", confidence: 0.65 },
  { pattern: /will (announce|decide|release|present|vote)/i, type: "expected_action", confidence: 0.6 },
  { pattern: /expected (to|by)\b/i, type: "expected_action", confidence: 0.55 },
  { pattern: /set to (begin|start|open|launch)/i, type: "planned_action", confidence: 0.65 },
  { pattern: /tomorrow\b/i, type: "future_reference", confidence: 0.7 },
];

const ALL_PATTERNS = [...SWEDISH_PATTERNS, ...ENGLISH_PATTERNS];

/**
 * Scan an article for pending-event signals.
 * Returns zero or more PendingEvent records.
 */
export function detectPendingEvents(article: ArticleRecord, clusterId?: string): PendingEvent[] {
  const text = `${article.title} ${article.summary || ""} ${article.contentSnippet || ""}`;
  const events: PendingEvent[] = [];
  const seen = new Set<string>();

  for (const def of ALL_PATTERNS) {
    const match = text.match(def.pattern);
    if (!match) continue;

    const eventText = match[0];
    const dedupeKey = `${def.type}:${eventText.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    // Extract surrounding context (40 chars before, 60 after)
    const idx = text.indexOf(eventText);
    const contextStart = Math.max(0, idx - 40);
    const contextEnd = Math.min(text.length, idx + eventText.length + 60);
    const context = text.slice(contextStart, contextEnd).replace(/\s+/g, " ").trim();

    events.push({
      id: createStableId(`${article.id}|${dedupeKey}`, "pevent"),
      articleId: article.id,
      clusterId,
      eventText: context,
      eventType: def.type,
      confidence: def.confidence,
    });
  }

  return events;
}

/**
 * Scan all articles for pending events.
 */
export function detectAllPendingEvents(
  articles: ArticleRecord[],
  clusterMap?: Map<string, string>,
): PendingEvent[] {
  const events: PendingEvent[] = [];
  for (const article of articles) {
    const clusterId = clusterMap?.get(article.id);
    events.push(...detectPendingEvents(article, clusterId));
  }
  return events;
}
