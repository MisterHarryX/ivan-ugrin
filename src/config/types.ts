export interface ThemeColors { background: string; surface: string; amethyst: string; rose: string; gold: string; ivory: string }
export interface Price { amount: number; currency: string; prefix?: string }
export type ContactKind = 'telegram' | 'max' | 'booking';
export interface ContactMethod { kind: ContactKind; value: string; label?: string; hint?: string; sample?: boolean }
export interface SectionCopy { title: string; lead?: string }
export interface Service { id: string; title: string; summary: string; duration: string; minutes?: number; format: string; price: Price; badge?: string; sample?: boolean }
export interface Review { name: string; date: string; text: string; context?: string; tags: string[]; highlight?: string }
export interface Video { id: string; title: string; kind: string; date: string }
export interface SiteConfig {
  meta: {
    status: 'draft' | 'published'; title: string; description: string; url?: string; brand: string; tagline: string;
    /** Link preview card in messengers (og:title / og:description); falls back to title and description. */
    share?: { title: string; description: string };
  };
  theme: ThemeColors;
  sections: { about: boolean; topics: boolean; principles: boolean; method: boolean; gallery: boolean; services: boolean; process: boolean; reviews: boolean; reflection: boolean; location: boolean; project: boolean; faq: boolean };
  hero: { headline: string; accent: string; accents: string[]; lead: string; primaryAction: string; secondaryAction: string; note: string; imageAlt: string; ring: string; paper: { text: string; accent: string; small: string }; facts: { value: number; before: string; after: string }[]; formats: { title: string; place?: string; lines: string[]; accent?: string; href: string }[] };
  practitioner: { name: string; role: string; portrait: { src: string | null; alt: string }; aboutTitle: string; intro: string[]; quote: string; approach: { lead: string; text: string }[]; credentials: { label: string; value: string }[]; sample: boolean };
  topics: SectionCopy & { items: { id: string; title: string; text: string; detail: string; prompt: string }[]; closingNote: string };
  principles: SectionCopy & { items: { title: string; text: string }[] };
  method: SectionCopy & {
    name: string; subtitle: string; intro: string;
    circle: { id: string; label: string; entry: string; text: string }[];
    stages: { title: string; short: string; text: string; question: string }[];
    tools: { title: string; text: string }[];
  };
  gallery: SectionCopy & { caption: string };
  services: SectionCopy & { items: Service[]; note: string; group: { title: string; text: string; meta: string }; formats: { id: string; title: string; place: string; summary: string; options: { id: string; label: string }[]; badge?: string }[]; packages: { title: string; saving: string; text: string; rows: { title: string; online: number; office: number }[] } };
  process: SectionCopy & { steps: { title: string; text: string; note: string }[] };
  reviews: SectionCopy & { source: string; url: string; total: string; topics: string[]; facts: { value: number; label: string; suffix?: string }[]; award: string; items: Review[] };
  reflection: SectionCopy & { disclaimer: string; options: { label: string; title: string; text: string; question: string }[]; breathe: SectionCopy & { note: string } };
  location: SectionCopy & { places: { id: string; metro: string; line: string; lines: { name: string; color: string }[]; lat: number; lon: number; text: string }[]; online: string; note: string };
  project: SectionCopy & { name: string; motto: string; channels: { kind: 'telegram' | 'dzen' | 'youtube'; label: string; url: string; hint: string }[]; videos: Video[] };
  faq: SectionCopy & { items: { tag?: string; question: string; answer: string }[] };
  booking: SectionCopy & { greeting: string; privacyNote: string };
  contacts: ContactMethod[];
  footer: { quote: string; author: string; note: string };
}
