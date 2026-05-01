import type { ColumnFiltersState, SortingState } from "@tanstack/table-core";

/** List picker: indices of `site.posts` to include. */
export const LS_LIST_INDICES = "goodreads-news:v1:selectedListIndices";

/** Table: title + genre filters and sort order. */
export const LS_TABLE_UI = "goodreads-news:v1:tableUi";

export function readListIndices(postCount: number): number[] | null {
  if (typeof window === "undefined" || postCount === 0) return null;
  try {
    const raw = localStorage.getItem(LS_LIST_INDICES);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const out = [
      ...new Set(
        parsed.filter(
          (x): x is number =>
            typeof x === "number" &&
            Number.isInteger(x) &&
            x >= 0 &&
            x < postCount,
        ),
      ),
    ].sort((a, b) => a - b);
    return out;
  } catch {
    return null;
  }
}

export function writeListIndices(indices: number[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_LIST_INDICES, JSON.stringify(indices));
  } catch {
    /* quota / private mode */
  }
}

function sanitizeColumnFilters(v: unknown): ColumnFiltersState {
  if (!Array.isArray(v)) return [];
  const out: ColumnFiltersState = [];
  for (const f of v) {
    if (!f || typeof f !== "object") continue;
    const id = (f as { id?: unknown }).id;
    const val = (f as { value?: unknown }).value;
    if (id !== "title" && id !== "genres") continue;
    if (id === "title") {
      if (typeof val !== "string") continue;
      if (!val.trim()) continue;
      out.push({ id: "title", value: val });
    } else {
      if (!Array.isArray(val)) continue;
      const genres = val.filter((x): x is string => typeof x === "string");
      if (!genres.length) continue;
      out.push({ id: "genres", value: genres });
    }
  }
  return out;
}

function sanitizeSorting(v: unknown): SortingState | null {
  if (!Array.isArray(v) || !v.length) return null;
  const out: SortingState = [];
  for (const s of v) {
    if (!s || typeof s !== "object") continue;
    const id = (s as { id?: unknown }).id;
    const desc = (s as { desc?: unknown }).desc;
    if (typeof id !== "string" || typeof desc !== "boolean") continue;
    out.push({ id, desc });
  }
  return out.length ? out : null;
}

const DEFAULT_SORT: SortingState = [{ id: "title", desc: false }];

export type PersistedTableUi = {
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
};

export function readTableUi(): PersistedTableUi {
  if (typeof window === "undefined") {
    return { columnFilters: [], sorting: DEFAULT_SORT };
  }
  try {
    const raw = localStorage.getItem(LS_TABLE_UI);
    if (raw == null) return { columnFilters: [], sorting: DEFAULT_SORT };
    const o = JSON.parse(raw) as Record<string, unknown>;
    const columnFilters = sanitizeColumnFilters(o?.columnFilters);
    const sorting = sanitizeSorting(o?.sorting) ?? DEFAULT_SORT;
    return { columnFilters, sorting };
  } catch {
    return { columnFilters: [], sorting: DEFAULT_SORT };
  }
}

export function writeTableUi(ui: PersistedTableUi): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_TABLE_UI, JSON.stringify(ui));
  } catch {
    /* quota */
  }
}

export type AppView = "table" | "graph";

export const LS_APP_VIEW = "goodreads-news:v1:appView";

export function readAppView(): AppView {
  if (typeof window === "undefined") return "table";
  try {
    const v = localStorage.getItem(LS_APP_VIEW);
    if (v === "graph" || v === "table") return v;
  } catch {
    /* ignore */
  }
  return "table";
}

export function writeAppView(view: AppView): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_APP_VIEW, view);
  } catch {
    /* quota */
  }
}
