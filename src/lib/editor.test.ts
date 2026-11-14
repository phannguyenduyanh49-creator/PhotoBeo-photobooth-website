import { describe, expect, it } from 'vitest';
import { defaultEdit, filters, transformPixels } from './filters';
import { boundedItem } from './wall';

describe('Ảnh gốc và công thức màu', () => {
  const original = new Uint8ClampedArray([205, 90, 70, 255, 30, 140, 190, 255]);
  function render(edit = defaultEdit) { const data = new Uint8ClampedArray(original); transformPixels(data, 2, 1, edit); return data; }
  it('có 24 preset chia đều bốn nhóm', () => { expect(filters).toHaveLength(24); expect(new Set(filters.map(f => f.id)).size).toBe(24); for (const group of new Set(filters.map(f => f.group))) expect(filters.filter(f => f.group === group)).toHaveLength(6); });
  it('Original khôi phục đúng pixel, không tích lũy bộ lọc', () => {
    const vintage = { ...defaultEdit, filterId: 'vintage' };
    expect(render(vintage)).not.toEqual(original); expect(render(vintage)).toEqual(render(vintage));
    expect(render(defaultEdit)).toEqual(original); expect(render({ ...vintage, intensity: 0 })).toEqual(original);
  });
  it('mọi thanh chỉnh đều tác động lên pixel thực', () => {
    for (const key of ['brightness', 'contrast', 'saturation', 'warmth', 'tint', 'highlights', 'shadows', 'grain', 'vignette']) expect(render({ ...defaultEdit, [key]: 60 }), key).not.toEqual(original);
  });
  it('đen trắng có RGB bằng nhau và grain ổn định', () => {
    const mono = render({ ...defaultEdit, filterId: 'mono' }); expect(mono[0]).toBe(mono[1]); expect(mono[1]).toBe(mono[2]);
    expect(render({ ...defaultEdit, grain: 40 })).toEqual(render({ ...defaultEdit, grain: 40 }));
  });
  it('chặn đối tượng ra ngoài trang giấy', () => {
    const item = boundedItem({ id: '1', type: 'note', x: -50, y: 1000, width: 200, height: 100, rotation: 500 });
    expect(item.x).toBe(0); expect(item.y).toBe(800); expect(item.rotation).toBe(180);
  });
});
