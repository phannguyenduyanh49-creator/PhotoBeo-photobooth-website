type Operation = { kind: 'grayscale' | 'sepia' | 'brightness' | 'contrast' | 'saturate' | 'hue'; amount: number };
export const filters: { id: string; name: string; css: string; swatch: string; operations: Operation[] }[] = [
  { id: 'normal', name: 'Bình thường', css: 'none', swatch: '#e3bdab', operations: [] },
  { id: 'mono', name: 'Đen trắng', css: 'grayscale(1)', swatch: '#a9a6a5', operations: [{ kind: 'grayscale', amount: 1 }] },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.5) contrast(0.9) brightness(1.05)', swatch: '#b49a71', operations: [{ kind: 'sepia', amount: .5 }, { kind: 'contrast', amount: .9 }, { kind: 'brightness', amount: 1.05 }] },
  { id: 'pink', name: 'Hồng nhẹ', css: 'sepia(0.3) hue-rotate(300deg) brightness(1.08)', swatch: '#dfa5b1', operations: [{ kind: 'sepia', amount: .3 }, { kind: 'hue', amount: 300 }, { kind: 'brightness', amount: 1.08 }] },
  { id: 'soft', name: 'Mềm mại', css: 'contrast(0.85) brightness(1.12) saturate(0.85)', swatch: '#e1c9ba', operations: [{ kind: 'contrast', amount: .85 }, { kind: 'brightness', amount: 1.12 }, { kind: 'saturate', amount: .85 }] },
  { id: 'cool', name: 'Tông lạnh', css: 'sepia(0.2) hue-rotate(160deg) saturate(0.75) contrast(1.05)', swatch: '#9eb7bd', operations: [{ kind: 'sepia', amount: .2 }, { kind: 'hue', amount: 160 }, { kind: 'saturate', amount: .75 }, { kind: 'contrast', amount: 1.05 }] },
];

// Pixel processing also works on browsers without CanvasRenderingContext2D.filter.
export function applyFilter(ctx: CanvasRenderingContext2D, filterId: string) {
  const operations = filters.find(f => f.id === filterId)?.operations ?? [];
  if (!operations.length) return;
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    for (const { kind, amount: a } of operations) {
      if (kind === 'brightness') { r *= a; g *= a; b *= a; }
      if (kind === 'contrast') { r = (r - 127.5) * a + 127.5; g = (g - 127.5) * a + 127.5; b = (b - 127.5) * a + 127.5; }
      if (kind === 'grayscale' || kind === 'saturate') {
        const l = r * .2126 + g * .7152 + b * .0722;
        const s = kind === 'grayscale' ? 1 - a : a;
        r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
      }
      if (kind === 'sepia') {
        const nr = r * .393 + g * .769 + b * .189;
        const ng = r * .349 + g * .686 + b * .168;
        const nb = r * .272 + g * .534 + b * .131;
        r += (nr - r) * a; g += (ng - g) * a; b += (nb - b) * a;
      }
      if (kind === 'hue') {
        const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
        const nr = (.213 + c * .787 - s * .213) * r + (.715 - c * .715 - s * .715) * g + (.072 - c * .072 + s * .928) * b;
        const ng = (.213 - c * .213 + s * .143) * r + (.715 + c * .285 + s * .140) * g + (.072 - c * .072 - s * .283) * b;
        const nb = (.213 - c * .213 - s * .787) * r + (.715 - c * .715 + s * .715) * g + (.072 + c * .928 + s * .072) * b;
        r = nr; g = ng; b = nb;
      }
      r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    }
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
  ctx.putImageData(image, 0, 0);
}
