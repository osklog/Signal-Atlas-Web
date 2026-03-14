import { existsSync } from "node:fs";

import { config as loadDotEnv } from "dotenv";

import { recomputeClusterKeepingId } from "../lib/cluster";
import { FEED_SOURCES } from "../lib/feeds";
import { getSupabaseAdmin } from "../lib/supabase";
import type { ArticleRecord, ClusteredStory, SourceRecord } from "../lib/types";

let envLoaded = false;

export function loadScriptEnv() {
  if (envLoaded) {
    return;
  }

  if (existsSync(".env.local")) {
    loadDotEnv({ path: ".env.local" });
  }

  if (existsSync(".env")) {
    loadDotEnv();
  }

  envLoaded = true;
}

loadScriptEnv();

export function sourceToRow(source: SourceRecord) {
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

export function articleToRow(article: ArticleRecord) {
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
    created_at: article.createdAt,
    updated_at: article.updatedAt,
  };
}

export function clusterToRow(cluster: ClusteredStory) {
  return {
    id: cluster.id,
    cluster_title: cluster.clusterTitle,
    summary: cluster.summary,
    first_seen_at: cluster.firstSeenAt,
    last_updated_at: cluster.lastUpdatedAt,
    source_count: cluster.sourceCount,
    major_source_count: cluster.majorSourceCount,
    international_source_count: cluster.internationalSourceCount,
    radar_score: cluster.radarScore,
    overlooked_score: cluster.overlookedScore,
    potential_score: cluster.potentialScore ?? 0,
    topic: cluster.topic,
    region: cluster.region,
    why_it_matters: cluster.whyItMatters,
    overlooked_reason: cluster.overlookedReason,
    representative_article_id: cluster.representativeArticleId,
    score_breakdown: cluster.scoreBreakdown ?? {},
    is_wire_driven: cluster.isWireDriven ?? false,
    entity_tags: cluster.entityTags ?? [],
    country: cluster.country ?? "",
    municipality_spread: cluster.municipalitySpread ?? 0,
    region_spread: cluster.regionSpread ?? 0,
    created_at: cluster.createdAt,
    updated_at: cluster.updatedAt,
  };
}

export function clusterArticleRows(cluster: ClusteredStory) {
  return cluster.articles.map((article, index) => ({
    id: `cluster_article_${cluster.id}_${article.id}`,
    cluster_id: cluster.id,
    article_id: article.id,
    position: index,
  }));
}

interface SourceJoinRow {
  slug: string;
  name: string;
  homepage_url: string | null;
  region: string;
  language: string;
  is_major: boolean;
}

interface DbArticleRow {
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

interface DbClusterMembershipRow {
  cluster_id: string;
  position: number;
  article: DbArticleRow | DbArticleRow[] | null;
}

function normalizeJoinValue<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function mapArticleRow(row: DbArticleRow): ArticleRecord | null {
  const source = normalizeJoinValue(row.source);

  if (!source) {
    return null;
  }

  return {
    id: row.id,
    sourceId: row.source_id,
    sourceSlug: source.slug,
    sourceName: source.name,
    sourceHomepageUrl: source.homepage_url,
    sourceRegion: source.region,
    title: row.title,
    url: row.url,
    publishedAt: row.published_at,
    summary: row.summary ?? "",
    author: row.author,
    imageUrl: row.image_url,
    topic: row.topic,
    language: row.language,
    region: row.region,
    normalizedTitle: row.normalized_title,
    contentSnippet: row.content_snippet ?? "",
    keywords: [],
    majorOutlet: Boolean(source.is_major),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertSources() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("sources")
    .upsert(FEED_SOURCES.map(sourceToRow), { onConflict: "id" });

  if (error) {
    throw error;
  }
}

export async function readArticlesFromDb(windowHours = 120) {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("articles")
    .select(
      `
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
    `,
    )
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => mapArticleRow(row))
    .filter((article): article is ArticleRecord => Boolean(article));
}

export async function readClusterMembershipFromDb() {
  const supabase = getSupabaseAdmin();
  const { data: clusters, error: clusterError } = await supabase
    .from("story_clusters")
    .select("id")
    .order("last_updated_at", { ascending: false });

  if (clusterError) {
    throw clusterError;
  }

  const clusterIds = (clusters ?? []).map((row) => row.id as string);

  if (clusterIds.length === 0) {
    return [];
  }

  const { data: memberships, error: membershipError } = await supabase
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

  if (membershipError) {
    throw membershipError;
  }

  const grouped = new Map<string, ArticleRecord[]>();

  for (const membership of (memberships ?? []) as DbClusterMembershipRow[]) {
    const article = normalizeJoinValue(membership.article);

    if (!article) {
      continue;
    }

    const mapped = mapArticleRow(article);

    if (!mapped) {
      continue;
    }

    const articles = grouped.get(membership.cluster_id) ?? [];
    articles.push(mapped);
    grouped.set(membership.cluster_id, articles);
  }

  return clusterIds.map((clusterId) => ({
    id: clusterId,
    articles: grouped.get(clusterId) ?? [],
  }));
}

export { recomputeClusterKeepingId as recomputeClusterKeepingId };
