import { afterEach, describe, expect, it, vi } from 'vitest';
import { coverRect, getGeometry, layouts } from './layouts';
import { countdown, delay } from './countdown';
import { downloadName, validateUpload } from './images';

describe('Bố cục và crop', () => {
  it('có đủ số ảnh và không có ô chồng lấn hoặc ra ngoài khung', () => {
    expect(layouts.map(l => l.count)).toEqual([3, 4, 4, 6, 1]);
    for (const layout of layouts) {
      const g = getGeometry(layout);
      expect(g.cells).toHaveLength(layout.count);
      for (const cell of g.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(g.padding);
        expect(cell.x + cell.width).toBeLessThanOrEqual(g.width - g.padding);
        expect(cell.y + cell.height).toBeLessThanOrEqual(g.height - g.footer);
      }
      for (let i = 0; i < g.cells.length; i++) for (let j = i + 1; j < g.cells.length; j++) {
        const a = g.cells[i], b = g.cells[j];
        expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
      }
      const scale = 2400 / Math.max(g.width, g.height);
      expect(Math.max(Math.round(g.width * scale), Math.round(g.height * scale))).toBe(2400);
    }
  });
  it('crop cover giữ đúng tỷ lệ và nằm giữa ảnh ngang hoặc dọc', () => {
    expect(coverRect(1600, 900, 600, 450)).toEqual({ x: 200, y: 0, width: 1200, height: 900 });
    expect(coverRect(900, 1600, 600, 450)).toEqual({ x: 0, y: 462.5, width: 900, height: 675 });
  });
});

describe('Đếm ngược có thể hủy', () => {
  afterEach(() => vi.useRealTimers());
  it('đếm đủ thời gian rồi xóa số hiển thị', async () => {
    vi.useFakeTimers(); const tick = vi.fn();
    const run = countdown(3, new AbortController().signal, tick);
    await vi.advanceTimersByTimeAsync(3000); await run;
    expect(tick.mock.calls.map(call => call[0])).toEqual([3, 2, 1, null]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('hủy trước thời điểm chụp và dọn toàn bộ timer', async () => {
    vi.useFakeTimers(); const controller = new AbortController(); const tick = vi.fn();
    const run = countdown(5, controller.signal, tick);
    const assertion = expect(run).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1100); controller.abort(); await assertion;
    await vi.advanceTimersByTimeAsync(10000);
    expect(tick.mock.calls.map(call => call[0])).toEqual([5, 4, null]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('không chụp nếu signal đã hủy, kể cả không đếm ngược', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(countdown(0, controller.signal, vi.fn())).rejects.toMatchObject({ name: 'AbortError' });
    await expect(delay(700, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('Ảnh tải lên và tên file', () => {
  it('chặn tệp sai định dạng, trống và vượt 15 MB', () => {
    expect(() => validateUpload(new File(['svg'], 'a.svg', { type: 'image/svg+xml' }))).toThrow('JPEG');
    expect(() => validateUpload(new File([], 'a.png', { type: 'image/png' }))).toThrow('trống');
    expect(() => validateUpload(new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' }))).toThrow('15 MB');
    expect(() => validateUpload(new File(['bytes'], 'a.webp', { type: 'image/webp' }))).not.toThrow();
  });
  it('tên file dùng ngày giờ địa phương và có đủ chữ số', () => {
    expect(downloadName(new Date(2026, 0, 2, 3, 4, 5))).toBe('PhotoBeo-20260102-030405.png');
  });
});
