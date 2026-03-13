import { cookies } from "next/headers";

import { buildStoryClusters } from "@/lib/cluster";
import {
  DEFAULT_PAGE_SIZE,
  getConfiguredMode,
  SAVED_STORIES_COOKIE,
} from "@/lib/config";
import { buildDemoDataset } from "@/lib/demo-data";
import { buildOverlookedReason } from "@/lib/why-it-matters";
import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  ArticleRecord,
  ClusteredStory,
  FilterOptions,
  StoryCollection,
  StoryQueryOptions,
} from "@/lib/types";
import { unique } from "@/lib/utils";

interface SourceJoinRow {
  slug: string;
  name: string;
  homepage_url: string | null;
  region: string;
  language: string;
  is_major: boolean;
}

interface ArticleJoinRow {
  id: string;
  source_id: string;
  title: string;
  url: string;
  published_at: string;
  summary: string | null;
  author: string | null;
  image_url: string | null;
  topic: string;
  language: string;
  region: string;
  normalized_title: string;
  content_snippet: string | null;
  created_at: string;
  updated_at: string;
  source: SourceJoinRow | SourceJoinRow[] | null;
}

interface ClusterArticleJoinRow {
  cluster_id: string;
  position: number;
  article: ArticleJoinRow | ArticleJoinRow[] | null;
}

function normalizeJoinValue<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function sortClusters(clusters: ClusteredStory[], sortBy: StoryQueryOptions["sortBy"]) {
  if (sortBy === "overlooked") {
    return [...clusters].sort((left, right) => {
      if (right.overlookedScore === left.overlookedScore) {
        return right.radarScore - left.radarScore;
      }

      return right.overlookedScore - left.overlookedScore;
    });
  }

  return [...clusters].sort((left, right) => {
    if (right.radarScore === left.radarScore) {
      return right.lastUpdatedAt.localeCompare(left.lastUpdatedAt);
    }

    return right.radarScore - left.radarScore;
  });
}

function deriveFilters(clusters: ClusteredStory[]): FilterOptions {
  return {
    topics: unique(clusters.map((cluster) => cluster.topic)).sort((left, right) =>
      left.localeCompare(right),
    ),
    regions: unique(clusters.map((cluster) => cluster.region)).sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

function filterClusters(
  clusters: ClusteredStory[],
  options: StoryQueryOptions,
  savedStoryIds: string[],
) {
  const filtered = clusters.filter((cluster) => {
    if (options.topic && cluster.topic !== options.topic) {
      return false;
    }

    if (options.region && cluster.region !== options.region) {
      return false;
    }

    if (options.savedOnly && !savedStoryIds.includes(cluster.id)) {
      return false;
    }

    return true;
  });

  return sortClusters(filtered, options.sortBy).slice(0, options.limit ?? DEFAULT_PAGE_SIZE);
}

async function readSavedStoryIdsFromCookie() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SAVED_STORIES_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

async function writeSavedStoryIdsToCookie(storyIds: string[]) {
  const cookieStore = await cookies();
  cookieStore.set(SAVED_STORIES_COOKIE, JSON.stringify(storyIds), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 120,
  });
}

function mapClusterArticles(rows: ClusterArticleJoinRow[]): Map<string, ArticleRecord[]> {
  const clusterArticles = new Map<string, ArticleRecord[]>();

  for (const row of rows) {
    const article = normalizeJoinValue(row.article);
    const source = normalizeJoinValue(article?.source);

    if (!article || !source) {
      continue;
    }

    const mapped: ArticleRecord = {
      id: article.id,
      sourceId: article.source_id,
      sourceSlug: source.slug,
      sourceName: source.name,
      sourceHomepageUrl: source.homepage_url,
      sourceRegion: source.region,
      title: article.title,
      url: article.url,
      publishedAt: article.published_at,
      summary: article.summary ?? "",
      author: article.author,
      imageUrl: article.image_url,
      topic: article.topic,
      language: article.language,
      region: article.region,
      normalizedTitle: article.normalized_title,
      contentSnippet: article.content_snippet ?? "",
      keywords: [],
      majorOutlet: Boolean(source.is_major),
      createdAt: article.created_at,
      updatedAt: article.updated_at,
    };

    const existing = clusterArticles.get(row.cluster_id) ?? [];
    existing.push(mapped);
    clusterArticles.set(row.cluster_id, existing);
  }

  return clusterArticles;
}

async function readLiveSavedStoryIds() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("saved_stories")
    .select("story_cluster_id")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.story_cluster_id as string);
}

async function fetchLiveClusters(): Promise<ClusteredStory[]> {
  const supabase = getSupabaseAdmin();
  const { data: clusterRows, error: clusterError } = await supabase
    .from("story_clusters")
    .select("*")
    .order("last_updated_at", { ascending: false });

  if (clusterError) {
    throw clusterError;
  }

  const clusters = clusterRows ?? [];

  if (clusters.length === 0) {
    return [];
  }

  const clusterIds = clusters.map((cluster) => cluster.id as string);
  const { data: clusterArticleRows, error: articleError } = await supabase
    .from("cluster_articles")
    .select(
      `
      cluster_id,
      position,
      article:articles (
        id,
        source_id,
        title,
        url,
        published_at,
        summary,
        author,
        image_url,
        topic,
        language,
        region,
        normalized_title,
        content_snippet,
        created_at,
        updated_at,
        source:sources (
          id,
          slug,
          name,
          homepage_url,
          region,
          language,
          is_major
        )
      )
    `,
    )
    .in("cluster_id", clusterIds)
    .order("position", { ascending: true });

  if (articleError) {
    throw articleError;
  }

  const articlesByCluster = mapClusterArticles(clusterArticleRows ?? []);

  return clusters.map((row) => {
    const articles = (articlesByCluster.get(row.id as string) ?? []).sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
    );
    const topSourceNames = unique(articles.map((article) => article.sourceName)).slice(0, 3);

    return {
      id: row.id as string,
      clusterTitle: row.cluster_title as string,
      summary: row.summary as string,
      firstSeenAt: row.first_seen_at as string,
      lastUpdatedAt: row.last_updated_at as string,
      sourceCount: row.source_count as number,
      majorSourceCount: row.major_source_count as number,
      internationalSourceCount: row.international_source_count as number,
      radarScore: row.radar_score as number,
      overlookedScore: row.overlooked_score as number,
      topic: row.topic as string,
      region: row.region as string,
      whyItMatters: row.why_it_matters as string,
      overlookedReason:
        buildOverlookedReason({
          articleCount: articles.length,
          sourceCount: row.source_count as number,
          majorSourceCount: row.major_source_count as number,
          internationalSourceCount: row.international_source_count as number,
          firstSeenAt: row.first_seen_at as string,
          lastUpdatedAt: row.last_updated_at as string,
          topic: row.topic as string,
          region: row.region as string,
          articles,
        }) ?? "",
      representativeArticleId: row.representative_article_id as string,
      topSourceNames,
      articles,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  });
}

async function resolveLiveSnapshot(options: StoryQueryOptions): Promise<StoryCollection> {
  const [clusters, savedStoryIds] = await Promise.all([fetchLiveClusters(), readLiveSavedStoryIds()]);

  return {
    mode: "live",
    clusters: filterClusters(clusters, options, savedStoryIds),
    savedStoryIds,
    filters: deriveFilters(clusters),
  };
}

async function resolveDemoSnapshot(options: StoryQueryOptions): Promise<StoryCollection> {
  const { clusters } = buildDemoDataset();
  const savedStoryIds = await readSavedStoryIdsFromCookie();

  return {
    mode: "demo",
    clusters: filterClusters(clusters, options, savedStoryIds),
    savedStoryIds,
    filters: deriveFilters(clusters),
  };
}

export async function getStoryCollection(options: StoryQueryOptions = {}): Promise<StoryCollection> {
  if (getConfiguredMode() === "live") {
    try {
      return await resolveLiveSnapshot(options);
    } catch (error) {
      console.error("Falling back to demo mode after live data read failed.", error);
    }
  }

  return resolveDemoSnapshot(options);
}

export async function getStoryById(storyId: string) {
  const collection = await getStoryCollection({
    limit: 1000,
  });

  return collection.clusters.find((cluster) => cluster.id === storyId) ?? null;
}

export async function setStorySaved(storyId: string, shouldSave: boolean) {
  if (getConfiguredMode() === "live") {
    try {
      const supabase = getSupabaseAdmin();

      if (shouldSave) {
        const payload = {
          id: `saved_${storyId}`,
          story_cluster_id: storyId,
        };
        const { error } = await supabase.from("saved_stories").upsert(payload);

        if (error) {
          throw error;
        }

        return;
      }

      const { error } = await supabase.from("saved_stories").delete().eq("story_cluster_id", storyId);

      if (error) {
        throw error;
      }

      return;
    } catch (error) {
      console.error("Falling back to cookie save storage.", error);
    }
  }

  const savedStoryIds = await readSavedStoryIdsFromCookie();
  const next = shouldSave
    ? unique([...savedStoryIds, storyId])
    : savedStoryIds.filter((savedId) => savedId !== storyId);

  await writeSavedStoryIdsToCookie(next);
}

export async function hydrateClustersFromArticles(articles: ArticleRecord[]) {
  return buildStoryClusters(articles);
}
