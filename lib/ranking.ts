/**
 * Score computation — delegates to the new scoring module.
 * Preserves the old API surface for backward compatibility.
 */

import { computeRadarScore as radarV2, computeOverlookedScore as overlookedV2, computePotentialScore as potentialV2 } from "@/lib/scoring/scores";
import type { StoryScoreContext } from "@/lib/types";

export function computeRadarScore(context: StoryScoreContext): number {
  return radarV2(context).score;
}

export function computeOverlookedScore(context: StoryScoreContext): number {
  return overlookedV2(context).score;
}

export function computePotentialScore(context: StoryScoreContext): number {
  return potentialV2(context).score;
}
