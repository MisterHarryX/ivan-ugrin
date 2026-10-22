import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { site } from './src/config/site.ts';
import { themeToCss } from './src/theme/themeCss.ts';

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PRELOAD_FONTS = [/cormorant-garamond-cyrillic-400-normal-[\w-]+\.woff2$/, /ibm-plex-sans-cyrillic-400-normal-[\w-]+\.woff2$/];

/** Injects metadata and theme tokens from the site config into index.html at build and dev time. */
function siteHead(): Plugin {
  let base = '/';
  return {
    name: 'site-head',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml(html, ctx) {
      const { meta, theme } = site;
      // Preload the Cyrillic faces used above the fold (hero headline and body copy).
      const preloads = Object.keys(ctx.bundle ?? {})
        .filter((file) => PRELOAD_FONTS.some((pattern) => pattern.test(file)))
        .map((file) => `<link rel="preload" href="${base}${file}" as="font" type="font/woff2" crossorigin />`);
      const tags = [
        ...preloads,
        `<title>${escapeHtml(meta.title)}</title>`,
        `<meta name="description" content="${escapeHtml(meta.description)}" />`,
        `<meta name="theme-color" content="${escapeHtml(theme.background)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:locale" content="ru_RU" />`,
        `<meta property="og:site_name" content="${escapeHtml(meta.brand)}" />`,
        `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
        `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
        // Link preview card (Telegram, WhatsApp, VK): 1200×630 JPEG under 300 KB (WhatsApp skips heavier ones).
        meta.url ? `<meta property="og:image" content="${escapeHtml(meta.url)}/og-ivan.jpg" />` : '',
        meta.url ? `<meta property="og:image:secure_url" content="${escapeHtml(meta.url)}/og-ivan.jpg" />` : '',
        `<meta property="og:image:type" content="image/jpeg" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:image:alt" content="${escapeHtml(`${meta.brand} — интегральный психолог. Жизнь не против вас — она за вас.`)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
        `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
        meta.url ? `<meta name="twitter:image" content="${escapeHtml(meta.url)}/og-ivan.jpg" />` : '',
        meta.url ? `<link rel="canonical" href="${escapeHtml(meta.url)}" />` : '',
        meta.url ? `<meta property="og:url" content="${escapeHtml(meta.url)}" />` : '',
        // Draft builds must not be indexed by search engines.
        meta.status === 'draft' ? `<meta name="robots" content="noindex, nofollow" />` : '',
        `<style id="theme-tokens">${themeToCss(theme)}</style>`,
      ].filter(Boolean);
      return html.replace('<!-- site:head -->', tags.join('\n    '));
    },
  };
}

type Router = { handle: (request: Request, route: string) => Promise<Response> };

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((done, fail) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => done(Buffer.concat(chunks)));
    req.on('error', fail);
  });
}

/**
 * Runs the API (server/router.ts, the same code as the Vercel Function) inside the
 * dev and preview servers, and serves the panel at /admin like vercel.json does.
 */
function api(): Plugin {
  const middleware =
    (load: () => Promise<Router>): Connect.NextHandleFunction =>
    async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
      const url = req.url ?? '/';
      if (/^\/admin\/?(\?|$)/.test(url)) {
        req.url = `/admin.html${url.includes('?') ? url.slice(url.indexOf('?')) : ''}`;
        return next();
      }
      if (!url.startsWith('/api/')) return next();
      try {
        const { handle } = await load();
        const origin = `http://${req.headers.host ?? 'localhost'}`;
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
        if (!headers.has('x-real-ip') && req.socket.remoteAddress) headers.set('x-real-ip', req.socket.remoteAddress);
        const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
        const request = new Request(origin + url, { method: req.method, headers, body: hasBody ? new Uint8Array(await readBody(req)) : undefined });
        const response = await handle(request, new URL(origin + url).pathname.replace(/^\/api\//, ''));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => key !== 'set-cookie' && res.setHeader(key, value));
        const cookies = response.headers.getSetCookie();
        if (cookies.length) res.setHeader('Set-Cookie', cookies);
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (cause) {
        next(cause);
      }
    };

  return {
    name: 'ugrin-api',
    config(_config, { mode }) {
      // Server code reads process.env; values already set in the shell win over .env files.
      for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[key] ??= value;
    },
    configureServer(server) {
      server.middlewares.use(middleware(() => server.ssrLoadModule('/server/router.ts') as Promise<Router>));
    },
    configurePreviewServer(server) {
      // No module graph in preview: a small Vite instance compiles the server code on demand.
      let loader: Promise<Router> | null = null;
      const load = () =>
        (loader ??= import('vite')
          .then(({ createServer }) => createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false } }))
          .then((vite) => vite.ssrLoadModule('/server/router.ts') as Promise<Router>));
      server.middlewares.use(middleware(load));
    },
  };
}

// Prefixes and fallbacks for the phones people really carry: iOS Safari 15+, Android Chrome 90+, Samsung Internet 15+.
const v = (major: number) => major << 16;
const targets = { safari: v(15), ios_saf: v(15), chrome: v(90), android: v(90), firefox: v(90), samsung: v(15), edge: v(90) };

export default defineConfig({
  plugins: [react(), siteHead(), api()],
  css: { transformer: 'lightningcss', lightningcss: { targets } },
  build: {
    cssMinify: 'lightningcss',
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), admin: resolve(import.meta.dirname, 'admin.html') },
    },
  },
});
