import Parser from "rss-parser";

import { EDITORIAL_FEED_SOURCES } from "../lib/feeds";
import { normalizeFeedItem } from "../lib/normalize";
import type { RawFeedItem } from "../lib/types";
import { getSupabaseAdmin } from "../lib/supabase";
import { articleToRow, loadScriptEnv, upsertSources } from "./shared";

loadScriptEnv();

const parser = new Parser<Record<string, never>, RawFeedItem>({
  customFields: {
    item: ["content:encoded", "media:content"],
  },
});

async function main() {
  const supabase = getSupabaseAdmin();
  const limitPerFeed = Number(process.env.INGEST_LIMIT_PER_FEED ?? 12);

  await upsertSources();

  const results = await Promise.allSettled(
    EDITORIAL_FEED_SOURCES.map(async (source) => {
      const feed = await parser.parseURL(source.feedUrl);
      const articles = (feed.items ?? [])
        .slice(0, limitPerFeed)
        .map((item) => normalizeFeedItem(source, item))
        .filter((article): article is NonNullable<typeof article> => Boolean(article));

      if (articles.length > 0) {
        const { error } = await supabase
          .from("articles")
          .upsert(articles.map(articleToRow), { onConflict: "id" });

        if (error) {
          throw error;
        }
      }

      console.log(`${source.name}: stored ${articles.length} articles`);
      return articles.length;
    }),
  );

  const successful = results.filter(
    (result): result is PromiseFulfilledResult<number> => result.status === "fulfilled",
  );
  const failed = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  const storedCount = successful.reduce((sum, result) => sum + result.value, 0);

  failed.forEach((result) => {
    console.error("Feed fetch failed:", result.reason);
  });

  console.log(
    `Finished feed ingestion. Stored ${storedCount} articles across ${successful.length} feeds.`,
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Feed ingestion failed.", error);
  process.exitCode = 1;
});
