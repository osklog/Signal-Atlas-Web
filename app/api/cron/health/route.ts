import { NextResponse } from "next/server";

import { EDITORIAL_FEED_SOURCES } from "@/lib/feeds";
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
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Check article counts per source in last 24h
    const { data: recentArticles, error: articleError } = await supabase
      .from("articles")
      .select("source_id")
      .gte("published_at", oneDayAgo);

    if (articleError) throw articleError;

    const sourceCounts = new Map<string, number>();
    for (const row of recentArticles ?? []) {
      const sourceId = row.source_id as string;
      sourceCounts.set(sourceId, (sourceCounts.get(sourceId) ?? 0) + 1);
    }

    // Check cluster counts
    const { count: clusterCount, error: clusterError } = await supabase
      .from("story_clusters")
      .select("id", { count: "exact", head: true });

    if (clusterError) throw clusterError;

    // Identify silent sources (no articles in 24h)
    const silentSources = EDITORIAL_FEED_SOURCES
      .filter((s) => !sourceCounts.has(s.id))
      .map((s) => s.name);

    // Active sources with counts
    const activeSources = EDITORIAL_FEED_SOURCES
      .filter((s) => sourceCounts.has(s.id))
      .map((s) => ({ name: s.name, count: sourceCounts.get(s.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      ok: true,
      totalArticlesLast24h: recentArticles?.length ?? 0,
      activeSources: activeSources.length,
      silentSources,
      clusterCount: clusterCount ?? 0,
      sourceDetails: activeSources,
    });
  } catch (error) {
    console.error("Cron health check failed:", error);
    return NextResponse.json(
      { error: "Health check failed", detail: String(error) },
      { status: 500 },
    );
  }
}
