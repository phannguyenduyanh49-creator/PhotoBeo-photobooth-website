import { coverRect, getGeometry, type Layout, type FrameOptions } from './layouts';
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

export function paintFrame(ctx: CanvasRenderingContext2D, layout: Layout, images: (CanvasImageSource & { width: number; height: number } | null)[], options: FrameOptions, longEdge = 2400) {
  const geometry = getGeometry(layout); const scale = longEdge / Math.max(geometry.width, geometry.height);
  ctx.scale(scale, scale); ctx.fillStyle = options.color;
  ctx.fillRect(0, 0, geometry.width, geometry.height);
  geometry.cells.forEach((cell, i) => {
    const img = images[i];
    if (img) {
      const crop = coverRect(img.width, img.height, cell.width, cell.height);
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

}
