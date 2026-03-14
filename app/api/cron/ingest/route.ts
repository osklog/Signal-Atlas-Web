import { NextResponse } from "next/server";
import Parser from "rss-parser";

import { EDITORIAL_FEED_SOURCES } from "@/lib/feeds";
import { normalizeFeedItem } from "@/lib/normalize";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { RawFeedItem } from "@/lib/types";

const parser = new Parser<Record<string, never>, RawFeedItem>({
  customFields: {
    item: ["content:encoded", "media:content"],
  },
});

function articleToRow(article: ReturnType<typeof normalizeFeedItem>) {
  if (!article) return null;
  return {
    id: article.id,
    source_id: article.sourceId,
    title: article.title,
    url: article.url,
    published_at: article.publishedAt,
    summary: article.summary,
    author: article.author,
    image_url: article.imageUrl,
    topic: article.topic,
    language: article.language,
    region: article.region,
    normalized_title: article.normalizedTitle,
    content_snippet: article.contentSnippet,
  };
}

function sourceToRow(source: (typeof EDITORIAL_FEED_SOURCES)[number]) {
  return {
    id: source.id,
    slug: source.slug,
    name: source.name,
    feed_url: source.feedUrl,
    homepage_url: source.homepageUrl,
    region: source.region,
    language: source.language,
    is_major: source.isMajor,
    tier: source.tier ?? 3,
    source_type: source.sourceType ?? "national_daily",
    country: source.country ?? "",
    source_region: source.region,
    source_language: source.language,
    is_public_service: source.isPublicService ?? false,
    municipality: source.municipality ?? null,
    ownership_group: source.ownershipGroup ?? null,
  };
}

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
    const limitPerFeed = Number(process.env.INGEST_LIMIT_PER_FEED ?? 12);

    // Upsert sources
    await supabase
      .from("sources")
      .upsert(EDITORIAL_FEED_SOURCES.map(sourceToRow), { onConflict: "id" });

    const results = await Promise.allSettled(
      EDITORIAL_FEED_SOURCES.map(async (source) => {
        const feed = await parser.parseURL(source.feedUrl);
        const articles = (feed.items ?? [])
          .slice(0, limitPerFeed)
          .map((item: RawFeedItem) => normalizeFeedItem(source, item))
          .filter((a): a is NonNullable<typeof a> => Boolean(a))
          .map(articleToRow)
          .filter(Boolean);

        if (articles.length > 0) {
          const { error } = await supabase
            .from("articles")
            .upsert(articles, { onConflict: "id" });
          if (error) throw error;
        }

        return articles.length;
      }),
    );

    const succeeded = results.filter(
      (r): r is PromiseFulfilledResult<number> => r.status === "fulfilled",
    );
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    const stored = succeeded.reduce((s, r) => s + r.value, 0);

    return NextResponse.json({
      ok: true,
      stored,
      feeds: succeeded.length,
      failed: failed.length,
    });
  } catch (error) {
    console.error("Cron ingest failed:", error);
    return NextResponse.json(
      { error: "Ingest failed", detail: String(error) },
      { status: 500 },
    );
  }
}
