import {
  Chart as ChartJS,
  registerables,
} from "chart.js";
import { useMemo } from "react";
import { Bubble } from "react-chartjs-2";

import {
  buildRatingsScatterPack,
  type BubblePoint,
} from "@/lib/ratings-scatter-data";
import type { SiteData } from "@/types/site-data";

ChartJS.register(...registerables);

type RatingsScatterChartProps = {
  site: SiteData;
  selectedListIndices: number[];
};

export function RatingsScatterChart({
  site,
  selectedListIndices,
}: RatingsScatterChartProps) {
  const pack = useMemo(
    () => buildRatingsScatterPack(site, selectedListIndices),
    [site, selectedListIndices],
  );

  if (!pack) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm">
        Select at least one list to see the chart.
      </div>
    );
  }

  const { data, xMin, xMax, yMin, yMax } = pack;
  const hasPoints = data.datasets.some((d) => d.data.length > 0);

  if (!hasPoints) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm">
        No books with both rating and page count in the selected lists.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="relative h-[min(72vh,620px)] w-full min-h-[360px]">
        <Bubble
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: {
              title: {
                display: true,
                text: "Goodreads Spring Challenge",
                font: { size: 18, weight: "600" },
                color: "#1e293b",
                padding: { bottom: 8 },
              },
              subtitle: {
                display: true,
                text: "Dot size shows how many Goodreads ratings each book has.",
                font: { size: 12 },
                color: "#64748b",
                padding: { bottom: 6 },
              },
              legend: {
                position: "bottom",
                labels: {
                  usePointStyle: true,
                  padding: 16,
                  font: { size: 11 },
                  color: "#334155",
                },
              },
              tooltip: {
                displayColors: false,
                padding: 12,
                caretPadding: 10,
                titleMarginBottom: 8,
                titleSpacing: 4,
                bodySpacing: 6,
                callbacks: {
                  title(items) {
                    const raw = items[0]?.raw as BubblePoint | undefined;
                    const book = raw?.title?.trim();
                    const author = raw?.author?.trim();
                    if (book && author) return [book, author];
                    if (book) return book;
                    return items[0]?.dataset?.label ?? "";
                  },
                  label(ctx) {
                    const raw = ctx.raw as BubblePoint;
                    const list = (ctx.dataset.label ?? "List").trim();
                    const pages = Math.round(raw.y).toLocaleString();
                    const rc = raw.ratings;
                    const ratingsLine =
                      rc != null
                        ? `${rc.toLocaleString()} Goodreads ratings`
                        : "Ratings count unknown";
                    return [
                      list,
                      `${raw.x.toFixed(2)}★ average  ·  ${pages} pages`,
                      ratingsLine,
                    ];
                  },
                },
              },
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: "Average star rating",
                  font: { size: 13, weight: "600" },
                  color: "#334155",
                },
                min: xMin,
                max: xMax,
                grid: { color: "rgba(148, 163, 184, 0.25)" },
                ticks: {
                  color: "#475569",
                  maxTicksLimit: 12,
                  callback(v) {
                    return typeof v === "number" ? v.toFixed(2) : String(v);
                  },
                },
              },
              y: {
                title: {
                  display: true,
                  text: "Printed pages",
                  font: { size: 13, weight: "600" },
                  color: "#334155",
                },
                min: yMin,
                max: yMax,
                grid: { color: "rgba(148, 163, 184, 0.25)" },
                ticks: { color: "#475569" },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
