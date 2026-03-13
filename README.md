# Signal Atlas

Signal Atlas is a single-user private news discovery site built with Next.js App Router, TypeScript, Supabase-ready storage, and RSS-only ingestion. It clusters related articles into story groups, ranks them for radar and overlooked signals, and ships with a wired demo mode so the interface works before any backend setup exists.

## What is included

- `app/`: the website, including Radar, Overlooked, Saved, and Story Detail pages
- `components/`: reusable UI for cards, filters, metrics, and save controls
- `lib/`: feed config, normalization, clustering, ranking, repository logic, Supabase access, and demo data
- `scripts/`: feed ingestion, clustering, score recomputation, and demo seeding
- `supabase/schema.sql`: the database schema and indexes

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file and choose your mode:

   ```bash
   cp .env.example .env.local
   ```

3. For immediate demo mode, keep:

   ```env
   NEXT_PUBLIC_DEMO_MODE=true
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

With no Supabase credentials present, the app automatically renders the built-in demo dataset. Save/bookmark actions still work in demo mode using cookies.

## Enabling Supabase

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](/C:/Users/O/Signal%20Atlas%20Web/supabase/schema.sql) in the Supabase SQL editor.
3. Set these variables in `.env.local`:

   ```env
   NEXT_PUBLIC_DEMO_MODE=false
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. Seed demo data if you want a populated live database right away:

   ```bash
   npm run seed-demo-data
   ```

Once the schema and env vars are in place, the app reads from Supabase on the server. If a live read fails, the site falls back to demo mode instead of rendering a dead screen.

## RSS ingestion workflow

This repo does not configure a scheduler for you. The scripts are present and wired, but cron is intentionally left for your deployment setup.

Run the pipeline manually:

```bash
npm run fetch-feeds
npm run cluster-stories
npm run recompute-scores
```

Script details:

- `npm run fetch-feeds`: fetches the configured RSS feeds, normalizes articles, and upserts them into `sources` and `articles`
- `npm run cluster-stories`: clusters recent articles into `story_clusters` and rebuilds `cluster_articles`
- `npm run recompute-scores`: recalculates radar and overlooked scores for existing clusters
- `npm run seed-demo-data`: pushes the built-in demo dataset into Supabase

Environment knobs:

- `INGEST_LIMIT_PER_FEED`: max items taken from each feed during ingestion
- `CLUSTER_WINDOW_HOURS`: article window used by the clustering script

## Feed list

The feed list lives in [`lib/feeds.ts`](/C:/Users/O/Signal%20Atlas%20Web/lib/feeds.ts) and starts with a configurable English-language international mix including BBC, Al Jazeera, The Guardian, DW, France 24, NPR, PBS, CBS, CNN, CBC, The Straits Times, The Hindu, Dawn, The Jerusalem Post, The Japan Times, Times of India, and The Kyiv Independent.

Reuters and AP were not added because they no longer expose stable public RSS endpoints suitable for an honest RSS-only build.

## Scoring and clustering rules

Clustering uses simple explainable heuristics:

- normalized headline similarity
- keyword overlap
- publication-time proximity
- source deduplication

`radar_score` favors:

- recency
- source count
- pickup momentum
- source diversity

`overlooked_score` favors:

- multiple sources
- low major-outlet pickup
- persistence over time
- international spread without broad amplification

`why it matters` and overlooked explanations are generated from those heuristics only. There are no embeddings, vector stores, paid news APIs, or LLM ranking calls in this v1.

## Deployment

This app is Vercel-compatible as a standard Next.js project.

1. Push the repo to Git.
2. Import it into Vercel.
3. Set the same environment variables you use locally.
4. If you want live ingestion in production, add your own scheduler to run the scripts.

## Useful commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```
