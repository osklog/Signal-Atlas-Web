import { buildStoryClustersWithDebug } from "../lib/cluster";
import { detectAllPendingEvents } from "../lib/pending-events";
import { getSupabaseAdmin } from "../lib/supabase";
import { clusterArticleRows, clusterToRow, loadScriptEnv, readArticlesFromDb } from "./shared";

loadScriptEnv();

async function main() {
  const windowHours = Number(process.env.CLUSTER_WINDOW_HOURS ?? 120);
  const supabase = getSupabaseAdmin();
  const articles = await readArticlesFromDb(windowHours);
  const output = buildStoryClustersWithDebug(articles);
  const clusters = output.clusters;
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

  // Write debug pairs
  const debugRows = output.debugPairs.slice(0, 500).map((pair) => ({
    run_id: new Date().toISOString().slice(0, 16),
    article_a_id: pair.articleAId,
    article_b_id: pair.articleBId,
    headline_similarity: pair.headlineSimilarity,
    entity_similarity: pair.entitySimilarity,
    time_similarity: pair.timeSimilarity,
    body_similarity: pair.bodySimilarity,
    cross_source_bonus: pair.crossSourceBonus,
    composite_score: pair.compositeScore,
    decision: pair.decision,
    shared_entities: pair.sharedEntities,
  }));
  if (debugRows.length > 0) {
    await supabase.from("clustering_debug").insert(debugRows);
  }

  // Detect pending events
  const clusterMap = new Map<string, string>();
  for (const cluster of clusters) {
    for (const article of cluster.articles) {
      clusterMap.set(article.id, cluster.id);
    }
  }
  const pendingEvents = detectAllPendingEvents(articles, clusterMap);
  if (pendingEvents.length > 0) {
    const eventRows = pendingEvents.map((e) => ({
      id: e.id,
      article_id: e.articleId,
      cluster_id: e.clusterId ?? null,
      event_text: e.eventText,
      event_type: e.eventType,
      detected_date: e.detectedDate ?? null,
      confidence: e.confidence,
    }));
    await supabase.from("pending_events").upsert(eventRows, { onConflict: "id" });
  }

  console.log(`Clustered ${articles.length} articles into ${clusters.length} stories.`);
  console.log(`Distribution: singletons=${output.stats.singletons}, 2-3=${output.stats.size2to3}, 4-10=${output.stats.size4to10}, 10+=${output.stats.size10plus}`);
  console.log(`Debug pairs logged: ${debugRows.length}, Pending events: ${pendingEvents.length}`);
}

main().catch((error) => {
  console.error("Story clustering failed.", error);
  process.exitCode = 1;
});
