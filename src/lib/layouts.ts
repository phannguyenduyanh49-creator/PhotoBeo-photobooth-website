export const layouts = [
  { id: 'strip3', name: 'Dải 1 × 3', count: 3, columns: 1, rows: 3 },
  { id: 'strip4', name: 'Dải 1 × 4', count: 4, columns: 1, rows: 4 },
  { id: 'grid4', name: 'Lưới 2 × 2', count: 4, columns: 2, rows: 2 },
  { id: 'grid6', name: 'Lưới 2 × 3', count: 6, columns: 2, rows: 3 },
  { id: 'polaroid', name: 'Polaroid', count: 1, columns: 1, rows: 1 },
] as const;
export type Layout = typeof layouts[number];
export type LayoutId = Layout['id'];
export const frames = [
  { id: 'pastel', name: 'Hồng pastel', color: '#ffe4ee', symbol: '✦' },
  { id: 'white', name: 'Tối giản', color: '#ffffff', symbol: '·' },
  { id: 'hearts', name: 'Trái tim', color: '#ffdae5', symbol: '♥' },
  { id: 'bows', name: 'Nơ xinh', color: '#f0e5fb', symbol: '୨୧' },
  { id: 'retro', name: 'Retro', color: '#f1e2c9', symbol: '✷' },
] as const;
export type FrameId = typeof frames[number]['id'];
export type Photo = { src: string; filterName: string };
export type FrameOptions = { frame: FrameId; color: string; caption: string; showDate: boolean; date: Date };

// All frame previews and exports use these same coordinates.
export function getGeometry(layout: Layout) {
  const cellWidth = 600;
  const cellHeight = 450;
  const padding = 44;
  const gap = 24;
  const footer = layout.id === 'polaroid' ? 200 : 154;
  const width = padding * 2 + layout.columns * cellWidth + (layout.columns - 1) * gap;
  const height = padding * 2 + layout.rows * cellHeight + (layout.rows - 1) * gap + footer;
  const cells = Array.from({ length: layout.count }, (_, i) => ({
    x: padding + (i % layout.columns) * (cellWidth + gap),
    y: padding + Math.floor(i / layout.columns) * (cellHeight + gap),
    width: cellWidth, height: cellHeight,
  }));
  return { width, height, padding, footer, cells };
}

export function coverRect(sw: number, sh: number, dw: number, dh: number) {
  const scale = Math.max(dw / sw, dh / sh);
  const width = dw / scale;
  const height = dh / scale;
  return { x: (sw - width) / 2, y: (sh - height) / 2, width, height };
}
