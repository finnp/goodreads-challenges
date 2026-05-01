import type { ChartData } from "chart.js";

import type { BlogPostData, SiteData } from "@/types/site-data";

export const LIST_SCATTER_COLORS = [
  "rgba(37, 99, 235, 0.55)",
  "rgba(220, 38, 38, 0.55)",
  "rgba(5, 150, 105, 0.55)",
  "rgba(217, 119, 6, 0.55)",
  "rgba(124, 58, 237, 0.55)",
  "rgba(219, 39, 119, 0.55)",
  "rgba(14, 165, 233, 0.55)",
  "rgba(100, 116, 139, 0.55)",
] as const;

const BUBBLE_R_MIN = 1;
const BUBBLE_R_MAX = 10;

export function listPickerLabel(post: BlogPostData): string {
  return post.pickerLabel?.trim() || post.title;
}

function ratingsLogCeilingPosts(posts: BlogPostData[]): number {
  const counts: number[] = [];
  for (const post of posts) {
    for (const b of post.books) {
      if (b.ratingsCount != null && b.ratingsCount >= 100) {
        counts.push(b.ratingsCount);
      }
    }
  }
  if (!counts.length) return 101;
  counts.sort((a, b) => a - b);
  const idx = Math.min(
    counts.length - 1,
    Math.max(0, Math.ceil(0.99 * counts.length) - 1),
  );
  return Math.max(counts[idx] ?? 101, 101);
}

function radiusPx(
  ratingsCount: number | null,
  ceiling: number,
): number {
  if (ratingsCount == null || ratingsCount < 1 || ratingsCount < 100) {
    return BUBBLE_R_MIN;
  }
  const logLo = Math.log10(100);
  const logHi = Math.log10(Math.max(ceiling, 101));
  const span = Math.max(logHi - logLo, 1e-6);
  const log = Math.log10(ratingsCount);
  const t = Math.min(1, Math.max(0, (log - logLo) / span));
  return BUBBLE_R_MIN + t * (BUBBLE_R_MAX - BUBBLE_R_MIN);
}

export function ratingAxisRange(xs: number[]): { min: number; max: number } {
  if (!xs.length) return { min: 3, max: 5 };
  let rawMin = Math.min(...xs);
  let rawMax = Math.max(...xs);
  const span = rawMax - rawMin;
  const pad = Math.max(0.06, span * 0.08);
  let min = rawMin - pad;
  let max = rawMax + pad;
  const minSpan = 0.35;
  if (max - min < minSpan) {
    const c = (min + max) / 2;
    min = c - minSpan / 2;
    max = c + minSpan / 2;
  }
  min = Math.max(2.5, min);
  max = Math.min(5.05, max);
  if (max - min < minSpan) {
    max = Math.min(5.05, min + minSpan);
  }
  return { min, max };
}

export type BubblePoint = {
  x: number;
  y: number;
  r: number;
  ratings: number | null;
  title: string;
  author: string;
};

export type ScatterChartPack = {
  data: ChartData<"bubble", BubblePoint[]>;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export function buildRatingsScatterPack(
  site: SiteData,
  selectedIndices: number[],
): ScatterChartPack | null {
  const posts = selectedIndices
    .filter((i) => site.posts[i] != null)
    .map((i) => site.posts[i]!);
  if (!posts.length) return null;

  const ceiling = ratingsLogCeilingPosts(posts);
  type Pt = BubblePoint;
  const datasets = posts.map((post, i) => {
    const label = listPickerLabel(post);
    const color = LIST_SCATTER_COLORS[i % LIST_SCATTER_COLORS.length];
    const data: Pt[] = [];
    for (const b of post.books) {
      if (b.avgRating == null || b.pageCount == null) continue;
      data.push({
        x: b.avgRating,
        y: b.pageCount,
        r: radiusPx(b.ratingsCount, ceiling),
        ratings: b.ratingsCount,
        title: b.title,
        author: b.author,
      });
    }
    return {
      label,
      data,
      backgroundColor: color,
      borderColor: color.replace("0.55", "0.95"),
      borderWidth: 1,
    };
  });

  const allY = datasets.flatMap((d) => d.data.map((p) => p.y));
  const allX = datasets.flatMap((d) => d.data.map((p) => p.x));
  if (!allX.length) {
    return {
      data: { datasets },
      xMin: 3,
      xMax: 5,
      yMin: 0,
      yMax: 1,
    };
  }
  const yMax = Math.max(...allY, 1);
  const yMin = Math.min(...allY, 0);
  const { min: xMin, max: xMax } = ratingAxisRange(allX);

  return {
    data: { datasets },
    xMin,
    xMax,
    yMin: Math.max(0, yMin * 0.92),
    yMax: yMax * 1.06,
  };
}
