import { buildDemoDataset } from "../lib/demo-data";
import { getSupabaseAdmin } from "../lib/supabase";
import { articleToRow, clusterArticleRows, clusterToRow, loadScriptEnv, sourceToRow } from "./shared";

loadScriptEnv();

async function main() {
  const supabase = getSupabaseAdmin();
  const dataset = buildDemoDataset();
  const clusterIds = dataset.clusters.map((cluster) => cluster.id);
  const memberships = dataset.clusters.flatMap(clusterArticleRows);

  const { error: sourceError } = await supabase
    .from("sources")
    .upsert(dataset.sources.map(sourceToRow), { onConflict: "id" });

  if (sourceError) {
    throw sourceError;
  }

  const { error: articleError } = await supabase
    .from("articles")
    .upsert(dataset.articles.map(articleToRow), { onConflict: "id" });

  if (articleError) {
    throw articleError;
  }

  const { error: clusterError } = await supabase
    .from("story_clusters")
    .upsert(dataset.clusters.map(clusterToRow), { onConflict: "id" });

  if (clusterError) {
    throw clusterError;
  }

  if (clusterIds.length > 0) {
    const { error: clearMembershipError } = await supabase
      .from("cluster_articles")
      .delete()
      .in("cluster_id", clusterIds);

    if (clearMembershipError) {
      throw clearMembershipError;
    }
  }

  if (memberships.length > 0) {
    const { error: membershipError } = await supabase
      .from("cluster_articles")
      .upsert(memberships, { onConflict: "id" });

    if (membershipError) {
      throw membershipError;
    }
  }

  console.log(
    `Seeded ${dataset.sources.length} sources, ${dataset.articles.length} articles, and ${dataset.clusters.length} story clusters.`,
  );
}

main().catch((error) => {
  console.error("Demo seed failed.", error);
  process.exitCode = 1;
});
