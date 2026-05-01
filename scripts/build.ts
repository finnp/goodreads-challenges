import * as cheerio from "cheerio";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const GOODREADS_ORIGIN = "https://www.goodreads.com";
const NEWS_URL_FULL = `${GOODREADS_ORIGIN}/news`;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Curated lists (order = picker order). */
const EDITORIAL_POSTS: readonly { path: string; label: string }[] = [
  { path: "/blog/show/3093", label: "Community Picks" },
  { path: "/blog/show/3079", label: "Trending Books" },
  { path: "/blog/show/3087", label: "Marathon Reader" },
  { path: "/blog/show/3089", label: "Editors' Picks" },
  { path: "/blog/show/3090", label: "Books About Books" },
  { path: "/blog/show/3048", label: "AAPI Heritage Month" },
];
/** Keep batches small: a full editorial list in one GET can hit HTTP 414 (URI too long). */
const TOOLTIP_BATCH = Math.max(
  1,
  Number.parseInt(process.env.GOODREADS_TOOLTIP_BATCH ?? "28", 10) || 28,
);
/** Parallel fetches for per-book `/book/show/…` detail pages (page count + genres). */
const BOOK_PAGE_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.GOODREADS_BOOK_PAGE_CONCURRENCY ?? "12", 10) || 12,
);
const FETCH_TIMEOUT_MS = 45_000;
const TOOLTIPS_TIMEOUT_MS = 120_000;

type BookResource = { type: string; id: string };

export type BookRow = {
  title: string;
  author: string;
  bookUrl: string;
  authorUrl: string;
  avgRating: number | null;
  ratingsCount: number | null;
  publishedYear: number | null;
  pageCount: number | null;
  genres: string[];
  description: string;
};

export type BlogPostData = {
  url: string;
  title: string;
  /** Short label shown in the article picker. */
  pickerLabel: string;
  books: BookRow[];
};

export type SiteData = {
  scrapedAt: string;
  sourceNewsUrl: string;
  posts: BlogPostData[];
};

async function fetchWithTimeout(
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function fetchText(url: string): Promise<string> {
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    },
    FETCH_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function log(...args: unknown[]): void {
  console.error("[goodreads-news]", ...args);
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function extractBookResources(html: string): BookResource[] {
  const $ = cheerio.load(html);
  const out: BookResource[] = [];
  const seen = new Set<string>();
  $("div.js-tooltipTrigger.book[data-resource-id]").each((_, el) => {
    const id = $(el).attr("data-resource-id")?.trim();
    const type = ($(el).attr("data-resource-type") ?? "Book").trim();
    if (!id) return;
    const k = `${type}.${id}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ type, id });
  });
  return out;
}

function postTitleFromBlogHtml(html: string): string {
  const $ = cheerio.load(html);
  const og = $('meta[property="og:title"]').attr("content")?.trim();
  if (og) return og;
  return $("h1").first().text().trim() || "Untitled";
}

function tooltipParamsForBatch(batch: BookResource[]): string {
  const parts: string[] = [];
  for (const b of batch) {
    const key = `${b.type}.${b.id}`;
    const ek = encodeURIComponent(`resources[${key}][type]`);
    const eid = encodeURIComponent(`resources[${key}][id]`);
    parts.push(`${ek}=${encodeURIComponent(b.type)}`);
    parts.push(`${eid}=${encodeURIComponent(b.id)}`);
  }
  return parts.join("&");
}

type TooltipsJson = { tooltips: Record<string, string> };

/** Mirrors the browser’s logged-out XHR to /tooltips (no Cookie / CSRF). */
function tooltipRequestHeaders(pageReferer: string): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Priority: "u=1, i",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "X-Requested-With": "XMLHttpRequest",
    Referer: pageReferer,
  };
}

async function fetchTooltipsUrl(
  url: string,
  pageReferer: string,
): Promise<TooltipsJson> {
  const t0 = Date.now();
  const res = await fetchWithTimeout(
    url,
    { headers: tooltipRequestHeaders(pageReferer) },
    TOOLTIPS_TIMEOUT_MS,
  );
  const ms = Date.now() - t0;
  if (!res.ok) {
    const snippet = (await res.text()).slice(0, 200);
    const hint =
      res.status === 414
        ? " (URL too long — lower GOODREADS_TOOLTIP_BATCH, e.g. 20)"
        : "";
    throw new Error(`Tooltips HTTP ${res.status} after ${ms}ms${hint}: ${snippet}`);
  }
  return (await res.json()) as TooltipsJson;
}

async function fetchTooltips(
  resources: BookResource[],
  pageReferer: string,
): Promise<TooltipsJson> {
  const qs = tooltipParamsForBatch(resources);
  return fetchTooltipsUrl(`${GOODREADS_ORIGIN}/tooltips?${qs}`, pageReferer);
}

function parseTooltipFragment(html: string): BookRow {
  const $ = cheerio.load(html);
  const section = $("section.tooltip, section.js-tooltip").first();
  const titleA = section.find("h2 a.readable").first();
  const title = titleA.text().trim();
  const bookPath = titleA.attr("href")?.trim() ?? "";
  const authorA = section.find("a.authorName").first();
  const author = authorA.text().trim();
  const authorPath = authorA.attr("href")?.trim() ?? "";
  const mini = section
    .find(".minirating")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  let avgRating: number | null = null;
  let ratingsCount: number | null = null;
  const m = mini.match(
    /([\d.]+)\s*avg rating\s*[—–-]\s*([\d,]+)\s*ratings/i,
  );
  if (m) {
    avgRating = Number.parseFloat(m[1]);
    ratingsCount = Number.parseInt(m[2].replace(/,/g, ""), 10);
  }
  const pubBlock = section
    .find(".bookRatingAndPublishing")
    .text()
    .replace(/\s+/g, " ");
  let publishedYear: number | null = null;
  const py = pubBlock.match(/published\s*(\d{4})/i);
  if (py) publishedYear = Number.parseInt(py[1], 10);
  const desc = section
    .find('[id^="freeTextContainer"]')
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  return {
    title,
    author,
    bookUrl: bookPath ? new URL(bookPath, GOODREADS_ORIGIN).href : "",
    authorUrl: authorPath ? new URL(authorPath, GOODREADS_ORIGIN).href : "",
    avgRating,
    ratingsCount,
    publishedYear,
    pageCount: null,
    genres: [],
    description: desc,
  };
}

const TOP_GENRE_COUNT = 3;

type BookPageMeta = { pageCount: number | null; genres: string[] };

/** Parse `/book/show/…` HTML: `numberOfPages` in embedded JSON, genres from the metadata list. */
function parseBookDetailHtml(html: string): BookPageMeta {
  let pageCount: number | null = null;
  const np = html.match(/"numberOfPages"\s*:\s*(\d+)/);
  if (np) pageCount = Number.parseInt(np[1], 10);

  const $ = cheerio.load(html);
  if (pageCount == null) {
    const pf = $('[data-testid="pagesFormat"]').first().text();
    const m = pf.match(/(\d+)\s*pages?\b/i);
    if (m) pageCount = Number.parseInt(m[1], 10);
  }

  const genres: string[] = [];
  $(
    '[data-testid="genresList"] .BookPageMetadataSection__genreButton .Button__labelItem',
  ).each((_, el) => {
    if (genres.length >= TOP_GENRE_COUNT) return false;
    const t = $(el).text().trim();
    if (!t || /^\.{3}\s*more$/i.test(t)) return;
    genres.push(t);
    return undefined;
  });

  return { pageCount, genres };
}

function uniqueBookUrlsFromPosts(posts: BlogPostData[]): string[] {
  const seen = new Set<string>();
  for (const p of posts) {
    for (const b of p.books) {
      const u = b.bookUrl.trim();
      if (u) seen.add(u);
    }
  }
  return [...seen];
}

async function fetchBookDetailsByUrl(
  urls: readonly string[],
): Promise<Map<string, BookPageMeta>> {
  const map = new Map<string, BookPageMeta>();
  const n = urls.length;
  if (n === 0) return map;

  const conc = Math.min(BOOK_PAGE_CONCURRENCY, n);
  let next = 0;
  let finished = 0;

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= n) break;
      const url = urls[i]!;
      try {
        const html = await fetchText(url);
        map.set(url, parseBookDetailHtml(html));
      } catch (e) {
        log(
          `book detail ${i + 1}/${n} failed: ${truncate(url, 56)} — ${String(e)}`,
        );
        map.set(url, { pageCount: null, genres: [] });
      }
      finished++;
      if (finished % 40 === 0 || finished === n) {
        log(`book detail pages ${finished}/${n}`);
      }
      await sleep(40);
    }
  };

  log(
    `fetching ${n} book detail page(s) (${conc} concurrent) for page count + top ${TOP_GENRE_COUNT} genres…`,
  );
  await Promise.all(Array.from({ length: conc }, () => worker()));
  return map;
}

function applyBookDetails(
  posts: BlogPostData[],
  details: Map<string, BookPageMeta>,
): void {
  for (const p of posts) {
    for (const b of p.books) {
      const u = b.bookUrl.trim();
      const meta = u ? details.get(u) : undefined;
      b.pageCount = meta?.pageCount ?? null;
      b.genres = meta?.genres?.length ? [...meta.genres] : [];
    }
  }
}

type BatchProgress = {
  postIndex: number;
  postTotal: number;
  postTitle: string;
  pageUrl: string;
};

async function booksForPost(
  resources: BookResource[],
  progress?: BatchProgress,
): Promise<BookRow[]> {
  const rows: BookRow[] = [];
  const n = resources.length;
  const totalBatches = n === 0 ? 0 : Math.ceil(n / TOOLTIP_BATCH);
  const referer = progress?.pageUrl ?? `${GOODREADS_ORIGIN}/`;
  if (n === 0 && progress) {
    log(
      `tooltips ${progress.postIndex}/${progress.postTotal}: no book ids (skip) — ${truncate(progress.postTitle, 48)}`,
    );
  }
  for (let i = 0; i < resources.length; i += TOOLTIP_BATCH) {
    const batch = resources.slice(i, i + TOOLTIP_BATCH);
    const batchIndex = Math.floor(i / TOOLTIP_BATCH) + 1;
    const qs = tooltipParamsForBatch(batch);
    const queryBytes = Buffer.byteLength(qs, "utf8");
    const url = `${GOODREADS_ORIGIN}/tooltips?${qs}`;
    if (progress && totalBatches > 0) {
      log(
        `tooltips ${progress.postIndex}/${progress.postTotal} batch ${batchIndex}/${totalBatches}: ` +
          `${batch.length} ids, ${rows.length}/${n} rows parsed — ${truncate(progress.postTitle, 40)}`,
      );
      log(
        `  → GET /tooltips (${queryBytes} B query, ~${Math.round(queryBytes / 1024)} KiB)…`,
      );
    }
    const t0 = Date.now();
    const { tooltips } = await fetchTooltipsUrl(url, referer);
    if (progress && totalBatches > 0) {
      log(
        `  ← /tooltips ${Date.now() - t0}ms, ${Object.keys(tooltips).length} tooltip key(s)`,
      );
    }
    let missed = 0;
    for (const r of batch) {
      const key = `${r.type}.${r.id}`;
      const frag = tooltips[key];
      if (!frag) {
        missed++;
        continue;
      }
      rows.push(parseTooltipFragment(frag));
    }
    if (progress && missed > 0) {
      log(`  (${missed} id(s) missing from /tooltips response in this batch)`);
    }
    await sleep(350);
  }
  return rows;
}

export async function build(): Promise<SiteData> {
  const postTotal = EDITORIAL_POSTS.length;
  log(`using ${postTotal} curated editorial post(s)`);
  EDITORIAL_POSTS.forEach((e, i) =>
    log(`  ${i + 1}. [${e.label}] ${GOODREADS_ORIGIN}${e.path}`),
  );

  const posts: BlogPostData[] = [];

  for (let pi = 0; pi < EDITORIAL_POSTS.length; pi++) {
    const { path, label } = EDITORIAL_POSTS[pi];
    const url = `${GOODREADS_ORIGIN}${path}`;
    log(`post ${pi + 1}/${postTotal} [${label}]: fetching ${url}`);
    const html = await fetchText(url);
    const title = postTitleFromBlogHtml(html);
    const resources = extractBookResources(html);
    log(
      `post ${pi + 1}/${postTotal}: "${truncate(title, 72)}" — ${resources.length} book tooltip(s)`,
    );
    const books = await booksForPost(resources, {
      postIndex: pi + 1,
      postTotal,
      postTitle: title,
      pageUrl: url,
    });
    log(`post ${pi + 1}/${postTotal}: done, ${books.length} book row(s) parsed`);
    posts.push({ url, title, pickerLabel: label, books });
    await sleep(500);
  }

  const detailUrls = uniqueBookUrlsFromPosts(posts);
  const details = await fetchBookDetailsByUrl(detailUrls);
  applyBookDetails(posts, details);

  return {
    scrapedAt: new Date().toISOString(),
    sourceNewsUrl: NEWS_URL_FULL,
    posts,
  };
}

async function main() {
  const data = await build();
  const publicDir = path.join(process.cwd(), "web", "public");
  log("writing web/public/data.json …");
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(
    path.join(publicDir, "data.json"),
    JSON.stringify(data, null, 2),
  );
  log("done. From repo root: npm run build (web only), or npm run scrape:build next time.");
  log(
    "summary:",
    data.posts
      .map((p) => `${p.pickerLabel}: ${p.books.length} books`)
      .join(" | "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
