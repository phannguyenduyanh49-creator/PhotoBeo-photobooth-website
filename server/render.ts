import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import sharp from 'sharp';
import { resolve } from 'node:path';
import { filters, transformPixels } from '../src/lib/filters';
import { getGeometry, layouts, type FrameOptions } from '../src/lib/layouts';
import { paintFrame } from '../src/lib/frameRenderer';
import type { registrationSchema } from './schema';
import type { z } from 'zod';

for (const weight of [400, 600, 700]) for (const subset of ['latin', 'vietnamese']) {
  GlobalFonts.registerFromPath(resolve(`node_modules/@fontsource/nunito/files/nunito-${subset}-${weight}-normal.woff2`), 'Nunito');
}
GlobalFonts.registerFromPath(resolve('node_modules/@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff2'), 'Dancing Script');
sharp.cache({ memory: 32, files: 0, items: 10 }); sharp.concurrency(1);

export async function renderRegisteredPhoto(input: z.infer<typeof registrationSchema>, createdAt: string) {
  const images = [];
  for (const photo of input.photos) {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo.originalSrc);
    if (!match) throw new Error('Ảnh nguồn phải là JPEG, PNG hoặc WebP hợp lệ.');
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length < 16 || bytes.length > 4 * 1024 * 1024) throw new Error('Ảnh nguồn vượt giới hạn 4 MB.');
    const metadata = await sharp(bytes, { limitInputPixels: 12_000_000, failOn: 'warning' }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Chỉ nhận ảnh tĩnh JPEG, PNG hoặc WebP.');
    if (metadata.format !== match[1]) throw new Error('Nội dung ảnh không khớp định dạng.');
    if (!metadata.width || !metadata.height || metadata.width < 64 || metadata.height < 64) throw new Error('Ảnh nguồn quá nhỏ hoặc hỏng.');
    // Decode and re-encode: strip EXIF, reject spoofed file bytes, constrain pixel memory.
    const clean = await sharp(bytes, { limitInputPixels: 12_000_000, failOn: 'warning' }).rotate().resize(1600, 1200, { fit: 'cover' }).png().toBuffer();
    const image = await loadImage(clean);
    const canvas = createCanvas(1600, 1200), ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, 1600, 1200);
    const pixels = ctx.getImageData(0, 0, 1600, 1200);
    if (!filters.some(f => f.id === photo.edit.filterId)) throw new Error('Bộ lọc không hợp lệ.');
    transformPixels(pixels.data, 1600, 1200, photo.edit); ctx.putImageData(pixels, 0, 0);
    images.push(canvas);
  }
  const layout = layouts.find(l => l.id === input.layoutId)!;
  const geometry = getGeometry(layout), scale = 2400 / Math.max(geometry.width, geometry.height);
  const canvas = createCanvas(Math.round(geometry.width * scale), Math.round(geometry.height * scale));
  paintFrame(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, layout,
    images as unknown as HTMLCanvasElement[], { ...input.options, date: new Date(createdAt) } as FrameOptions);
  return { png: await canvas.encode('png'), width: canvas.width, height: canvas.height };
}
