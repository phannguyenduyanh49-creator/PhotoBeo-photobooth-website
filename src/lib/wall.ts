export const WALL_WIDTH = 1200;
export const WALL_HEIGHT = 900;
export const stickers = [
  { id: 'heart', label: 'Trái tim', glyph: '♥', color: '#d97899' },
  { id: 'star', label: 'Ngôi sao', glyph: '✦', color: '#d6ab58' },
  { id: 'flower', label: 'Bông hoa', glyph: '✿', color: '#b591be' },
  { id: 'sparkle', label: 'Lấp lánh', glyph: '✧', color: '#a3b7a5' },
  { id: 'love', label: 'Yêu thương', glyph: '♡', color: '#d7889e' },
] as const;
export type WallItem = {
  id: string; type: 'photo' | 'sticker' | 'note' | 'tape';
  x: number; y: number; width: number; height: number; rotation: number;
  photoId?: string; stickerId?: string; text?: string; color?: string;
};
export type WallDocument = { items: WallItem[]; background: string };
export type SavedWall = WallDocument & { revision: number; updatedAt: string | null };
export const emptyWall: WallDocument = { items: [], background: '#fffdf7' };
export type PhotoRecord = {
  photoId: string; assetId: string; createdAt: string; ownerSessionId: string;
  origin: 'camera' | 'upload'; verificationStatus: 'verified'; photoBeoVersion: string;
  width: number; height: number; url: string;
};

export function boundedItem(item: WallItem): WallItem {
  const width = Math.max(40, Math.min(1100, item.width)), height = Math.max(30, Math.min(820, item.height));
  return { ...item, width, height, x: Math.max(0, Math.min(WALL_WIDTH - width, item.x)), y: Math.max(0, Math.min(WALL_HEIGHT - height, item.y)), rotation: Math.max(-180, Math.min(180, item.rotation)) };
}

export function drawDecoration(ctx: CanvasRenderingContext2D, item: WallItem) {
  const { width: w, height: h } = item;
  if (item.type === 'sticker') {
    const sticker = stickers.find(s => s.id === item.stickerId) ?? stickers[0];
    ctx.fillStyle = sticker.color; ctx.font = `${Math.min(w, h) * .8}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sticker.glyph, w / 2, h / 2);
  } else if (item.type === 'tape') {
    ctx.globalAlpha = .7; ctx.fillStyle = item.color || '#efd4ac'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 2;
    for (let x = 5; x < w; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else if (item.type === 'note') {
    ctx.fillStyle = item.color || '#fff1bf'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#674858'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const fontSize = Math.min(24, Math.max(13, w / 12)); ctx.font = `600 ${fontSize}px Nunito`;
    const words = (item.text || '').split(/\s+/); let line = '', y = 18;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > w - 30 && line) {
        ctx.fillText(line, 15, y, w - 30); y += fontSize * 1.5; line = word;
        if (y > h - fontSize - 15) { ctx.fillText('…', 15, y); return; }
      } else line = candidate;
    }
    ctx.fillText(line, 15, y, w - 30);
  }
}

export function paintWall(ctx: CanvasRenderingContext2D, doc: WallDocument, images: Map<string, CanvasImageSource>, scale = 1) {
  ctx.save(); ctx.scale(scale, scale);
  ctx.fillStyle = doc.background; ctx.fillRect(0, 0, WALL_WIDTH, WALL_HEIGHT);
  // Identical small paper dots in the editor and the PNG export.
  ctx.fillStyle = '#b99f8a20';
  for (let y = 12; y < WALL_HEIGHT; y += 24) for (let x = 12; x < WALL_WIDTH; x += 24) ctx.fillRect(x, y, 1, 1);
  for (const item of doc.items) {
    ctx.save(); ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
    ctx.rotate(item.rotation * Math.PI / 180); ctx.translate(-item.width / 2, -item.height / 2);
    if (item.type === 'photo') {
      const image = images.get(item.photoId!);
      if (image) {
        ctx.shadowColor = '#57384925'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
        ctx.drawImage(image, 0, 0, item.width, item.height);
      }
    } else drawDecoration(ctx, item);
    ctx.restore();
  }
  ctx.restore();
}
