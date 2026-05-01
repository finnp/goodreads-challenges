import type { Column, ColumnDef, Row } from "@tanstack/table-core";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { RatingStars } from "@/components/rating-stars";
import { RatingsPeopleIcons } from "@/components/ratings-people-icons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { genrePillClassName } from "@/lib/genre-pill-palette";
import { cn } from "@/lib/utils";
import type { BookTableRow } from "@/types/site-data";

function DataTableColumnHeader({
  column,
  title,
  className,
}: {
  column: Column<BookTableRow, unknown>;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>;
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`-ml-2 h-8 data-[state=open]:bg-accent ${className ?? ""}`}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      {column.getIsSorted() === "desc" ? (
        <ArrowDown className="ml-1 size-4" />
      ) : column.getIsSorted() === "asc" ? (
        <ArrowUp className="ml-1 size-4" />
      ) : (
        <ArrowUpDown className="ml-1 size-4" />
      )}
    </Button>
  );
}

function nullsLastSort(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

/** `filterValue` is a list of genre labels; row matches if it has any of them. */
export function genreTableFilterFn(
  row: Row<BookTableRow>,
  _columnId: string,
  filterValue: unknown,
): boolean {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  const bookGenres = row.original.genres ?? [];
  return selected.some((g) => bookGenres.includes(g));
}

export const booksColumns: ColumnDef<BookTableRow>[] = [
  {
    accessorKey: "title",
    meta: {
      thClassName: "w-64 min-w-64 max-w-64",
      tdClassName: "w-64 min-w-64 max-w-64 align-top",
    },
    filterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue ?? "")
        .toLowerCase()
        .trim();
      if (!q) return true;
      return (row.original.title ?? "").toLowerCase().includes(q);
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => {
      const title = row.getValue("title") as string;
      const bookUrl = row.original.bookUrl;
      return (
        <a
          href={bookUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
          className="block max-w-full truncate font-medium text-primary underline-offset-4 hover:underline"
        >
          {title}
        </a>
      );
    },
  },
  {
    accessorKey: "author",
    meta: {
      thClassName: "min-w-0 max-w-[10rem]",
      tdClassName:
        "min-w-0 max-w-[10rem] whitespace-normal break-words align-top",
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Author" />
    ),
    cell: ({ row }) => {
      const authorUrl = row.original.authorUrl;
      const author = row.getValue("author") as string;
      if (authorUrl) {
        return (
          <a
            href={authorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary block underline-offset-4 hover:underline"
          >
            {author}
          </a>
        );
      }
      return <span className="block">{author}</span>;
    },
  },
  {
    accessorKey: "listCount",
    meta: {
      thClassName: "w-14 min-w-14 max-w-14",
      tdClassName: "w-14 min-w-14 max-w-14 align-top",
    },
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Lists" />
      </div>
    ),
    sortingFn: (rowA, rowB) =>
      (rowA.original.listCount ?? 0) - (rowB.original.listCount ?? 0),
    cell: ({ row }) => {
      const n = row.original.listCount;
      const labels = row.original.listLabels;
      const body = (
        <span className="tabular-nums">{n}</span>
      );
      if (!labels.length) {
        return <div className="text-right">{body}</div>;
      }
      const title = labels.join(" · ");
      return (
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <span
                {...props}
                className={cn(
                  "block cursor-default text-right",
                  props.className,
                )}
                aria-label={`${n} lists: ${title}`}
              >
                {body}
              </span>
            )}
          />
          <TooltipContent
            side="left"
            align="center"
            sideOffset={8}
            collisionPadding={16}
            className={cn(
              "!block !max-w-[min(20rem,calc(100vw-1.5rem))] !min-w-0",
              "!px-3 !py-2 !text-left !text-xs !leading-snug",
              "[&>svg]:hidden",
            )}
          >
            <p className="text-background/80 mb-1.5 font-medium">
              Challenge lists
            </p>
            <ul className="text-background list-none space-y-1 pl-0">
              {labels.map((label, i) => (
                <li key={`${i}:${label}`} className="flex gap-2">
                  <span aria-hidden className="text-background/60">
                    –
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: "avgRating",
    meta: {
      thClassName: "min-w-36",
      tdClassName: "min-w-36 align-middle",
    },
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Avg rating" />
      </div>
    ),
    sortingFn: (rowA, rowB) =>
      nullsLastSort(rowA.original.avgRating, rowB.original.avgRating),
    cell: ({ row }) => {
      const v = row.original.avgRating;
      if (v == null) {
        return <div className="text-right tabular-nums">—</div>;
      }
      return (
        <div className="flex items-center justify-end gap-2">
          <RatingStars rating={v} />
          <span className="tabular-nums">{v.toFixed(2)}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "ratingsCount",
    meta: {
      thClassName: "min-w-[12rem] whitespace-normal",
      tdClassName: "min-w-[12rem] align-middle",
    },
    header: ({ column }) => (
      <div className="flex min-w-0 justify-end">
        <DataTableColumnHeader
          column={column}
          title="Ratings"
          className="max-w-full min-w-0 shrink whitespace-normal"
        />
      </div>
    ),
    sortingFn: (rowA, rowB) =>
      nullsLastSort(rowA.original.ratingsCount, rowB.original.ratingsCount),
    cell: ({ row }) => {
      const v = row.original.ratingsCount;
      if (v == null) {
        return <div className="text-right text-sm">—</div>;
      }
      return (
        <div className="flex justify-end">
          <RatingsPeopleIcons count={v} />
        </div>
      );
    },
  },
  {
    accessorKey: "publishedYear",
    meta: {
      thClassName: "w-[9rem] min-w-[9rem] max-w-[9rem] whitespace-normal",
      tdClassName: "w-[9rem] min-w-[9rem] max-w-[9rem] align-middle",
    },
    header: ({ column }) => (
      <div className="flex min-w-0 justify-end">
        <DataTableColumnHeader
          column={column}
          title="Published"
          className="max-w-full min-w-0 shrink whitespace-normal"
        />
      </div>
    ),
    sortingFn: (rowA, rowB) =>
      nullsLastSort(rowA.original.publishedYear, rowB.original.publishedYear),
    cell: ({ row }) => {
      const v = row.original.publishedYear;
      return (
        <div className="text-right text-sm tabular-nums leading-none">
          {v != null ? v : "—"}
        </div>
      );
    },
  },
  {
    accessorKey: "pageCount",
    meta: {
      thClassName: "w-20 min-w-20 max-w-20",
      tdClassName: "w-20 min-w-20 max-w-20 align-middle",
    },
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Pages" />
      </div>
    ),
    sortingFn: (rowA, rowB) =>
      nullsLastSort(rowA.original.pageCount, rowB.original.pageCount),
    cell: ({ row }) => {
      const v = row.original.pageCount;
      return (
        <div className="text-right text-sm tabular-nums leading-none">
          {v != null ? v : "—"}
        </div>
      );
    },
  },
  {
    id: "genres",
    accessorFn: (row) => (row.genres ?? []).join(", "),
    filterFn: genreTableFilterFn,
    meta: {
      thClassName: "min-w-0 w-[13rem] max-w-[13rem]",
      tdClassName: "min-w-0 w-[13rem] max-w-[13rem] align-top",
    },
    header: () => (
      <div className="text-left text-sm font-medium">Top Genres</div>
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const genres = row.original.genres ?? [];
      if (!genres.length) {
        return <span className="text-muted-foreground text-sm">—</span>;
      }
      return (
        <div className="flex flex-wrap gap-1.5">
          {genres.map((label, i) => (
            <span
              key={`${i}:${label}`}
              className={cn(
                "inline-flex max-w-full items-center rounded-full border px-2 py-0.5",
                "text-left text-[11px] font-medium leading-tight",
                genrePillClassName(label),
              )}
            >
              <span className="min-w-0 truncate">{label}</span>
            </span>
          ))}
        </div>
      );
    },
  },
];
