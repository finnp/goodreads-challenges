export type BookRow = {
  title: string;
  author: string;
  bookUrl: string;
  authorUrl: string;
  avgRating: number | null;
  ratingsCount: number | null;
  publishedYear: number | null;
  description: string;
};

export type BlogPostData = {
  url: string;
  title: string;
  /** Short label in the article picker (falls back to `title` if missing). */
  pickerLabel?: string;
  books: BookRow[];
};

export type SiteData = {
  scrapedAt: string;
  sourceNewsUrl: string;
  posts: BlogPostData[];
};

/** Table row: scraped book + computed list membership (all site lists). */
export type BookTableRow = BookRow & {
  listCount: number;
  listLabels: string[];
};
