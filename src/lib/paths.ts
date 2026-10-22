import { site } from '../config/site.ts';

/**
 * The same code builds two copies of the site:
 * - Vercel (ivan-ugrin.vercel.app): files at the root, the API next to the page;
 * - GitHub Pages (misterharryx.github.io/ivan-ugrin): files under /ivan-ugrin/, no server of its own,
 *   so requests and edits go to the Vercel API and land in the same admin panel.
 */
const onPages = import.meta.env.MODE === 'pages';

/** A file from public/ ("/photos/x.webp"), with the folder the site is served from. Full URLs pass as they are. */
export const asset = (path: string) => (path.startsWith('/') && !path.startsWith('//') ? import.meta.env.BASE_URL + path.slice(1) : path);

/** An address on the site with the server: "/api/…" on Vercel, the full Vercel URL on GitHub Pages. */
export const serverUrl = (path: string) => (onPages ? (site.meta.url ?? '') : '') + path;
