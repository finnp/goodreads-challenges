/**
 * Renders a bubble scatter PNG from web/public/data.json:
 * - X: average rating, Y: page count, color: list, bubble size: ratings (log-ish).
 *
 * Run: npx tsx scripts/scatter-rating-pages.ts
 * Output: scatter-rating-pages.png (repo root)
 */
import { Chart, registerables } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import * as fs from "node:fs/promises";
import * as path from "node:path";

Chart.register(...registerables);

type BookRow = {
  avgRating: number | null;
  ratingsCount: number | null;
  pageCount: number | null;
};

type BlogPostData = {
  pickerLabel?: string;
  title: string;
  books: BookRow[];
};

type SiteData = {
  scrapedAt: string;
  posts: BlogPostData[];
};

function listLabel(post: BlogPostData): string {
  return post.pickerLabel?.trim() || post.title;
}

const BUBBLE_R_MIN = 1;
const BUBBLE_R_MAX = 10;

/** ~99th percentile of ratings (≥100) so one mega-hit doesn’t shrink every other dot. */
function ratingsLogCeiling(site: SiteData): number {
  const counts: number[] = [];
  for (const post of site.posts) {
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

/**
 * Bubble radius: under 100 ratings → tiny dot. From 100 up, position on a log₁₀
 * scale from 100 to `ceiling` (99th pct.), mapped to BUBBLE_R_MIN…BUBBLE_R_MAX.
 */
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

/** Nice x-axis limits around observed ratings (typical band ~3–5, but follows data). */
function ratingAxisRange(xs: number[]): { min: number; max: number } {
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

const LIST_COLORS = [
  "rgba(37, 99, 235, 0.55)", // blue
  "rgba(220, 38, 38, 0.55)", // red
  "rgba(5, 150, 105, 0.55)", // emerald
  "rgba(217, 119, 6, 0.55)", // amber
  "rgba(124, 58, 237, 0.55)", // violet
  "rgba(219, 39, 119, 0.55)", // pink
  "rgba(14, 165, 233, 0.55)", // sky
  "rgba(100, 116, 139, 0.55)", // slate
];

async function main() {
  const dataPath = path.join(process.cwd(), "web", "public", "data.json");
  const raw = await fs.readFile(dataPath, "utf8");
  const site = JSON.parse(raw) as SiteData;

  if (!site.posts?.length) {
    throw new Error("No posts in data.json");
  }

  const ratingsCeiling = ratingsLogCeiling(site);

  const datasets = site.posts.map((post, i) => {
    const label = listLabel(post);
    const color = LIST_COLORS[i % LIST_COLORS.length];
    type BubblePt = { x: number; y: number; r: number; ratings: number | null };
    const data: BubblePt[] = [];
    for (const b of post.books) {
      if (b.avgRating == null || b.pageCount == null) continue;
      data.push({
        x: b.avgRating,
        y: b.pageCount,
        r: radiusPx(b.ratingsCount, ratingsCeiling),
        ratings: b.ratingsCount,
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

  const width = 1400;
  const height = 900;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: "#faf8f5",
  });

  const allY = datasets.flatMap((d) => d.data.map((p) => p.y));
  const allX = datasets.flatMap((d) => d.data.map((p) => p.x));
  const yMax = Math.max(...allY, 1);
  const yMin = Math.min(...allY, 0);
  const { min: xMin, max: xMax } = ratingAxisRange(allX);

  const configuration = {
    type: "bubble" as const,
    data: { datasets },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Goodreads Spring Challenge",
          font: { size: 22, weight: "600" as const },
          color: "#1e293b",
          padding: { top: 10, bottom: 6 },
        },
        subtitle: {
          display: true,
          text: "Dot size shows how many Goodreads ratings each book has.",
          font: { size: 13 },
          color: "#64748b",
          padding: { bottom: 12 },
        },
        legend: {
          position: "bottom" as const,
          labels: {
            usePointStyle: true,
            padding: 18,
            font: { size: 12 },
            color: "#334155",
          },
        },
        tooltip: {
          callbacks: {
            label(ctx: {
              parsed: { x: number; y: number };
              raw: { ratings?: number | null };
              dataset: { label?: string };
            }) {
              const { x, y } = ctx.parsed;
              const rc = ctx.raw?.ratings;
              const ratingsStr =
                rc != null ? `${rc.toLocaleString()} ratings` : "— ratings";
              return `${ctx.dataset.label ?? ""}: ${x.toFixed(2)}★ · ${Math.round(y)} pp. · ${ratingsStr}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Average star rating",
            font: { size: 14, weight: "600" as const },
            color: "#334155",
          },
          min: xMin,
          max: xMax,
          grid: { color: "rgba(148, 163, 184, 0.25)" },
          ticks: {
            color: "#475569",
            maxTicksLimit: 12,
            callback: (v: string | number) =>
              typeof v === "number" ? v.toFixed(2) : String(v),
          },
        },
        y: {
          title: {
            display: true,
            text: "Printed pages",
            font: { size: 14, weight: "600" as const },
            color: "#334155",
          },
          min: Math.max(0, yMin * 0.92),
          max: yMax * 1.06,
          grid: { color: "rgba(148, 163, 184, 0.25)" },
          ticks: { color: "#475569" },
        },
      },
    },
  };

  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  const outPath = path.join(process.cwd(), "scatter-rating-pages.png");
  await fs.writeFile(outPath, buffer);
  console.error(`[scatter] wrote ${outPath} (${buffer.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
