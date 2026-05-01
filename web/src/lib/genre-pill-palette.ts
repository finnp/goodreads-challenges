/**
 * Stable, light pill colors for Goodreads genre labels.
 * Palette entries must stay full string literals so Tailwind can see them.
 */

/**
 * Optional pins (normalized lowercase keys): one bucket per color for common
 * umbrella genres. Any other label uses `djb2Hash` % 8 so it stays stable.
 */
export const GENRE_PALETTE_INDEX_BY_GENRE: Readonly<Record<string, number>> = {
  fiction: 0,
  thriller: 1,
  mystery: 2,
  romance: 3,
  fantasy: 4,
  "science fiction": 5,
  "historical fiction": 6,
  nonfiction: 7,
};

/** Eight light tints tuned for the app’s warm paper background. */
const GENRE_PILL_PALETTE = [
  "border-sky-400/35 bg-sky-100/90 text-sky-950",
  "border-emerald-400/35 bg-emerald-100/90 text-emerald-950",
  "border-violet-400/35 bg-violet-100/90 text-violet-950",
  "border-amber-400/35 bg-amber-100/90 text-amber-950",
  "border-rose-400/35 bg-rose-100/90 text-rose-950",
  "border-cyan-400/35 bg-cyan-100/90 text-cyan-950",
  "border-orange-400/35 bg-orange-100/90 text-orange-950",
  "border-teal-400/35 bg-teal-100/90 text-teal-950",
] as const;

const PALETTE_SIZE = GENRE_PILL_PALETTE.length;

function djb2Hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

/** 0 .. PALETTE_SIZE-1, stable for the same label. */
export function genrePaletteIndex(genre: string): number {
  const key = genre.trim().toLowerCase();
  const pinned = GENRE_PALETTE_INDEX_BY_GENRE[key];
  if (pinned != null && pinned >= 0 && pinned < PALETTE_SIZE) {
    return pinned;
  }
  return djb2Hash(key) % PALETTE_SIZE;
}

export function genrePillClassName(genre: string): string {
  return GENRE_PILL_PALETTE[genrePaletteIndex(genre)];
}
