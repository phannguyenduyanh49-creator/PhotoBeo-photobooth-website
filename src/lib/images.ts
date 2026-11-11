import { applyFilter } from './filters';
import { coverRect, getGeometry, type Layout, type FrameOptions, type Photo } from './layouts';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được ảnh. Hãy thử một ảnh khác.'));
    img.src = src;
  });
}

export function captureImage(source: HTMLVideoElement | HTMLImageElement, filter: string, mirror = false) {
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!sw || !sh) throw new Error('Camera chưa sẵn sàng. Hãy chờ một chút rồi chụp lại.');
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 1200;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const crop = coverRect(sw, sh, canvas.width, canvas.height);
  ctx.save();
  if (mirror) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  applyFilter(ctx, filter);
  return canvas.toDataURL('image/jpeg', .94);
}

export function validateUpload(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 15 MB.');
  if (!file.size) throw new Error('Tệp ảnh trống. Hãy chọn một ảnh khác.');
}

export async function readUpload(file: File, filter: string) {
  validateUpload(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (img.naturalWidth * img.naturalHeight > 60_000_000) throw new Error('Ảnh có độ phân giải quá lớn. Hãy chọn ảnh dưới 60 megapixel.');
    return captureImage(img, filter);
  } finally { URL.revokeObjectURL(url); }
}

function decorate(ctx: CanvasRenderingContext2D, options: FrameOptions, width: number, height: number, padding: number) {
  ctx.strokeStyle = '#b96d86'; ctx.fillStyle = '#c97792'; ctx.lineWidth = 2.5;
  if (options.frame === 'retro') {
    ctx.strokeStyle = '#957454'; ctx.setLineDash([7, 6]);
    ctx.strokeRect(14, 14, width - 28, height - 28); ctx.setLineDash([]);
  }
  if (options.frame === 'hearts') {
    for (const x of [padding / 2, width - padding / 2]) {
      for (let y = 90; y < height - 100; y += 180) {
        ctx.beginPath(); ctx.moveTo(x, y + 8);
        ctx.bezierCurveTo(x - 30, y - 9, x - 6, y - 24, x, y - 10);
        ctx.bezierCurveTo(x + 6, y - 24, x + 30, y - 9, x, y + 8); ctx.fill();
      }
    }
  }
  if (options.frame === 'bows') {
    for (const x of [padding / 2, width - padding / 2]) {
      const y = 24;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 35, y - 32, x - 35, y + 25, x, y);
      ctx.bezierCurveTo(x + 35, y - 32, x + 35, y + 25, x, y);
      ctx.moveTo(x, y); ctx.lineTo(x - 12, y + 23); ctx.moveTo(x, y); ctx.lineTo(x + 12, y + 23); ctx.stroke();
    }
  }
}

export async function composeFrame(layout: Layout, photos: (Photo | null)[], options: FrameOptions, longEdge = 2400): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const images = await Promise.all(photos.slice(0, layout.count).map(p => p ? loadImage(p.src) : Promise.resolve(null)));
  const geometry = getGeometry(layout);
  const scale = longEdge / Math.max(geometry.width, geometry.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(geometry.width * scale); canvas.height = Math.round(geometry.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale); ctx.fillStyle = options.color;
  ctx.fillRect(0, 0, geometry.width, geometry.height);
  geometry.cells.forEach((cell, i) => {
    const img = images[i];
    if (img) {
      const crop = coverRect(img.naturalWidth, img.naturalHeight, cell.width, cell.height);
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, cell.x, cell.y, cell.width, cell.height);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
      ctx.fillStyle = '#966879'; ctx.font = '600 34px Nunito'; ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, cell.x + cell.width / 2, cell.y + cell.height / 2 + 12);
    }
  });
  decorate(ctx, options, geometry.width, geometry.height, geometry.padding);
  const y = geometry.height - geometry.footer + 12;
  // A translucent plate keeps text legible on custom dark frame colors.
  ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.fillRect(geometry.padding, y - 16, geometry.width - geometry.padding * 2, geometry.footer - 18);
  ctx.textAlign = 'center'; ctx.fillStyle = '#674251';
  ctx.font = '700 42px "Dancing Script"'; ctx.fillText('PhotoBeo', geometry.width / 2, y + 27);
  ctx.font = '600 23px Nunito';
  let caption = options.caption.trim() || 'Lưu chút xinh, giữ chút nhớ';
  while (ctx.measureText(caption).width > geometry.width - geometry.padding * 2 - 36) caption = caption.slice(0, -2) + '…';
  ctx.fillText(caption, geometry.width / 2, y + 65);
  if (options.showDate) { ctx.font = '400 18px Nunito'; ctx.fillText(options.date.toLocaleDateString('vi-VN'), geometry.width / 2, y + 97); }
  return canvas;
}

export function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không xuất được ảnh. Vui lòng thử lại.')), 'image/png'));
}

export function downloadName(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `PhotoBeo-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`;
}
