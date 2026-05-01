import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Table2 } from "lucide-react";

import { ArticlePicker } from "@/components/article-picker";
import { BooksDataTable } from "@/components/books-data-table";
import { RatingsScatterChart } from "@/components/ratings-scatter-chart";
import {
  bookDedupeKey,
  countListsPerBook,
  listLabelsPerBook,
  mergeBooksUnique,
} from "@/lib/merge-books";
import {
  readAppView,
  readListIndices,
  writeAppView,
  writeListIndices,
  type AppView,
} from "@/lib/persisted-ui";
import { cn } from "@/lib/utils";
import type { BookTableRow, SiteData } from "@/types/site-data";

const base = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const DATA_URL = `${base}data.json`;

export default function App() {
  const [site, setSite] = useState<SiteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedListIndices, setSelectedListIndices] = useState<number[]>([]);
  const [appView, setAppView] = useState<AppView>(() => readAppView());
  const listSelectionHydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(DATA_URL);
        if (!res.ok) {
          throw new Error(`Failed to load data (${res.status})`);
        }
        const json = (await res.json()) as SiteData;
        if (!cancelled) {
          setSite(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load data.json");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!site?.posts?.length) return;
    const saved = readListIndices(site.posts.length);
    setSelectedListIndices(
      saved !== null ? saved : site.posts.map((_, i) => i),
    );
    listSelectionHydrated.current = true;
  }, [site]);

  useEffect(() => {
    if (!listSelectionHydrated.current || !site?.posts?.length) return;
    writeListIndices(selectedListIndices);
  }, [selectedListIndices, site?.posts?.length]);

  useEffect(() => {
    writeAppView(appView);
  }, [appView]);

  const tableBooks = useMemo(() => {
    if (!site?.posts?.length) return [];
    if (selectedListIndices.length === 0) return [];
    const picked = selectedListIndices
      .filter((i) => site.posts[i] != null)
      .map((i) => site.posts[i]!);
    return mergeBooksUnique(picked);
  }, [site?.posts, selectedListIndices]);

  const listCountByKey = useMemo(
    () => (site?.posts?.length ? countListsPerBook(site.posts) : new Map()),
    [site?.posts],
  );

  const listLabelsByKey = useMemo(
    () => (site?.posts?.length ? listLabelsPerBook(site.posts) : new Map()),
    [site?.posts],
  );

  const tableRows: BookTableRow[] = useMemo(
    () =>
      tableBooks.map((b) => {
        const key = bookDedupeKey(b);
        return {
          ...b,
          listCount: listCountByKey.get(key) ?? 0,
          listLabels: listLabelsByKey.get(key) ?? [],
        };
      }),
    [tableBooks, listCountByKey, listLabelsByKey],
  );

  if (error) {
    return (
      <div className="bg-background text-destructive flex min-h-svh flex-col items-center justify-center gap-2 p-6">
        <p className="font-medium">Could not load book data</p>
        <p className="text-muted-foreground max-w-md text-center text-sm">
          {error}.           Run{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            npm run scrape
          </code>{" "}
          then{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            npm run build
          </code>{" "}
          from the repo root (or{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            npm run scrape:build
          </code>
          ), then refresh.
        </p>
      </div>
    );
  }

  if (!site?.posts?.length) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center p-6 text-sm">
        Loading…
      </div>
    );
  }

  const listPicker = (
    <ArticlePicker
      posts={site.posts}
      selectedIndices={selectedListIndices}
      onToggleIndex={(index) => {
        setSelectedListIndices((prev) => {
          const next = new Set(prev);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          return [...next].sort((a, b) => a - b);
        });
      }}
      onSelectAll={() => setSelectedListIndices(site.posts.map((_, i) => i))}
      onDeselectAll={() => setSelectedListIndices([])}
      className="h-8 min-h-8 min-w-[12rem] max-w-xs shrink-0"
    />
  );

  return (
    <div className="bg-background min-h-svh overflow-x-hidden">
      <div className="mx-auto min-w-0 max-w-7xl px-4 py-10 md:px-6">
        <header className="mb-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                Goodreads Spring Challenges
              </h1>
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                Last Updated: {new Date(site.scrapedAt).toLocaleString()}.
              </p>
            </div>
            <nav
              className="bg-muted/40 inline-flex shrink-0 gap-0.5 rounded-lg border p-1 shadow-sm"
              aria-label="Main views"
            >
              <button
                type="button"
                role="tab"
                aria-selected={appView === "table"}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  appView === "table"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => setAppView("table")}
              >
                <Table2 className="size-4 shrink-0 opacity-80" aria-hidden />
                Table
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={appView === "graph"}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  appView === "graph"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => setAppView("graph")}
              >
                <LineChart className="size-4 shrink-0 opacity-80" aria-hidden />
                Graph
              </button>
            </nav>
          </div>
        </header>

        {appView === "table" ? (
          <BooksDataTable data={tableRows} toolbarStart={listPicker} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">{listPicker}</div>
            <div className="bg-card overflow-hidden rounded-xl border p-4 shadow-sm md:p-5">
              <RatingsScatterChart
                site={site}
                selectedListIndices={selectedListIndices}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
