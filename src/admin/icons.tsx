/** Line icons drawn for the panel, in the site's engraving stroke. */
const PATHS = {
  requests: 'M4 6.5h16M4 12h16M4 17.5h10M18 16l2 2 3-4',
  schedule: 'M4 7h16v13H4ZM4 11h16M8 4v5M16 4v5M8 15h2M12 15h2M16 15h2',
  archive: 'M3.5 5h17v4h-17ZM5 9v10h14V9M10 13h4',
  stats: 'M4 20V10M10 20V5M16 20v-7M21 20H3',
  content: 'M5 19l1-4 10-10 3 3-10 10-4 1ZM14 7l3 3',
  settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  phone: 'M6.5 4h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z',
  copy: 'M9 9h10v11H9ZM5 15V4h10',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 7.5V12l3 2',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  logout: 'M10 4H4v16h6M15 8l4 4-4 4M19 12H9',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM20 20l-4.8-4.8',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20.5h4',
  moon: 'M15 3.5a8.5 8.5 0 1 0 5.5 14.9A7 7 0 1 1 15 3.5Z',
} as const;

export type IconName = keyof typeof PATHS;

export function AdminIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="a-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
