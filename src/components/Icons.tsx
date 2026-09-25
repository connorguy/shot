// Small line icons (16px, 1.5 stroke) and the Shot mark.

/** Shot mark: a dark key with a record dot, in the spirit of hardware transport buttons. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <rect x="0.5" y="0.5" width="21" height="21" rx="5.5" fill="#141413" />
      <circle cx="11" cy="11" r="6.4" fill="none" stroke="#3b3b39" strokeWidth="1" />
      <circle cx="11" cy="11" r="3.9" fill="#f2541b" />
    </svg>
  );
}

const paths: Record<string, string> = {
  start: "M4 3v10M13 3.5L6.5 8 13 12.5z",
  end: "M12 3v10M3 3.5L9.5 8 3 12.5z",
  prev: "M11 3.5L5 8l6 4.5",
  next: "M5 3.5L11 8l-6 4.5",
  play: "M5 3v10l8-5z",
  pause: "M5 3.5v9M11 3.5v9",
  loop: "M3 7.5a4 4 0 0 1 4-4h5.5M10.5 1.5l2 2-2 2M13 8.5a4 4 0 0 1-4 4H3.5M5.5 14.5l-2-2 2-2",
  pencil: "M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3",
  folder: "M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.5 1.5h5A1.5 1.5 0 0 1 14 6v5.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z",
  copy: "M5.5 5.5h7v7h-7zM3.5 10.5v-7h7",
  chevron: "M4.5 6.5L8 10l3.5-3.5",
  expand: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10",
  shrink: "M6 2.5V6H2.5M10 2.5V6h3.5M13.5 10H10v3.5M2.5 10H6v3.5",
  panelLeft: "M2.5 3h11v10h-11zM6.5 3v10",
  panelRight: "M2.5 3h11v10h-11zM9.5 3v10",
};

export function Icon({ name, size = 16 }: { name: keyof typeof paths | string; size?: number }) {
  const filled = name === "play";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}
