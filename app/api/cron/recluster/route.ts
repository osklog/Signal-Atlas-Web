import { NextResponse } from "next/server";

import { buildStoryClustersWithDebug } from "@/lib/cluster";
import { detectAllPendingEvents } from "@/lib/pending-events";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ClusteredStory } from "@/lib/types";
import { readArticlesFromDb, clusterToRow, clusterArticleRows } from "@/scripts/shared";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const windowHours = Number(process.env.CLUSTER_WINDOW_HOURS ?? 120);
    const articles = await readArticlesFromDb(windowHours);

    if (articles.length === 0) {
      return NextResponse.json({ ok: true, clusters: 0, articles: 0 });
    }

    const output = buildStoryClustersWithDebug(articles);

    // Write clusters
    const clusterRows = output.clusters.map((c) => clusterToRow(c as unknown as ClusteredStory));
    if (clusterRows.length > 0) {
      // Delete old clusters and re-insert (full re-cluster)
      await supabase.from("cluster_articles").delete().neq("id", "");
      await supabase.from("story_clusters").delete().neq("id", "");

      const { error: clusterError } = await supabase
        .from("story_clusters")
        .upsert(clusterRows, { onConflict: "id" });
      if (clusterError) throw clusterError;

      // Write cluster-article memberships
      const allMemberships = output.clusters.flatMap((c) => clusterArticleRows(c as unknown as ClusteredStory));
      if (allMemberships.length > 0) {
        const { error: memberError } = await supabase
          .from("cluster_articles")
          .upsert(allMemberships, { onConflict: "id" });
        if (memberError) throw memberError;
      }
    }

    // Write debug pairs (last 500)
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

    // Detect and write pending events
    const clusterMap = new Map<string, string>();
    for (const cluster of output.clusters) {
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
      await supabase
        .from("pending_events")
        .upsert(eventRows, { onConflict: "id" });
    }

    return NextResponse.json({
      ok: true,
      clusters: output.clusters.length,
      articles: output.stats.totalArticles,
      singletons: output.stats.singletons,
      size2to3: output.stats.size2to3,
      size4to10: output.stats.size4to10,
      size10plus: output.stats.size10plus,
      debugPairs: debugRows.length,
      pendingEvents: pendingEvents.length,
    });
  } catch (error) {
    console.error("Cron recluster failed:", error);
    return NextResponse.json(
      { error: "Recluster failed", detail: String(error) },
      { status: 500 },
    );
  }
}
