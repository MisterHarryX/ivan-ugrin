import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface BookingState {
  serviceId: string | null;
  setServiceId: (id: string | null) => void;
  /** Selects a service (optional) and moves the visitor to the booking section. */
  requestBooking: (serviceId?: string) => void;
}

const BookingContext = createContext<BookingState | null>(null);

export const BOOKING_ID = 'booking';

export function BookingProvider({ children }: { children: ReactNode }) {
  const [serviceId, setServiceId] = useState<string | null>(null);

  const requestBooking = useCallback((id?: string) => {
    if (id) setServiceId(id);
    const target = document.getElementById(BOOKING_ID);
    if (!target) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    history.replaceState(null, '', `#${BOOKING_ID}`);
    // Move focus to the heading so keyboard and screen-reader users land in the section.
    document.getElementById(`${BOOKING_ID}-title`)?.focus({ preventScroll: true });
  }, []);

  const value = useMemo(() => ({ serviceId, setServiceId, requestBooking }), [serviceId, requestBooking]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingState {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used inside BookingProvider');
  return ctx;
}
