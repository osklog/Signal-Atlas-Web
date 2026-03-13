export type StorySortKey = "radar" | "overlooked";

export interface SourceRecord {
  id: string;
  slug: string;
  name: string;
  feedUrl: string | null;
  homepageUrl: string | null;
  region: string;
  language: string;
  isMajor: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FeedSource extends SourceRecord {
  feedUrl: string;
}

export interface ArticleRecord {
  id: string;
  sourceId: string;
  sourceSlug: string;
  sourceName: string;
  sourceHomepageUrl: string | null;
  sourceRegion: string;
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  author: string | null;
  imageUrl: string | null;
  topic: string;
  language: string;
  region: string;
  normalizedTitle: string;
  contentSnippet: string;
  keywords: string[];
  majorOutlet: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClusteredStory {
  id: string;
  clusterTitle: string;
  summary: string;
  firstSeenAt: string;
  lastUpdatedAt: string;
  sourceCount: number;
  majorSourceCount: number;
  internationalSourceCount: number;
  radarScore: number;
  overlookedScore: number;
  topic: string;
  region: string;
  whyItMatters: string;
  overlookedReason: string;
  representativeArticleId: string;
  topSourceNames: string[];
  articles: ArticleRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryQueryOptions {
  sortBy?: StorySortKey;
  topic?: string;
  region?: string;
  savedOnly?: boolean;
  limit?: number;
}

export interface FilterOptions {
  topics: string[];
  regions: string[];
}

export interface StoryCollection {
  mode: "demo" | "live";
  clusters: ClusteredStory[];
  savedStoryIds: string[];
  filters: FilterOptions;
}

export interface RawFeedItem {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  creator?: string;
  author?: string;
  enclosure?: {
    url?: string;
  };
  "content:encoded"?: string;
  "media:content"?:
    | Array<{
        $?: {
          url?: string;
        };
      }>
    | {
        $?: {
          url?: string;
        };
      };
}

export interface StoryScoreContext {
  articleCount: number;
  sourceCount: number;
  majorSourceCount: number;
  internationalSourceCount: number;
  firstSeenAt: string;
  lastUpdatedAt: string;
  region: string;
  topic: string;
  articles: ArticleRecord[];
}
