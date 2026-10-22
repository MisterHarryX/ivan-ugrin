import type { MouseEvent, ReactNode } from 'react';
import { BOOKING_ID, useBooking } from '../../lib/BookingContext.tsx';

interface BookingLinkProps {
  children: ReactNode;
  serviceId?: string;
  variant?: 'primary' | 'secondary' | 'link';
  className?: string;
  ariaLabel?: string;
  onNavigate?: () => void;
}

/**
 * Link to the booking section. Works as a plain anchor without JavaScript;
 * when hydrated it also preselects a service and moves focus.
 */
export function BookingLink({ children, serviceId, variant = 'primary', className = '', ariaLabel, onNavigate }: BookingLinkProps) {
  const { requestBooking } = useBooking();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate?.();
    requestBooking(serviceId);
  };
  const base = variant === 'link' ? 'text-link' : `btn btn--${variant}`;
  return (
    <a href={`#${BOOKING_ID}`} className={`${base} ${className}`} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
