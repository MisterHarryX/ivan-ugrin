import { handle } from '../server/router.js';

/**
 * The single Vercel Function behind /api/*. vercel.json rewrites every API path here
 * with the original path in `?route=`, so routing lives in one file (server/router.ts).
 */
function dispatch(request: Request) {
  const url = new URL(request.url);
  const route = url.searchParams.get('route') ?? url.pathname.replace(/^\/api\/?/, '');
  return handle(request, route);
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
export const OPTIONS = dispatch;
