import { applyFilter, defaultEdit, type EditRecipe } from './filters';

const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) return imageCache.get(src)!;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { imageCache.delete(src); reject(new Error('Không đọc được ảnh. Hãy thử ảnh khác.')); };
    image.src = src;
  });
  imageCache.set(src, promise);
  if (imageCache.size > 16) imageCache.delete(imageCache.keys().next().value!);
  return promise;
}
export function clearImageCache() { imageCache.clear(); }

export async function renderPhoto(src: string, edit: EditRecipe = defaultEdit, width = 1600) {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(width, image.naturalWidth);
  canvas.height = Math.round(canvas.width * image.naturalHeight / image.naturalWidth);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  applyFilter(ctx, edit);
  return canvas;
}
