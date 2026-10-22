import type { ContactKind } from '../../config/types.ts';

type IconName = ContactKind | 'copy';

const paths: Record<IconName, string> = {
  copy: 'M9 9h10v10H9zM5 15V5h10',
  telegram: 'M21 4 3 11l6 2 2 6 3-4 5 4 2-15ZM9 13l9-6-6.5 7.5',
  max: 'M12 3.5a8.5 8.5 0 0 0-7.4 12.7L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5ZM8.2 15V9.4l3.8 3.4 3.8-3.4V15',
  booking: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5',
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
