import { applyFilter } from './filters';
import { coverRect, getGeometry, type Layout, type FrameOptions, type Photo } from './layouts';
import { paintFrame } from './frameRenderer';
import { loadImage, renderPhoto } from './renderPhoto';
export { loadImage } from './renderPhoto';

export function captureImage(source: HTMLVideoElement | HTMLImageElement, filter = 'normal', mirror = false) {
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!sw || !sh) throw new Error('Camera chưa sẵn sàng. Hãy chờ rồi chụp lại.');
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 1200;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const crop = coverRect(sw, sh, canvas.width, canvas.height);
  ctx.save();
  if (mirror) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  if (filter !== 'normal') applyFilter(ctx, filter);
  return canvas.toDataURL('image/jpeg', .96);
}
export function validateUpload(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 15 MB.');
  if (!file.size) throw new Error('Tệp ảnh trống. Hãy chọn một ảnh khác.');
}
export async function readUpload(file: File) {
  validateUpload(file);
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (image.naturalWidth * image.naturalHeight > 60_000_000) throw new Error('Hãy chọn ảnh dưới 60 megapixel.');
    return captureImage(image);
  } finally { URL.revokeObjectURL(url); }
}
export async function composeFrame(layout: Layout, photos: (Photo | null)[], options: FrameOptions, longEdge = 2400): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const images: (HTMLCanvasElement | null)[] = [];
  for (const photo of photos.slice(0, layout.count)) images.push(photo ? await renderPhoto(photo.originalSrc, photo.edit, longEdge < 1000 ? 500 : 1600) : null);
  const geometry = getGeometry(layout);
  const scale = longEdge / Math.max(geometry.width, geometry.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(geometry.width * scale); canvas.height = Math.round(geometry.height * scale);
  paintFrame(canvas.getContext('2d')!, layout, images, options, longEdge);
  return canvas;
}
export function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không xuất được ảnh. Vui lòng thử lại.')), 'image/png'));
}
export function downloadName(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return 'PhotoBeo-' + date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + '-' + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds()) + '.png';
}

