/**
 * The same code builds two copies of the site:
 * - GitHub Pages (ivanugrinpsru.ru, the main address): static files only. It is served from GitHub
 *   because Russian mobile networks cut connections to Vercel; requests and edits go to the Vercel API.
 * - Vercel (ivan-ugrin.vercel.app): the API, the admin panel and the live editor, plus the same page.
 */
const onPages = import.meta.env.MODE === 'pages';

/** Where the API, the admin panel and the editor live. */
export const API_ORIGIN = 'https://ivan-ugrin.vercel.app';

/** A file from public/ ("/photos/x.webp"), with the folder the site is served from. Full URLs pass as they are. */
export const asset = (path: string) => (path.startsWith('/') && !path.startsWith('//') ? import.meta.env.BASE_URL + path.slice(1) : path);

/** An address on the server: "/api/…" on Vercel, the full Vercel URL on GitHub Pages. */
export const serverUrl = (path: string) => (onPages ? API_ORIGIN : '') + path;
