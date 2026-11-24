const PATHS = {
  back: "M15 5l-7 7 7 7",
  chevron: "M9 5l7 7-7 7",
  down: "M6 9l6 6 6-6",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l5 5 9-10",
  home: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5",
  moves: "M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4",
  target:
    "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2",
  spark:
    "M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8zM19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z",
  settings: "M4 7h9M17 7h3M15 5a2 2 0 1 0 0 4a2 2 0 1 0 0-4M4 17h3M11 17h9M9 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4",
  pencil: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  camera:
    "M3 10a3 3 0 0 1 3-3h1l2-3h6l2 3h1a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  eyeOff:
    "M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6C3.9 9.3 2 12 2 12s3.5 6 10 6a10 10 0 0 0 4.1-.9",
  bank: "M3 6h18v13H3zM3 10h18M7 15h3",
  cart: "M3 4h2l2.4 11h11L21 7H6M9 18.2a1.4 1.4 0 1 0 0 2.8a1.4 1.4 0 1 0 0-2.8M18 18.2a1.4 1.4 0 1 0 0 2.8a1.4 1.4 0 1 0 0-2.8",
  cash: "M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5",
  piggy: "M5 11a7 7 0 0 1 14 0v6H5zM9 17v3M15 17v3",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  bolt: "M13 3L5 14h6l-1 7 8-11h-6z",
  clock: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 8v4l3 2",
  warning: "M12 4l9 16H3zM12 10v4M12 17v.5",
  lock: "M7 11h10a2 2 0 0 1 2 2v7H5v-7a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4",
  mail: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 7l9 6 9-6",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  home2: "M3 11l9-7 9 7M5 10v10h14V10",
  backspace: "M9 5h11v14H9l-6-7zM12 9l5 6M17 9l-5 6",
  faceid:
    "M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 15.5a3.5 3.5 0 0 0 5 0",
  image:
    "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9 9.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3M21 16l-5-5-8 8",
  car: "M5 17h14l-1.5-6h-11zM7 11l1-3h8l1 3M8 17.5v1.5M16 17.5v1.5",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.500-7 10-7 10z",
  bag: "M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0",
  dots: "M6 12h.5M12 12h.5M18 12h.5",
  repeat:
    "M4 12a8 8 0 0 1 13.500-5.800L20 8.500M20 4v4.500h-4.500M20 12a8 8 0 0 1-13.500 5.800L4 15.500M4 20v-4.500h4.500",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`b-icon${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={size ? { width: size, height: size } : undefined}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
