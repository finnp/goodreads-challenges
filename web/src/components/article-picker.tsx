import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BlogPostData } from "@/types/site-data";

const ALL_LABEL = "All lists";

function pickerLine(post: BlogPostData): string {
  return post.pickerLabel?.trim() || post.title;
}

function isFullSelection(indices: number[], postCount: number): boolean {
  if (postCount === 0 || indices.length !== postCount) return false;
  const want = new Set(indices);
  if (want.size !== postCount) return false;
  for (let i = 0; i < postCount; i++) {
    if (!want.has(i)) return false;
  }
  return true;
}

function triggerSummary(
  posts: BlogPostData[],
  selectedIndices: number[],
): string {
  const n = posts.length;
  if (n === 0) return ALL_LABEL;
  if (selectedIndices.length === 0) return "No lists selected";
  if (isFullSelection(selectedIndices, n)) return ALL_LABEL;
  if (selectedIndices.length === 1) {
    const post = posts[selectedIndices[0]!];
    return post ? pickerLine(post) : ALL_LABEL;
  }
  const labels = selectedIndices
    .filter((i) => posts[i] != null)
    .map((i) => pickerLine(posts[i]!));
  if (labels.length <= 2) return labels.join(", ");
  return `${labels[0]}, ${labels[1]} +${labels.length - 2} more`;
}

type ListFilterPickerProps = {
  posts: BlogPostData[];
  selectedIndices: number[];
  onToggleIndex: (index: number) => void;
  onSelectAll: () => void;
  className?: string;
};

export function ArticlePicker({
  posts,
  selectedIndices,
  onToggleIndex,
  onSelectAll,
  className,
}: ListFilterPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(
    () => new Set(selectedIndices),
    [selectedIndices],
  );

  const triggerLabel = useMemo(
    () => triggerSummary(posts, selectedIndices),
    [posts, selectedIndices],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "default" }),
          "h-8 min-h-8 w-full justify-between gap-2 px-2.5 py-0 text-left text-[13px] leading-none font-normal",
          className,
        )}
      >
        <span className="min-w-0 truncate leading-none">{triggerLabel}</span>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),36rem)] max-w-xl p-0"
        align="start"
      >
        <div className="flex flex-col gap-1 border-b p-2.5">
          <button
            type="button"
            className="text-primary hover:text-primary/90 text-left text-xs font-medium underline-offset-4 hover:underline"
            onClick={() => onSelectAll()}
          >
            Select all lists
          </button>
        </div>
        <ul
          className="max-h-72 overflow-y-auto p-1"
          aria-label="Choose lists to include"
        >
          {posts.map((post, index) => {
            const checked = selectedSet.has(index);
            const id = `list-pick-${index}`;
            return (
              <li key={post.url}>
                <label
                  htmlFor={id}
                  className={cn(
                    "hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm",
                    checked && "bg-accent/70",
                  )}
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleIndex(index)}
                    className="border-input text-primary focus-visible:ring-ring mt-1 size-4 shrink-0 cursor-pointer rounded border shadow-xs focus-visible:ring-2 focus-visible:outline-none"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5 text-left">
                    <span className="font-medium leading-snug">
                      {pickerLine(post)}
                    </span>
                    {post.pickerLabel ? (
                      <span className="text-muted-foreground line-clamp-2 text-xs leading-snug">
                        {post.title}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
