import { useEffect, useMemo, useState } from "react";

import { ArticlePicker } from "@/components/article-picker";
import { BooksDataTable } from "@/components/books-data-table";
import {
  bookDedupeKey,
  countListsPerBook,
  listLabelsPerBook,
  mergeBooksUnique,
} from "@/lib/merge-books";
import type { BookTableRow, SiteData } from "@/types/site-data";

const base = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const DATA_URL = `${base}data.json`;

export default function App() {
  const [site, setSite] = useState<SiteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedListIndices, setSelectedListIndices] = useState<number[]>([]);

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
          setSelectedListIndices(json.posts.map((_, i) => i));
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
          {error}. Run{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            npm run scrape
          </code>{" "}
          from the repo root, then rebuild or refresh.
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

  return (
    <div className="bg-background min-h-svh overflow-x-hidden">
      <div className="mx-auto min-w-0 max-w-7xl px-4 py-10 md:px-6">
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Goodreads Spring Challenges
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Scraped {new Date(site.scrapedAt).toLocaleString()}.
          </p>
        </header>

        <BooksDataTable
          data={tableRows}
          toolbarStart={
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
              onSelectAll={() =>
                setSelectedListIndices(site.posts.map((_, i) => i))
              }
              onDeselectAll={() => setSelectedListIndices([])}
              className="h-8 min-h-8 min-w-[12rem] max-w-xs shrink-0"
            />
          }
        />
      </div>
    </div>
  );
}
