import { subHours } from "date-fns";

import { buildStoryClusters } from "@/lib/cluster";
import { FEED_SOURCE_MAP, FEED_SOURCES } from "@/lib/feeds";
import {
  createStableId,
  detectRegion,
  detectTopic,
  extractKeywords,
  normalizeTitle,
} from "@/lib/normalize";
import type { ArticleRecord, ClusteredStory, SourceRecord } from "@/lib/types";
import { truncate } from "@/lib/utils";

interface DemoSeed {
  sourceId: string;
  title: string;
  summary: string;
  hoursAgo: number;
  topic?: string;
  region?: string;
  urlPath: string;
}

const DEMO_STORY_SEEDS: DemoSeed[] = [
  {
    sourceId: "source_bbc_world",
    title: "Balkan power grids buckle as heatwave pushes demand to record levels",
    summary:
      "Utilities across south-east Europe are leaning on emergency imports as extreme heat strains transmission links and cooling systems.",
    hoursAgo: 2,
    topic: "Energy",
    region: "Europe",
    urlPath: "balkan-grids-heatwave-bbc",
  },
  {
    sourceId: "source_dw",
    title: "South-east Europe utilities scramble after heatwave strains power networks",
    summary:
      "Regional operators say electricity demand and patchy cross-border interconnectors are raising the risk of rolling outages.",
    hoursAgo: 4,
    topic: "Energy",
    region: "Europe",
    urlPath: "balkan-grids-heatwave-dw",
  },
  {
    sourceId: "source_guardian_world",
    title: "Heatwave exposes fragile electricity links across the Balkans",
    summary:
      "Officials are monitoring grid frequency after several countries were forced to redistribute load during the hottest stretch of the week.",
    hoursAgo: 5,
    topic: "Energy",
    region: "Europe",
    urlPath: "balkan-grids-heatwave-guardian",
  },
  {
    sourceId: "source_france24",
    title: "Regional power operators race to stabilise Balkan grid during heat spike",
    summary:
      "Balancing reserves are thinning as power demand surges and maintenance windows are shortened across the region.",
    hoursAgo: 7,
    topic: "Energy",
    region: "Europe",
    urlPath: "balkan-grids-heatwave-france24",
  },
  {
    sourceId: "source_al_jazeera",
    title: "Sudan agencies reopen border aid corridor as famine warnings deepen",
    summary:
      "Relief groups say a reopened route could ease shortages, but fighting and screening delays are still slowing deliveries into Darfur.",
    hoursAgo: 1,
    topic: "Conflict",
    region: "Africa",
    urlPath: "sudan-aid-corridor-aj",
  },
  {
    sourceId: "source_bbc_world",
    title: "Aid route into Darfur expands while relief groups warn supplies remain thin",
    summary:
      "Humanitarian agencies say new cross-border access is welcome, though volume remains well below what displaced communities need.",
    hoursAgo: 6,
    topic: "Conflict",
    region: "Africa",
    urlPath: "sudan-aid-corridor-bbc",
  },
  {
    sourceId: "source_france24",
    title: "New Sudan cross-border aid window aims to reach displaced families",
    summary:
      "Regional diplomacy has opened another delivery lane, but truck availability and checkpoints remain major constraints.",
    hoursAgo: 9,
    topic: "Conflict",
    region: "Africa",
    urlPath: "sudan-aid-corridor-france24",
  },
  {
    sourceId: "source_dawn",
    title: "Regional officials press for broader Sudan aid access after renewed fighting",
    summary:
      "Neighbouring governments are urging additional corridors as hunger indicators worsen in several conflict-hit areas.",
    hoursAgo: 15,
    topic: "Conflict",
    region: "Africa",
    urlPath: "sudan-aid-corridor-dawn",
  },
  {
    sourceId: "source_guardian_world",
    title: "Peru copper shipments slowed as protests return near southern mines",
    summary:
      "Road blockades and local anger over environmental monitoring are slowing truck movements through Peru's mining corridor.",
    hoursAgo: 3,
    topic: "Economy",
    region: "Latin America",
    urlPath: "peru-copper-protests-guardian",
  },
  {
    sourceId: "source_cbs_world",
    title: "Peru mine corridor disrupted as local protests resume",
    summary:
      "Export logistics have tightened after residents re-formed protest camps near key copper projects.",
    hoursAgo: 8,
    topic: "Economy",
    region: "Latin America",
    urlPath: "peru-copper-protests-cbs",
  },
  {
    sourceId: "source_npr_world",
    title: "Communities in Peru revive anti-mining protests, jolting copper logistics",
    summary:
      "Analysts say the renewed demonstrations could create another short-term squeeze in global copper supply chains.",
    hoursAgo: 11,
    topic: "Economy",
    region: "Latin America",
    urlPath: "peru-copper-protests-npr",
  },
  {
    sourceId: "source_the_hindu_world",
    title: "Renewed Peru protests threaten copper supply chains",
    summary:
      "Shipping planners are watching Peru closely as blockades raise questions about deliveries from the country's south.",
    hoursAgo: 18,
    topic: "Economy",
    region: "Latin America",
    urlPath: "peru-copper-protests-hindu",
  },
  {
    sourceId: "source_straits_times_world",
    title: "Low Mekong water levels snarl cargo schedules across mainland Southeast Asia",
    summary:
      "River operators say barges are reducing loads as drought conditions bite across several stretches of the Mekong.",
    hoursAgo: 5,
    topic: "Climate",
    region: "Asia",
    urlPath: "mekong-drought-st",
  },
  {
    sourceId: "source_bbc_world",
    title: "Drought on Mekong disrupts river trade routes in South-East Asia",
    summary:
      "Freight companies are shifting routes and warning of higher inland transport costs as water levels remain unusually low.",
    hoursAgo: 10,
    topic: "Climate",
    region: "Asia",
    urlPath: "mekong-drought-bbc",
  },
  {
    sourceId: "source_japan_times_world",
    title: "Shippers reroute as Mekong drought squeezes regional freight capacity",
    summary:
      "Logistics groups say river traffic is losing efficiency just as agricultural exports pick up seasonally.",
    hoursAgo: 13,
    topic: "Climate",
    region: "Asia",
    urlPath: "mekong-drought-jt",
  },
  {
    sourceId: "source_dw",
    title: "Dry-season extremes weigh on Mekong ports and supply chains",
    summary:
      "Ports along the river are revising throughput assumptions as the drought persists beyond typical seasonal expectations.",
    hoursAgo: 20,
    topic: "Climate",
    region: "Asia",
    urlPath: "mekong-drought-dw",
  },
  {
    sourceId: "source_cbc_world",
    title: "Pacific island states face longer outage as undersea cable repair slips",
    summary:
      "Officials say repair vessels will arrive later than planned, prolonging dependence on slower backup links.",
    hoursAgo: 2,
    topic: "Technology",
    region: "Oceania",
    urlPath: "pacific-cable-cbc",
  },
  {
    sourceId: "source_guardian_world",
    title: "Repair delays leave Pacific governments leaning on backup satellite links",
    summary:
      "Several administrations are prioritising hospitals and emergency services while cable repairs remain delayed.",
    hoursAgo: 7,
    topic: "Technology",
    region: "Oceania",
    urlPath: "pacific-cable-guardian",
  },
  {
    sourceId: "source_al_jazeera",
    title: "Undersea cable damage raises connectivity concerns across the Pacific",
    summary:
      "Telecom officials say public service websites and banking systems are operating on constrained backup capacity.",
    hoursAgo: 14,
    topic: "Technology",
    region: "Oceania",
    urlPath: "pacific-cable-aj",
  },
  {
    sourceId: "source_france24",
    title: "Cable ship delay extends communications disruption for several Pacific islands",
    summary:
      "Business groups warn the prolonged disruption is pushing up transaction costs for island economies.",
    hoursAgo: 22,
    topic: "Technology",
    region: "Oceania",
    urlPath: "pacific-cable-france24",
  },
  {
    sourceId: "source_bbc_world",
    title: "Caucasus truce monitors dispute access after new ceasefire complaints",
    summary:
      "Mediators say monitoring missions are facing new restrictions after a fresh round of accusations along the frontier.",
    hoursAgo: 3,
    topic: "Conflict",
    region: "Europe",
    urlPath: "caucasus-monitors-bbc",
  },
  {
    sourceId: "source_dw",
    title: "Observers report tension along Caucasus line despite nominal ceasefire",
    summary:
      "Diplomats are urging both sides to restore monitoring access before the latest complaints spiral further.",
    hoursAgo: 8,
    topic: "Conflict",
    region: "Europe",
    urlPath: "caucasus-monitors-dw",
  },
  {
    sourceId: "source_al_jazeera",
    title: "Ceasefire mechanism tested after new incidents in the South Caucasus",
    summary:
      "Regional actors are weighing whether to broaden observer mandates after repeated claims of violations.",
    hoursAgo: 12,
    topic: "Conflict",
    region: "Europe",
    urlPath: "caucasus-monitors-aj",
  },
  {
    sourceId: "source_jerusalem_post",
    title: "Regional mediators push for wider monitoring role in Caucasus flashpoints",
    summary:
      "Negotiators say a larger verification presence could lower the risk of rapid escalation.",
    hoursAgo: 19,
    topic: "Conflict",
    region: "Europe",
    urlPath: "caucasus-monitors-jpost",
  },
  {
    sourceId: "source_france24",
    title: "West African cholera campaign slowed by vaccine cold-chain bottlenecks",
    summary:
      "Public health teams say refrigeration gaps and port delays are limiting how quickly doses can move inland.",
    hoursAgo: 4,
    topic: "Health",
    region: "Africa",
    urlPath: "west-africa-cholera-france24",
  },
  {
    sourceId: "source_npr_world",
    title: "Health officials warn vaccine logistics are lagging West Africa cholera spread",
    summary:
      "Doctors say supply exists on paper, but transport and storage remain the central problem on the ground.",
    hoursAgo: 9,
    topic: "Health",
    region: "Africa",
    urlPath: "west-africa-cholera-npr",
  },
  {
    sourceId: "source_bbc_world",
    title: "Ports and refrigeration gaps complicate cholera response in West Africa",
    summary:
      "Regional agencies are asking donors for faster airlift options as treatment centres come under strain.",
    hoursAgo: 16,
    topic: "Health",
    region: "Africa",
    urlPath: "west-africa-cholera-bbc",
  },
  {
    sourceId: "source_dawn",
    title: "Regional health agencies seek faster cholera vaccine deliveries in West Africa",
    summary:
      "Officials say time lost in customs and warehousing is now shaping the speed of the response.",
    hoursAgo: 23,
    topic: "Health",
    region: "Africa",
    urlPath: "west-africa-cholera-dawn",
  },
  {
    sourceId: "source_cnn_world",
    title: "Arctic shipping insurers lift premiums as ice volatility and security risks grow",
    summary:
      "Insurers are recalculating voyage risk as unpredictable conditions and military friction complicate planning for the season.",
    hoursAgo: 6,
    topic: "Climate",
    region: "Global",
    urlPath: "arctic-insurance-cnn",
  },
  {
    sourceId: "source_guardian_world",
    title: "Unstable ice and geopolitics push up Arctic voyage insurance costs",
    summary:
      "Shipping brokers say more cargo owners are reconsidering route assumptions because coverage is getting more expensive.",
    hoursAgo: 12,
    topic: "Climate",
    region: "Global",
    urlPath: "arctic-insurance-guardian",
  },
  {
    sourceId: "source_japan_times_world",
    title: "Higher premiums cloud planning for Arctic summer shipping routes",
    summary:
      "Trade planners are bracing for a less predictable navigation season as insurers demand broader risk buffers.",
    hoursAgo: 18,
    topic: "Climate",
    region: "Global",
    urlPath: "arctic-insurance-jt",
  },
  {
    sourceId: "source_cbc_world",
    title: "Canadian Arctic carriers face steeper insurance bills ahead of season",
    summary:
      "Operators say premium increases are now becoming a material input into route economics for northern shipping.",
    hoursAgo: 26,
    topic: "Climate",
    region: "Global",
    urlPath: "arctic-insurance-cbc",
  },
];

function buildDemoArticle(seed: DemoSeed): ArticleRecord {
  const source = FEED_SOURCE_MAP.get(seed.sourceId);

  if (!source) {
    throw new Error(`Unknown demo source: ${seed.sourceId}`);
  }

  const publishedAt = subHours(new Date(), seed.hoursAgo).toISOString();
  const now = new Date().toISOString();
  const combinedText = `${seed.title} ${seed.summary}`;

  return {
    id: createStableId(`${source.id}|${seed.urlPath}`, "article"),
    sourceId: source.id,
    sourceSlug: source.slug,
    sourceName: source.name,
    sourceHomepageUrl: source.homepageUrl,
    sourceRegion: source.region,
    title: seed.title,
    url: `${source.homepageUrl}/${seed.urlPath}`,
    publishedAt,
    summary: truncate(seed.summary, 220),
    author: null,
    imageUrl: null,
    topic: seed.topic ?? detectTopic(combinedText),
    language: source.language,
    region: seed.region ?? detectRegion(combinedText, source.region),
    normalizedTitle: normalizeTitle(seed.title),
    contentSnippet: truncate(seed.summary, 280),
    keywords: extractKeywords(combinedText),
    majorOutlet: source.isMajor,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildDemoDataset(): {
  sources: SourceRecord[];
  articles: ArticleRecord[];
  clusters: ClusteredStory[];
} {
  const articles = DEMO_STORY_SEEDS.map(buildDemoArticle);
  const clusters = buildStoryClusters(articles);

  return {
    sources: FEED_SOURCES,
    articles,
    clusters,
  };
}
