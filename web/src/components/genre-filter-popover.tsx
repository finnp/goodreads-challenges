import { useMemo, useState } from "react";
import type { Table } from "@tanstack/table-core";
import { Check, ChevronsUpDown, ListFilter } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { genrePillClassName } from "@/lib/genre-pill-palette";
import { cn } from "@/lib/utils";
import type { BookTableRow } from "@/types/site-data";

const GENRES_COLUMN_ID = "genres";

function selectedGenres(table: Table<BookTableRow>): string[] {
  const raw = table.getColumn(GENRES_COLUMN_ID)?.getFilterValue() as
    | string[]
    | undefined;
  return raw?.length ? [...raw] : [];
}

type GenreFilterPopoverProps = {
  table: Table<BookTableRow>;
  /** Distinct genre labels from the current table dataset, sorted. */
  genreOptions: string[];
  className?: string;
};

export function GenreFilterPopover({
  table,
  genreOptions,
  className,
}: GenreFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const col = table.getColumn(GENRES_COLUMN_ID);
  const selected = new Set(selectedGenres(table));

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return genreOptions;
    return genreOptions.filter((g) => g.toLowerCase().includes(q));
  }, [genreOptions, query]);

  const selectedCount = selected.size;

  const toggle = (label: string) => {
    if (!col) return;
    const cur = selectedGenres(table);
    const next = cur.includes(label)
      ? cur.filter((g) => g !== label)
      : [...cur, label];
    col.setFilterValue(next.length ? next : undefined);
  };

  const clear = () => {
    col?.setFilterValue(undefined);
    setQuery("");
  };

  if (genreOptions.length === 0) {
    return null;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "default" }),
          "h-8 min-h-8 shrink-0 gap-2 px-2.5 py-0 text-[13px] leading-none font-normal",
          selectedCount > 0 && "border-primary/40 bg-primary/5",
          className,
        )}
      >
        <ListFilter className="text-muted-foreground size-4 shrink-0 opacity-80" />
        <span className="min-w-0 leading-none">Top genres</span>
        {selectedCount > 0 ? (
          <span className="bg-primary/15 text-primary inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0 text-[11px] font-semibold tabular-nums">
            {selectedCount}
          </span>
        ) : null}
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent
        className="flex w-[min(calc(100vw-2rem),20rem)] max-w-none flex-col gap-0 p-0"
        align="start"
      >
        <PopoverHeader className="border-b px-3 py-2.5">
          <PopoverTitle className="text-sm">Filter by genre</PopoverTitle>
          <PopoverDescription className="text-xs leading-snug">
            Books that include{" "}
            <span className="font-medium text-foreground">any</span> of your
            selections stay visible.
          </PopoverDescription>
        </PopoverHeader>
        <div className="px-3 pt-2">
          <Input
            placeholder="Search genres…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-[13px]"
            aria-label="Search genres"
          />
        </div>
        <ul
          className="max-h-[min(50vh,16rem)] overflow-y-auto overscroll-contain px-2 py-2"
          role="listbox"
          aria-multiselectable
        >
          {filteredOptions.length === 0 ? (
            <li className="text-muted-foreground px-2 py-3 text-center text-xs">
              No genres match.
            </li>
          ) : (
            filteredOptions.map((label) => {
              const isOn = selected.has(label);
              return (
                <li key={label} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isOn}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                      isOn && "bg-muted/60",
                    )}
                    onClick={() => toggle(label)}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border border-border bg-background",
                        isOn && "border-primary/50 bg-primary/10 text-primary",
                      )}
                      aria-hidden
                    >
                      {isOn ? (
                        <Check className="size-3 stroke-[2.5]" />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "inline-flex min-w-0 max-w-full items-center rounded-full border px-2 py-0.5 text-left text-[11px] font-medium leading-tight",
                        genrePillClassName(label),
                      )}
                    >
                      <span className="truncate">{label}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t px-2 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 px-2 text-xs"
            disabled={selectedCount === 0}
            onClick={() => clear()}
          >
            Clear
          </Button>
          <span className="text-muted-foreground pr-1 text-xs tabular-nums">
            {genreOptions.length} genres
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
