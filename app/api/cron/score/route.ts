import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { readClusterMembershipFromDb, recomputeClusterKeepingId, clusterToRow } from "@/scripts/shared";

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
    const memberships = await readClusterMembershipFromDb();
    const clusters = memberships
      .filter((m: { id: string; articles: unknown[] }) => m.articles.length > 0)
      .map((m: { id: string; articles: Parameters<typeof recomputeClusterKeepingId>[1] }) => recomputeClusterKeepingId(m.id, m.articles));

    if (clusters.length === 0) {
      return NextResponse.json({ ok: true, recomputed: 0 });
    }

    const { error } = await supabase
      .from("story_clusters")
      .upsert(clusters.map(clusterToRow), { onConflict: "id" });

    if (error) throw error;

    return NextResponse.json({ ok: true, recomputed: clusters.length });
  } catch (error) {
    console.error("Cron score recompute failed:", error);
    return NextResponse.json(
      { error: "Score recompute failed", detail: String(error) },
      { status: 500 },
    );
  }
}
