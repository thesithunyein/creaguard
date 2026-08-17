import type { ReactNode, SVGProps } from "react";

const PATHS: Record<string, ReactNode> = {
  "home": (
    <>
      <path d="M3 9.5 12 3l9 6.5V21h-6v-6h-6v6H3z" />
    </>
  ),
  "inbox": (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5h13l3.5 7v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7z" />
    </>
  ),
  "shield": (
    <>
      <path d="M12 2l8 3.5V11c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5.5z" />
    </>
  ),
  "alert-triangle": (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  "check-circle": (
    <>
      <path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  "check": (
    <>
      <path d="M20 6 9 17l-5-5" />
    </>
  ),
  "clock": (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  "trending-up": (
    <>
      <path d="M22 7l-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </>
  ),
  "sparkles": (
    <>
      <path d="M12 3l1.9 5.7L19.6 10l-5.7 1.9L12 17.6l-1.9-5.7L4.4 10l5.7-1.3z" />
      <path d="M19 15l.7 2.1L21.8 18l-2.1.7L19 21l-.7-2.3L16.2 18l2.1-.9z" />
    </>
  ),
  "message-circle": (
    <>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z" />
    </>
  ),
  "message-square": (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
  "lock": (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  "eye": (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a16.9 16.9 0 0 1-3.2 4.1" />
      <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
      <path d="M4.2 9.9A16.9 16.9 0 0 0 2 12s3.5 8 10 8a9.1 9.1 0 0 0 2.1-.2" />
      <path d="M3 3l18 18" />
    </>
  ),
  "user-x": (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <path d="M18 8l4 4" />
      <path d="M22 8l-4 4" />
    </>
  ),
  "flag": (
    <>
      <path d="M4 22V4a8 8 0 0 1 8-4h4l-3 4 3 4h-4a4 4 0 0 1-4-4" />
    </>
  ),
  "dollar-sign": (
    <>
      <path d="M12 2v20" />
      <path d="M17 6.5C17 4.5 14.5 3 12 3S7 4.5 7 6.5 9 9.5 12 10s5 1.5 5 3.5S14.5 17 12 17s-5-1.5-5-3.5" />
    </>
  ),
  "circle": (
    <>
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  "gear": (
    <>
      <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.3.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.2a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.3.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.3-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.2a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.3-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "bell": (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  "search": (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  "chevron-down": (
    <>
      <path d="M6 9l6 6 6-6" />
    </>
  ),
  "chevron-right": (
    <>
      <path d="M9 6l6 6-6 6" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  "x": (
    <>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  "plus": (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  "send": (
    <>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </>
  ),
  "book": (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  "refresh": (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
  "users": (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  strokeWidth = 2,
  ...rest
}: { name: string; size?: number; strokeWidth?: number } & Omit<
  SVGProps<SVGSVGElement>,
  "name"
>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name] ?? PATHS.circle}
    </svg>
  );
}
