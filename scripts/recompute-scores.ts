import { getSupabaseAdmin } from "../lib/supabase";
import { clusterToRow, loadScriptEnv, readClusterMembershipFromDb, recomputeClusterKeepingId } from "./shared";

loadScriptEnv();

async function main() {
  const supabase = getSupabaseAdmin();
  const memberships = await readClusterMembershipFromDb();
  const clusters = memberships
    .filter((membership) => membership.articles.length > 0)
    .map((membership) => recomputeClusterKeepingId(membership.id, membership.articles));

  if (clusters.length === 0) {
    console.log("No clusters found to recompute.");
    return;
  }

  const { error } = await supabase
    .from("story_clusters")
    .upsert(clusters.map(clusterToRow), { onConflict: "id" });

  if (error) {
    throw error;
  }

  console.log(`Recomputed scores for ${clusters.length} story clusters.`);
}

main().catch((error) => {
  console.error("Score recomputation failed.", error);
  process.exitCode = 1;
});
