import type { ReactNode } from "react";

const paths = {
  home: <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-6h6v6"/></>,
  dumbbell: <><rect x="4" y="7" width="4" height="10" rx="1"/><rect x="16" y="7" width="4" height="10" rx="1"/><path d="M8 12h8M2 10v4m20-4v4"/></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18m-6 6h3"/></>,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
  moon: <path d="M20.2 15.5A9 9 0 0 1 8.5 3.8 9 9 0 1 0 20.2 15.5Z"/>,
  monitor: <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8m-4-4v4"/></>,
  "log-out": <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M10 12h11m-4-4 4 4-4 4"/></>,
  arrow: <path d="m9 5 7 7-7 7"/>,
} satisfies Record<string, ReactNode>;

export type StudentIconName = keyof typeof paths;

export function StudentIcon({ name }: { name: StudentIconName }) {
  return (
    <svg className="student-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
