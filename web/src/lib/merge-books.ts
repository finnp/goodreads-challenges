import type { BlogPostData, BookRow } from "@/types/site-data";

function listLabel(post: BlogPostData): string {
  return post.pickerLabel?.trim() || post.title;
}

/** Stable key: `bookUrl`, or title + author fallback. */
export function bookDedupeKey(b: BookRow): string {
  const url = b.bookUrl.trim();
  if (url) return url;
  return `${b.title.trim().toLowerCase()}::${b.author.trim().toLowerCase()}`;
}

/** First occurrence wins when merging rows. */
export function mergeBooksUnique(posts: BlogPostData[]): BookRow[] {
  const seen = new Set<string>();
  const out: BookRow[] = [];
  for (const post of posts) {
    for (const b of post.books) {
      const key = bookDedupeKey(b);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(b);
    }
  }
  return out;
}

/** How many distinct curated lists include this book (duplicates within one list count once). */
export function countListsPerBook(posts: BlogPostData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const post of posts) {
    const inPost = new Set<string>();
    for (const b of post.books) {
      const key = bookDedupeKey(b);
      if (!key || inPost.has(key)) continue;
      inPost.add(key);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return map;
}

/** For each book key, challenge/list labels (post order) it appears in. */
export function listLabelsPerBook(posts: BlogPostData[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const post of posts) {
    const label = listLabel(post);
    const inPost = new Set<string>();
    for (const b of post.books) {
      const key = bookDedupeKey(b);
      if (!key || inPost.has(key)) continue;
      inPost.add(key);
      const list = map.get(key) ?? [];
      list.push(label);
      map.set(key, list);
    }
  }
  return map;
}
