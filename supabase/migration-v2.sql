-- Signal Atlas v2: clustering overhaul, source metadata, scoring, sweden desk,
-- institutional sources, behavior profiling, pending events, debug tables.

-- ============================================================================
-- 1. Extend sources with metadata columns
-- ============================================================================
alter table public.sources
  add column if not exists tier smallint not null default 3,
  add column if not exists source_type text not null default 'national_daily',
  add column if not exists country text not null default '',
  add column if not exists source_region text not null default '',
  add column if not exists source_language text not null default 'en',
  add column if not exists is_public_service boolean not null default false,
  add column if not exists municipality text,
  add column if not exists ownership_group text,
  add column if not exists source_behavior_baseline_enabled boolean not null default false;

-- ============================================================================
-- 2. Extend story_clusters with new scoring columns
-- ============================================================================
alter table public.story_clusters
  add column if not exists potential_score numeric(5,1) not null default 0,
  add column if not exists overlooked_reason text,
  add column if not exists score_breakdown jsonb not null default '{}',
  add column if not exists is_wire_driven boolean not null default false,
  add column if not exists entity_tags text[] not null default '{}',
  add column if not exists country text not null default '',
  add column if not exists municipality_spread integer not null default 0,
  add column if not exists region_spread integer not null default 0;

create index if not exists story_clusters_potential_idx
  on public.story_clusters (potential_score desc);
create index if not exists story_clusters_country_idx
  on public.story_clusters (country);

-- ============================================================================
-- 3. Clustering debug table
-- ============================================================================
create table if not exists public.clustering_debug (
  id bigint generated always as identity primary key,
  run_id text not null,
  article_a_id text not null,
  article_b_id text not null,
  headline_similarity numeric(6,4) not null default 0,
  entity_similarity numeric(6,4) not null default 0,
  time_similarity numeric(6,4) not null default 0,
  body_similarity numeric(6,4) not null default 0,
  cross_source_bonus numeric(6,4) not null default 0,
  composite_score numeric(6,4) not null default 0,
  decision text not null default 'reject',
  shared_entities text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists clustering_debug_run_idx
  on public.clustering_debug (run_id, created_at desc);
create index if not exists clustering_debug_score_idx
  on public.clustering_debug (composite_score desc);

-- ============================================================================
-- 4. Pending events table
-- ============================================================================
create table if not exists public.pending_events (
  id text primary key,
  article_id text not null references public.articles(id) on delete cascade,
  cluster_id text references public.story_clusters(id) on delete set null,
  event_text text not null,
  event_type text not null default 'future_reference',
  detected_date text,
  confidence numeric(4,2) not null default 0.5,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists pending_events_cluster_idx
  on public.pending_events (cluster_id);

-- ============================================================================
-- 5. Source behavior baselines
-- ============================================================================
create table if not exists public.source_behavior (
  id bigint generated always as identity primary key,
  source_id text not null references public.sources(id) on delete cascade,
  date date not null,
  article_count integer not null default 0,
  hourly_distribution jsonb not null default '{}',
  topic_distribution jsonb not null default '{}',
  avg_article_length integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (source_id, date)
);

create index if not exists source_behavior_source_date_idx
  on public.source_behavior (source_id, date desc);

-- ============================================================================
-- 6. Source anomalies
-- ============================================================================
create table if not exists public.source_anomalies (
  id bigint generated always as identity primary key,
  source_id text not null references public.sources(id) on delete cascade,
  anomaly_type text not null,
  severity numeric(4,2) not null default 0,
  description text not null,
  metadata jsonb not null default '{}',
  detected_at timestamptz not null default timezone('utc', now())
);

create index if not exists source_anomalies_detected_idx
  on public.source_anomalies (detected_at desc);

-- ============================================================================
-- 7. Institutional records
-- ============================================================================
create table if not exists public.institutional_records (
  id text primary key,
  source_id text not null references public.sources(id) on delete cascade,
  record_type text not null,
  title text not null,
  url text,
  body text,
  published_at timestamptz not null,
  region text not null default 'Sweden',
  municipality text,
  entity_tags text[] not null default '{}',
  metadata jsonb not null default '{}',
  cluster_id text references public.story_clusters(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists institutional_records_published_idx
  on public.institutional_records (published_at desc);
create index if not exists institutional_records_cluster_idx
  on public.institutional_records (cluster_id);

drop trigger if exists institutional_records_set_updated_at on public.institutional_records;
create trigger institutional_records_set_updated_at
before update on public.institutional_records
for each row
execute function public.set_updated_at();
