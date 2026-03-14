/**
 * Phase 1, Stage 4: Union-Find / Disjoint-Set clustering with transitive
 * drift prevention. Merges are validated against the cluster representative,
 * not just the most recent article. Max cluster size: 50.
 */

import type { PreparedArticle, ComparisonResult } from "./compare";
import { compareArticles } from "./compare";

const MAX_CLUSTER_SIZE = 50;

// ─── Union-Find data structure ──────────────────────────────────────────────

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  makeSet(id: string) {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    }
  }

  find(id: string): string {
    const p = this.parent.get(id);
    if (p === undefined) return id;
    if (p !== id) {
      const root = this.find(p);
      this.parent.set(id, root); // path compression
      return root;
    }
    return id;
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;

    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
    return true;
  }

  getClusters(): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const list = clusters.get(root) ?? [];
      list.push(id);
      clusters.set(root, list);
    }
    return clusters;
  }
}

// ─── Merge engine ───────────────────────────────────────────────────────────

export interface MergeResult {
  clusters: Map<string, PreparedArticle[]>;
  debugPairs: ComparisonResult[];
  representativeIds: Map<string, string>;
}

export function mergeArticles(prepared: PreparedArticle[]): MergeResult {
  const uf = new UnionFind();
  const articleMap = new Map<string, PreparedArticle>();
  const debugPairs: ComparisonResult[] = [];

  // Representative for each cluster root (the first / founding article)
  const representativeMap = new Map<string, PreparedArticle>();
  // Track cluster sizes
  const clusterSizes = new Map<string, number>();

  for (const pa of prepared) {
    uf.makeSet(pa.article.id);
    articleMap.set(pa.article.id, pa);
    representativeMap.set(pa.article.id, pa);
    clusterSizes.set(pa.article.id, 1);
  }

  // Sort by published time (oldest first) so the representative is the earliest
  const sorted = [...prepared].sort((a, b) => a.publishedAtMs - b.publishedAtMs);

  // O(n^2) pairwise — acceptable for a few hundred articles per window
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];

      const result = compareArticles(a, b);
      if (!result) continue;

      debugPairs.push(result);

      if (result.decision !== "merge") continue;

      const rootA = uf.find(a.article.id);
      const rootB = uf.find(b.article.id);

      if (rootA === rootB) continue;

      // Check cluster size cap
      const sizeA = clusterSizes.get(rootA) ?? 1;
      const sizeB = clusterSizes.get(rootB) ?? 1;
      if (sizeA + sizeB > MAX_CLUSTER_SIZE) continue;

      // Validate against representative to prevent transitive drift
      const repA = representativeMap.get(rootA)!;
      const repB = representativeMap.get(rootB)!;

      // If one side's representative doesn't match the other, reject
      const repCheck = compareArticles(repA, repB);
      if (!repCheck || repCheck.compositeScore < 0.30) continue;

      uf.union(a.article.id, b.article.id);

      // Update sizes and representative
      const newRoot = uf.find(a.article.id);
      clusterSizes.set(newRoot, sizeA + sizeB);

      // Keep the older article as representative
      if (!representativeMap.has(newRoot) || repA.publishedAtMs <= repB.publishedAtMs) {
        representativeMap.set(newRoot, repA);
      } else {
        representativeMap.set(newRoot, repB);
      }
    }
  }

  // Build final clusters
  const rawClusters = uf.getClusters();
  const clusters = new Map<string, PreparedArticle[]>();
  const representativeIds = new Map<string, string>();

  for (const [root, ids] of rawClusters) {
    const articles = ids
      .map((id) => articleMap.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.publishedAtMs - a.publishedAtMs);
    clusters.set(root, articles);
    const rep = representativeMap.get(root);
    representativeIds.set(root, rep?.article.id ?? articles[0].article.id);
  }

  return { clusters, debugPairs, representativeIds };
}
