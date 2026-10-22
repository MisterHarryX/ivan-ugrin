import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ContentOverrides } from '../shared/content.ts';

/** Integration checks only against this template's local development server. */
const base = process.env.TEST_URL || 'http://127.0.0.1:5175';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Tests must target localhost.');
const password = /^ADMIN_PASSWORD=(.+)$/m.exec(await readFile(resolve('.env.local'), 'utf8'))?.[1].trim();
assert.ok(password, 'Set ADMIN_PASSWORD in .env.local.');
let cookies = '';
async function request(route: string, method = 'GET', body?: unknown, admin = false) {
  return fetch(`${base}/api/${route}`, { method, headers: { Origin: base, ...(admin ? { Cookie: cookies } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
}
assert.equal((await request('admin/requests')).status, 401);
assert.equal((await request('admin/content', 'PUT', {})).status, 401);
assert.equal((await request('requests', 'POST', { name: 'Test', phone: 'abc' })).status, 422);
assert.equal((await fetch(`${base}/api/requests`, { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
const login = await request('admin/login', 'POST', { password });
assert.equal(login.status, 200);
cookies = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
assert.ok(cookies.includes('ugrin_admin='));
const original = await (await request('admin/content', 'GET', undefined, true)).json() as ContentOverrides;
let id: string | undefined;
let uploaded: string | undefined;
try {
  assert.equal((await (await request('admin/status', 'GET', undefined, true)).json()).backend, 'files');
  const availability = await (await request('availability')).json();
  assert.ok(availability.tz && availability.hours && Array.isArray(availability.busy));
  const created = await request('requests', 'POST', { name: 'API flow test', phone: '+79990000001', serviceId: 'online', serviceTitle: 'Онлайн-консультация', durationMin: 55, contactPref: 'telegram' });
  assert.equal(created.status, 201);
  id = (await created.json()).id;
  assert.ok(id);
  const list = await (await request('admin/requests', 'GET', undefined, true)).json();
  assert.ok(list.items.some((r: { id: string }) => r.id === id));
  const scheduledAt = Date.now() + 2 * 86400000;
  assert.equal((await request(`admin/requests/${id}`, 'PATCH', { status: 'scheduled', scheduledAt, durationMin: 55 }, true)).status, 200);
  assert.ok((await (await request('availability')).json()).busy.some((r: { start: number }) => r.start === scheduledAt));
  const draft = { ...original, texts: { ...original.texts, 'hero.accent': 'Integration check', '__proto__.oops': 'rejected' }, design: { sections: { ...original.design.sections, project: false }, theme: { ...original.design.theme, gold: '#ccbbaa', background: 'bad-css' } } };
  assert.equal((await request('admin/content', 'PUT', draft, true)).status, 200);
  const published = await (await request('content')).json();
  assert.equal(published.texts['hero.accent'], 'Integration check');
  assert.equal(published.texts['__proto__.oops'], undefined);
  assert.equal(published.design.sections.project, false);
  assert.equal(published.design.theme.gold, '#ccbbaa');
  assert.notEqual(published.design.theme.background, 'bad-css');
  const form = new FormData();
  form.set('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6FDcAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'check.png');
  const upload = await fetch(`${base}/api/admin/upload`, { method: 'POST', headers: { Origin: base, Cookie: cookies }, body: form });
  assert.equal(upload.status, 201);
  uploaded = (await upload.json()).url;
  assert.ok(uploaded?.startsWith('/api/media/'));
  assert.equal((await fetch(base + uploaded)).headers.get('content-type'), 'image/png');
  assert.equal((await request('admin/stats?range=7d', 'GET', undefined, true)).status, 200);
  assert.equal((await request('admin/export', 'GET', undefined, true)).status, 200);
  console.log('PASS: auth, protected routes, cross-origin rejection, form validation, persistent requests, scheduling, occupied slots, content edits, section switches, palette validation, image upload, statistics and export.');
} finally {
  assert.equal((await request('admin/content', 'PUT', original, true)).status, 200);
  // Restore exact isolated local state after exercising merge-based design updates.
  await writeFile(resolve('.data/content.json'), JSON.stringify(original, null, 2));
  if (id) assert.equal((await request(`admin/requests/${id}`, 'DELETE', undefined, true)).status, 200);
  if (uploaded) await unlink(resolve('.data/media', uploaded.split('/').pop()!));
  await request('admin/logout', 'POST', undefined, true);
}
