export type Adjustments = {
  brightness: number; contrast: number; saturation: number; warmth: number; tint: number;
  highlights: number; shadows: number; grain: number; vignette: number;
};
export type EditRecipe = Adjustments & { filterId: string; intensity: number };
export const neutral: Adjustments = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, tint: 0, highlights: 0, shadows: 0, grain: 0, vignette: 0 };
export const defaultEdit: EditRecipe = { ...neutral, filterId: 'normal', intensity: 100 };
type Preset = { id: string; name: string; description: string; group: string; settings: Partial<Adjustments>; mono?: boolean; sepia?: number };
export const filterGroups = ['Cơ bản', 'Pastel', 'Film', 'Sáng tạo'];
export const filters: Preset[] = [
  { id: 'normal', name: 'Bình thường', description: 'Original', group: 'Cơ bản', settings: {} },
  { id: 'mono', name: 'Đen trắng', description: 'Black & White', group: 'Cơ bản', settings: {}, mono: true },
  { id: 'soft', name: 'Mềm mại', description: 'Soft Contrast', group: 'Cơ bản', settings: { contrast: -16, brightness: 5, shadows: 8 } },
  { id: 'clean', name: 'Trong trẻo', description: 'Bright & Clean', group: 'Cơ bản', settings: { brightness: 12, contrast: 5, saturation: -5 } },
  { id: 'warm', name: 'Ấm áp', description: 'Warm Tone', group: 'Cơ bản', settings: { warmth: 24, saturation: 4 } },
  { id: 'cool', name: 'Tông lạnh', description: 'Cool Tone', group: 'Cơ bản', settings: { warmth: -24, saturation: -10, contrast: 5 } },
  { id: 'pink', name: 'Hồng nhẹ', description: 'Baby Pink', group: 'Pastel', settings: { brightness: 7, contrast: -9, tint: 23, warmth: 5 } },
  { id: 'peach', name: 'Sữa đào', description: 'Peach Milk', group: 'Pastel', settings: { warmth: 21, tint: 10, contrast: -12, brightness: 8 } },
  { id: 'lavender', name: 'Mơ oải hương', description: 'Lavender Dream', group: 'Pastel', settings: { warmth: -17, tint: 23, saturation: -12, shadows: 12 } },
  { id: 'mint', name: 'Kem bạc hà', description: 'Mint Cream', group: 'Pastel', settings: { warmth: -12, tint: -23, contrast: -8, brightness: 7 } },
  { id: 'vanilla', name: 'Vani', description: 'Vanilla', group: 'Pastel', settings: { warmth: 17, saturation: -18, contrast: -9, brightness: 9 } },
  { id: 'rose', name: 'Hồng rạng rỡ', description: 'Rose Glow', group: 'Pastel', settings: { tint: 27, warmth: 10, saturation: 9, highlights: 8 } },
  { id: 'vintage', name: 'Vintage', description: 'Vintage Film', group: 'Film', settings: { contrast: -13, warmth: 15, grain: 13, vignette: 12 }, sepia: .28 },
  { id: 'kodak', name: 'Nắng trên phim', description: 'Kodak Style', group: 'Film', settings: { warmth: 27, saturation: 15, contrast: 12, grain: 12 } },
  { id: 'fuji', name: 'Phim xanh', description: 'Fuji Style', group: 'Film', settings: { tint: -14, warmth: -7, saturation: 11, shadows: 10, grain: 9 } },
  { id: 'disposable', name: 'Máy ảnh bỏ túi', description: 'Disposable Camera', group: 'Film', settings: { contrast: 22, warmth: 13, grain: 28, vignette: 28 } },
  { id: 'retro90', name: 'Ngày xưa ấy', description: 'Retro 90s', group: 'Film', settings: { saturation: -15, tint: 10, shadows: 17, grain: 19 }, sepia: .12 },
  { id: 'faded', name: 'Phim phai', description: 'Faded Film', group: 'Film', settings: { contrast: -24, saturation: -24, shadows: 20, grain: 13 } },
  { id: 'dreamy', name: 'Mơ màng', description: 'Dreamy Glow', group: 'Sáng tạo', settings: { brightness: 10, contrast: -21, highlights: 12, tint: 9 } },
  { id: 'y2k', name: 'Hồng Y2K', description: 'Y2K Pink', group: 'Sáng tạo', settings: { tint: 34, saturation: 27, contrast: 17 } },
  { id: 'cinematic', name: 'Điện ảnh', description: 'Cinematic', group: 'Sáng tạo', settings: { contrast: 23, saturation: -20, warmth: -14, vignette: 22 } },
  { id: 'golden', name: 'Giờ vàng', description: 'Golden Hour', group: 'Sáng tạo', settings: { warmth: 38, brightness: 6, saturation: 15, highlights: 8 } },
  { id: 'matte', name: 'Lì dịu', description: 'Soft Matte', group: 'Sáng tạo', settings: { contrast: -18, shadows: 25, saturation: -12 } },
  { id: 'night', name: 'Flash đêm', description: 'Night Flash', group: 'Sáng tạo', settings: { contrast: 26, brightness: 7, warmth: -12, highlights: 18, vignette: 35, grain: 9 } },
];
export const adjustmentLabels: Record<keyof Adjustments, string> = { brightness: 'Độ sáng', contrast: 'Tương phản', saturation: 'Độ bão hòa', warmth: 'Độ ấm', tint: 'Sắc hồng / xanh', highlights: 'Vùng sáng', shadows: 'Vùng tối', grain: 'Hạt phim', vignette: 'Tối góc' };
const clamp = (n: number) => Math.min(255, Math.max(0, n));

// Shared deterministic pipeline: always process original pixels, never the previous render.
export function transformPixels(data: Uint8ClampedArray, width: number, height: number, edit: EditRecipe) {
  const preset = filters.find(p => p.id === edit.filterId) ?? filters[0];
  const strength = edit.intensity / 100;
  const values = { ...neutral };
  for (const key of Object.keys(neutral) as (keyof Adjustments)[]) values[key] = edit[key] + (preset.settings[key] ?? 0) * strength;
  const brightness = 1 + values.brightness / 110, contrast = 1 + values.contrast / 100;
  const saturation = Math.max(0, 1 + values.saturation / 100) * (preset.mono ? 1 - strength : 1);
  const sepia = (preset.sepia ?? 0) * strength;
  const red = values.warmth * .48 + values.tint * .2, green = -values.tint * .32, blue = -values.warmth * .48 + values.tint * .16;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    const luminance = (r * .2126 + g * .7152 + b * .0722) / 255;
    const light = values.shadows * (1 - luminance) ** 2 * .9 + values.highlights * luminance ** 2 * .7;
    r = (r + red + light) * brightness; g = (g + green + light) * brightness; b = (b + blue + light) * brightness;
    if (sepia) {
      const nr = r * .393 + g * .769 + b * .189, ng = r * .349 + g * .686 + b * .168, nb = r * .272 + g * .534 + b * .131;
      r += (nr - r) * sepia; g += (ng - g) * sepia; b += (nb - b) * sepia;
    }
    const l = r * .2126 + g * .7152 + b * .0722;
    r = (l + (r - l) * saturation - 127.5) * contrast + 127.5;
    g = (l + (g - l) * saturation - 127.5) * contrast + 127.5;
    b = (l + (b - l) * saturation - 127.5) * contrast + 127.5;
    if (values.vignette || values.grain) {
      const x = (i / 4) % width, y = Math.floor(i / 4 / width);
      const distance = ((x / width - .5) ** 2 + (y / height - .5) ** 2) * 2;
      const vignette = 1 - Math.max(0, values.vignette) / 100 * distance * .85;
      let hash = Math.imul(Math.floor(x / width * 1600) + 1, 374761393) ^ Math.imul(Math.floor(y / height * 1200) + 1, 668265263);
      hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
      const noise = ((hash >>> 0) / 4294967295 - .5) * values.grain * .8;
      r = r * vignette + noise; g = g * vignette + noise; b = b * vignette + noise;
    }
    data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b);
  }
}
export function applyFilter(ctx: CanvasRenderingContext2D, edit: EditRecipe | string) {
  const recipe = typeof edit === 'string' ? { ...defaultEdit, filterId: edit } : edit;
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  transformPixels(image.data, image.width, image.height, recipe);
  ctx.putImageData(image, 0, 0);
}

