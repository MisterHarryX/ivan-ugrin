import type { ReactNode } from 'react';

interface SectionHeadingProps {
  id: string;
  title: string;
  lead?: string;
  children?: ReactNode;
  /** Allows programmatic focus when the section is reached via a booking action. */
  focusable?: boolean;
  className?: string;
}

export function SectionHeading({ id, title, lead, children, focusable, className = '' }: SectionHeadingProps) {
  return (
    <header className={`section-heading ${className}`}>
      <h2 id={id} className="section-title" tabIndex={focusable ? -1 : undefined}>
        {title}
      </h2>
      {lead && <p className="section-lead">{lead}</p>}
      {children}
    </header>
  );
}
