import type { StoryScoreContext } from "@/lib/types";
import { hoursBetween } from "@/lib/utils";

export function buildWhyItMatters(context: StoryScoreContext) {
  const persistenceHours = hoursBetween(context.firstSeenAt, context.lastUpdatedAt);

  if (context.sourceCount >= 4 && context.majorSourceCount <= 1) {
    return "Multiple regional outlets are covering this, but few major international sources have picked it up.";
  }

  if (context.sourceCount >= 5 && hoursBetween(context.lastUpdatedAt, new Date()) <= 10) {
    return "Coverage is growing quickly across several sources.";
  }

  if (persistenceHours >= 18 && context.majorSourceCount < context.sourceCount / 2) {
    return "This story has persisted across time without broad amplification.";
  }

  if (context.internationalSourceCount >= 3) {
    return "Signals from several geographies suggest the story is spreading beyond a single local frame.";
  }

  return "A steady spread of coverage suggests this is worth tracking before it hardens into the broader agenda.";
}

export function buildOverlookedReason(context: StoryScoreContext) {
  const persistenceHours = Math.round(hoursBetween(context.firstSeenAt, context.lastUpdatedAt));

  if (context.majorSourceCount === 0) {
    return `${context.sourceCount} sources are covering it with no major-outlet pickup yet.`;
  }

  if (context.majorSourceCount <= 1 && context.sourceCount >= 3) {
    return `${context.sourceCount} sources have stayed on it, but only ${context.majorSourceCount} major outlet has joined.`;
  }

  if (persistenceHours >= 18) {
    return `Coverage has persisted for about ${persistenceHours} hours without fully breaking out.`;
  }

  return "It has credible multi-source traction, but the largest outlets have not amplified it broadly.";
}
