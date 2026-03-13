create table if not exists public.sources (
  id text primary key,
  slug text not null unique,
  name text not null,
  feed_url text,
  homepage_url text,
  region text not null,
  language text not null default 'en',
  is_major boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.articles (
  id text primary key,
  source_id text not null references public.sources(id) on delete cascade,
  title text not null,
  url text not null unique,
  published_at timestamptz not null,
  summary text,
  author text,
  image_url text,
  topic text not null default 'World',
  language text not null default 'en',
  region text not null default 'Global',
  normalized_title text not null,
  content_snippet text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.story_clusters (
  id text primary key,
  cluster_title text not null,
  summary text,
  first_seen_at timestamptz not null,
  last_updated_at timestamptz not null,
  source_count integer not null default 0,
  major_source_count integer not null default 0,
  international_source_count integer not null default 0,
  radar_score numeric(5, 1) not null default 0,
  overlooked_score numeric(5, 1) not null default 0,
  topic text not null default 'World',
  region text not null default 'Global',
  why_it_matters text,
  representative_article_id text references public.articles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cluster_articles (
  id text primary key,
  cluster_id text not null references public.story_clusters(id) on delete cascade,
  article_id text not null references public.articles(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (cluster_id, article_id)
);

create table if not exists public.saved_stories (
  id text primary key,
  story_cluster_id text not null unique references public.story_clusters(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists articles_published_at_idx on public.articles (published_at desc);
create index if not exists articles_normalized_title_idx on public.articles (normalized_title);
create index if not exists story_clusters_radar_idx on public.story_clusters (radar_score desc);
create index if not exists story_clusters_overlooked_idx on public.story_clusters (overlooked_score desc);
create index if not exists story_clusters_topic_region_idx on public.story_clusters (topic, region);
create index if not exists cluster_articles_cluster_idx on public.cluster_articles (cluster_id, position);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists sources_set_updated_at on public.sources;
create trigger sources_set_updated_at
before update on public.sources
for each row
execute function public.set_updated_at();

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
before update on public.articles
for each row
execute function public.set_updated_at();

drop trigger if exists story_clusters_set_updated_at on public.story_clusters;
create trigger story_clusters_set_updated_at
before update on public.story_clusters
for each row
execute function public.set_updated_at();
