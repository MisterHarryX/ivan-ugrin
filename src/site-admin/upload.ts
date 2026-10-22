/**
 * Shrinks a photo in the browser before upload (longest side ≤ 2400px, WebP or JPEG),
 * from ICG. Keeps uploads small and under hosting body limits; returns the original
 * file when it is already small or the browser cannot decode it.
 */
async function shrinkImage(file: File, maxSide = 2400): Promise<File> {
  if (typeof createImageBitmap !== 'function' || file.type === 'image/gif') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.2 * 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.84));
  // Safari before 17 cannot encode WebP and silently returns PNG; use JPEG there.
  let blob = await encode('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg');
  if (!blob || blob.size >= file.size) return file;
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${ext}`, { type: blob.type });
}

const ERRORS: Record<string, string> = {
  size: 'Файл слишком большой — даже после сжатия больше 4 МБ.',
  type: 'Нужна картинка JPG, PNG, WebP, AVIF или GIF.',
  'storage-unavailable': 'Хранилище для фото не подключено. В «Настройках» панели написано, как его включить.',
  unauthorized: 'Сессия закончилась — войдите снова.',
};

/** Uploads a photo and returns its URL. */
export async function uploadPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', await shrinkImage(file));
  const response = await fetch('/api/admin/upload', { method: 'POST', body: form });
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !body.url) throw new Error(ERRORS[body.error ?? ''] ?? 'Не удалось загрузить фото. Попробуйте ещё раз.');
  return body.url;
}

/** Opens the system file picker for one image. */
export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/avif,image/gif' });
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}
