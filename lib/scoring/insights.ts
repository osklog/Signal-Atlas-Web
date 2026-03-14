/**
 * Generate "why this matters" and "why it may be overlooked" insight text
 * from score breakdowns. Decomposable and transparent.
 */

import type { StoryScoreContext } from "@/lib/types";
import type { ScoreFactors } from "./scores";
import { hoursBetween } from "@/lib/utils";

export function buildWhyItMattersV2(ctx: StoryScoreContext, breakdown: ScoreFactors): string {
  const parts: string[] = [];

  if ((breakdown.velocity ?? 0) > 10) {
    parts.push("Rapid pickup across multiple sources in the last few hours");
  }

  if ((breakdown.diversity ?? 0) > 14) {
    parts.push("Highly diverse source mix — different ownership groups and regions are covering it independently");
  } else if ((breakdown.diversity ?? 0) > 8) {
    parts.push("Source diversity is above average");
  }

  if ((breakdown.breadth ?? 0) > 18) {
    parts.push(`Strong coverage breadth from ${ctx.sourceCount} sources`);
  }

  if ((breakdown.acceleration ?? 0) > 6) {
    parts.push("Coverage is accelerating — more articles in the last 3 hours than the 3 before that");
  }

  const persistenceHours = hoursBetween(ctx.firstSeenAt, ctx.lastUpdatedAt);
  if (persistenceHours >= 18 && ctx.sourceCount >= 3) {
    parts.push(`Persisting for ${Math.round(persistenceHours)}h across multiple outlets`);
  }

  if (ctx.internationalSourceCount >= 3) {
    parts.push("Signals from several geographies suggest the story is spreading beyond a single local frame");
  }

  if (parts.length === 0) {
    return "Steady spread of coverage suggests this is worth tracking before it hardens into the broader agenda.";
  }

  return parts.slice(0, 2).join(". ") + ".";
}

export function buildOverlookedReasonV2(ctx: StoryScoreContext, breakdown: ScoreFactors): string {
  if ((breakdown.gated ?? 0) > 0) {
    return "Not enough independent sources yet to qualify as overlooked.";
  }
  if ((breakdown.tier1_present ?? 0) > 0) {
    return "Major outlets are already covering this story.";
  }
  if ((breakdown.wire_driven ?? 0) > 0) {
    return "This cluster appears to be wire-driven rather than independently reported.";
  }

  const parts: string[] = [];

  if ((breakdown.source_count ?? 0) > 15) {
    parts.push(`${ctx.sourceCount} independent sources are covering it`);
  }

  if ((breakdown.regional_diversity ?? 0) > 10) {
    parts.push("Coverage spans multiple regions");
  }

  if ((breakdown.time_without_pickup ?? 0) > 8) {
    const hours = Math.round(hoursBetween(ctx.firstSeenAt, new Date()));
    parts.push(`Has persisted for ~${hours}h without major-outlet pickup`);
  }

  if ((breakdown.public_interest ?? 0) > 5) {
    parts.push("Touches public-interest topics");
  }

  if ((breakdown.institutional ?? 0) > 0) {
    parts.push("Linked to institutional records");
  }

  if (ctx.majorSourceCount === 0) {
    parts.push("No major-outlet pickup yet");
  }

  if (parts.length === 0) {
    return "Credible multi-source traction, but the largest outlets have not amplified it broadly.";
  }

  return parts.slice(0, 3).join(". ") + ".";
}

/**
 * Generate a potential_reason text for the Sweden desk.
 */
export function buildPotentialReason(breakdown: ScoreFactors): string {
  const parts: string[] = [];

  if ((breakdown.tier_momentum ?? 0) > 12) {
    parts.push("Story is moving up from local to regional coverage");
  }

  if ((breakdown.national_candidate ?? 0) > 0) {
    parts.push("Spans 3+ Swedish regions — potential national story");
  }

  if ((breakdown.municipality_spread ?? 0) > 5) {
    parts.push("Appearing across multiple municipalities");
  }

  if ((breakdown.institutional ?? 0) > 5) {
    parts.push("Institutional sources are involved");
  }

  if ((breakdown.resurgence ?? 0) > 0) {
    parts.push("Story went quiet and has resurfaced");
  }

  if ((breakdown.no_tier1_bonus ?? 0) > 0) {
    parts.push("No SVT/DN/Aftonbladet pickup yet");
  }

  if ((breakdown.acceleration ?? 0) > 6) {
    parts.push("Coverage is accelerating");
  }

  if (parts.length === 0) {
    return "Early signals suggest this may develop further.";
  }

  return parts.slice(0, 3).join(". ") + ".";
}
