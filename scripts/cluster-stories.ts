import { buildStoryClusters } from "../lib/cluster";
import { getSupabaseAdmin } from "../lib/supabase";
import { clusterArticleRows, clusterToRow, loadScriptEnv, readArticlesFromDb } from "./shared";

loadScriptEnv();

async function main() {
  const windowHours = Number(process.env.CLUSTER_WINDOW_HOURS ?? 120);
  const supabase = getSupabaseAdmin();
  const articles = await readArticlesFromDb(windowHours);
  const clusters = buildStoryClusters(articles);
  const clusterIds = clusters.map((cluster) => cluster.id);
  const membershipRows = clusters.flatMap(clusterArticleRows);

  const { data: existingRows, error: existingError } = await supabase
    .from("story_clusters")
    .select("id");

  if (existingError) {
    throw existingError;
  }

  const existingIds = (existingRows ?? []).map((row) => row.id as string);
  const staleIds = existingIds.filter((id) => !clusterIds.includes(id));

  if (staleIds.length > 0) {
    const { error: staleMembershipError } = await supabase
      .from("cluster_articles")
      .delete()
      .in("cluster_id", staleIds);

    if (staleMembershipError) {
      throw staleMembershipError;
    }

    const { error: staleClusterError } = await supabase
      .from("story_clusters")
      .delete()
      .in("id", staleIds);

    if (staleClusterError) {
      throw staleClusterError;
    }
  }

  if (clusterIds.length > 0) {
    const { error: clusterError } = await supabase
      .from("story_clusters")
      .upsert(clusters.map(clusterToRow), { onConflict: "id" });

    if (clusterError) {
      throw clusterError;
    }

    const { error: clearMembershipError } = await supabase
      .from("cluster_articles")
      .delete()
      .in("cluster_id", clusterIds);

    if (clearMembershipError) {
      throw clearMembershipError;
    }

    if (membershipRows.length > 0) {
      const { error: membershipError } = await supabase
        .from("cluster_articles")
        .upsert(membershipRows, { onConflict: "id" });

      if (membershipError) {
        throw membershipError;
      }
    }
  }

  console.log(`Clustered ${articles.length} articles into ${clusters.length} stories.`);
}

main().catch((error) => {
  console.error("Story clustering failed.", error);
  process.exitCode = 1;
});
