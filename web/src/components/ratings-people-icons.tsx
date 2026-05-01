import { cn } from "@/lib/utils";

/** Low end of log scale — hundreds-tier maps to one icon. */
const ICON_SCALE_MIN = 100;
/** High end — multi-millions maps to five icons. */
const ICON_SCALE_MAX = 4_000_000;

const PEOPLE_VIEWBOX = "0 0 256 256";

/** Map count to 1–5 icons: log10 between 100 and 4M. */
export function ratingsToPeopleIconCount(count: number): number {
  if (count <= 0) return 0;
  const lo = Math.log10(ICON_SCALE_MIN);
  const hi = Math.log10(ICON_SCALE_MAX);
  const clamped = Math.min(Math.max(count, ICON_SCALE_MIN), ICON_SCALE_MAX);
  const t = (Math.log10(clamped) - lo) / (hi - lo);
  return Math.max(1, Math.min(5, Math.round(1 + t * 4)));
}

function PeopleRatingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={PEOPLE_VIEWBOX}
      className={cn("size-3.5 shrink-0", className)}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M230.93,220a8,8,0,0,1-6.93,4H32a8,8,0,0,1-6.92-12c15.23-26.33,38.7-45.21,66.09-54.16a72,72,0,1,1,73.66,0c27.39,8.95,50.86,27.83,66.09,54.16A8,8,0,0,1,230.93,220Z"
      />
    </svg>
  );
}

type RatingsPeopleIconsProps = {
  count: number;
};

/** Log-scale crowd icons (1–5) plus exact rating count. */
export function RatingsPeopleIcons({ count }: RatingsPeopleIconsProps) {
  const n = ratingsToPeopleIconCount(count);
  const label = `${count.toLocaleString()} ratings`;

  return (
    <div
      className="flex min-w-[8.5rem] max-w-[13rem] flex-col items-end gap-0.5"
      title={label}
    >
      <span className="inline-flex items-center gap-px" aria-label={label}>
        {Array.from({ length: n }, (_, i) => (
          <PeopleRatingsIcon key={i} className="text-foreground" />
        ))}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {count.toLocaleString()}
      </span>
    </div>
  );
}
