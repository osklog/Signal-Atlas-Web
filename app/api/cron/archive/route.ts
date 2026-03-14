import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase";

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
    const staleThreshold = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Delete clusters older than 7 days (cascade deletes cluster_articles)
    const { data: staleClusters, error: fetchError } = await supabase
      .from("story_clusters")
      .select("id")
      .lt("last_updated_at", staleThreshold);

    if (fetchError) throw fetchError;

    const staleIds = (staleClusters ?? []).map((r: { id: unknown }) => r.id as string);

    if (staleIds.length > 0) {
      // Remove saved_stories references first
      await supabase
        .from("saved_stories")
        .delete()
        .in("story_cluster_id", staleIds);

      // Delete pending events referencing stale clusters
      await supabase
        .from("pending_events")
        .delete()
        .in("cluster_id", staleIds);

      // Delete the clusters (cascades to cluster_articles)
      const { error: deleteError } = await supabase
        .from("story_clusters")
        .delete()
        .in("id", staleIds);

      if (deleteError) throw deleteError;
    }

    // Clean up old debug rows (keep last 3 days)
    const debugThreshold = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await supabase
      .from("clustering_debug")
      .delete()
      .lt("created_at", debugThreshold);

    // Clean up old source behavior data (keep last 60 days)
    const behaviorThreshold = new Date(
      Date.now() - 60 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await supabase
      .from("source_behavior")
      .delete()
      .lt("created_at", behaviorThreshold);

    return NextResponse.json({
      ok: true,
      archivedClusters: staleIds.length,
    });
  } catch (error) {
    console.error("Cron archive failed:", error);
    return NextResponse.json(
      { error: "Archive failed", detail: String(error) },
      { status: 500 },
    );
  }
}
