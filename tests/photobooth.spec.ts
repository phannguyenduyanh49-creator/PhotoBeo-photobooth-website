import { expect, test, type Page } from '@playwright/test';

async function enableCamera(page: Page) {
  await page.getByRole('button', { name: 'Bật camera', exact: true }).click();
  await expect(page.getByText('Camera đã sẵn sàng')).toBeVisible();
}
async function testImage(page: Page, color = '#ff0000') {
  return Buffer.from(await page.evaluate(color => {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, 800, 600);
    return canvas.toDataURL('image/png').split(',')[1];
  }, color), 'base64');
}

test('camera giả: hủy đếm ngược, chụp tự động, chụp lại, xuất và tải PNG', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Chụp tự động', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  await enableCamera(page);
  await page.getByRole('button', { name: 'Chụp tự động', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Còn 3 giây' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dải 1 × 3', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Hủy chụp', exact: true }).click();
  await page.waitForTimeout(3300);
  await expect(page.getByText('Đã chụp 0/4')).toBeVisible();
  await page.getByLabel('Thời gian đếm ngược').selectOption('0');
  await page.getByRole('button', { name: 'Đen trắng', exact: true }).click();
  await page.getByRole('button', { name: 'Chụp tự động', exact: true }).click();
  await expect(page.getByText('Đã chụp 4/4')).toBeVisible();
  await page.getByRole('button', { name: 'Chụp lại ảnh 2', exact: true }).click();
  await expect(page.getByText('Đã chụp 4/4')).toBeVisible();
  await page.getByRole('button', { name: 'Lưới 2 × 3', exact: true }).click();
  await expect(page.getByText('Đã chụp 4/6')).toBeVisible();
  await page.getByRole('button', { name: 'Chụp tự động', exact: true }).click();
  await expect(page.getByText('Đã chụp 6/6')).toBeVisible();
  await page.getByLabel('Lời nhắn nhỏ').fill('Một ngày thật xinh ♡');
  await page.getByRole('button', { name: 'Nơ xinh', exact: true }).click();
  await page.getByRole('button', { name: 'Xem thành phẩm', exact: true }).click();
  const result = page.getByRole('dialog');
  await expect(result).toBeVisible({ timeout: 20_000 });
  const img = result.getByAltText('Thành phẩm PhotoBeo — giống hệt ảnh PNG tải về'); await expect(img).toBeVisible();
  const dimensions = await img.evaluate(async (img: HTMLImageElement) => { await img.decode(); return { w: img.naturalWidth, h: img.naturalHeight }; });
  expect(Math.max(dimensions.w, dimensions.h)).toBe(2400);
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.srcObject)).toBeNull();
  const downloadPromise = page.waitForEvent('download');
  await result.getByRole('link', { name: 'Tải ảnh HD', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^PhotoBeo-\d{8}-\d{6}\.png$/);
  await download.saveAs('artifacts/photobeo-export.png');
  await page.screenshot({ path: 'artifacts/result.png', fullPage: true });
  await result.getByRole('button', { name: 'Quay lại chỉnh sửa' }).click();
  await expect(result).not.toBeVisible();
  await page.getByRole('button', { name: 'Chụp lại tất cả', exact: true }).click();
  await expect(page.getByText('Đã chụp 0/6')).toBeVisible();
  expect(errors).toEqual([]);
});

test('tải ảnh, bộ lọc ghi vào pixel, bảo toàn ảnh khi đổi bố cục và kiểm tra crop/export', async ({ page }) => {
  await page.goto('/');
  const red = await testImage(page);
  await page.getByRole('button', { name: 'Polaroid', exact: true }).click();
  await page.getByRole('button', { name: 'Đen trắng', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'red.png', mimeType: 'image/png', buffer: red });
  await expect(page.getByText('Đã chụp 1/1')).toBeVisible();
  await expect.poll(async () => page.locator('.slot-select img').evaluate(async (img: HTMLImageElement) => {
    await img.decode(); const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data];
  }).then(pixel => Math.abs(pixel[0] - pixel[1]) + Math.abs(pixel[1] - pixel[2]))).toBeLessThan(6);
  await page.getByRole('button', { name: 'Dải 1 × 4', exact: true }).click();
  await expect(page.getByText('Đã chụp 1/4')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(Array.from({ length: 3 }, (_, i) => ({ name: `${i}.png`, mimeType: 'image/png', buffer: red })));
  await expect(page.getByText('Đã chụp 4/4')).toBeVisible();
  for (const name of ['Dải 1 × 3', 'Lưới 2 × 2', 'Polaroid', 'Dải 1 × 4']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Xem thành phẩm', exact: true }).click();
    const img = page.getByRole('dialog').getByAltText('Thành phẩm PhotoBeo — giống hệt ảnh PNG tải về'); await expect(img).toBeVisible({ timeout: 20_000 });
    const check = await img.evaluate(async (img: HTMLImageElement) => {
      await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
      return { width: canvas.width, height: canvas.height, alpha: ctx.getImageData(canvas.width / 2, canvas.height / 4, 1, 1).data[3] };
    });
    expect(Math.max(check.width, check.height)).toBe(2400); expect(check.alpha).toBe(255);
    await page.getByRole('button', { name: 'Quay lại chỉnh sửa' }).click();
  }
  await expect(page.getByText('Đã chụp 4/4')).toBeVisible();
  await page.getByRole('button', { name: 'Chọn ảnh 1 để thay thế' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('Chỉ nhận ảnh JPEG, PNG hoặc WebP');
});

test('mobile: một cột, không tràn ngang và thao tác được bằng bàn phím', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Cách chụp' }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await enableCamera(page); await page.getByLabel('Thời gian đếm ngược').selectOption('0');
  await page.getByRole('button', { name: 'Chụp từng ảnh', exact: true }).click();
  await expect(page.getByText('Đã chụp 1/4')).toBeVisible();
  await page.getByRole('button', { name: 'Tắt camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bật camera', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('quyền camera bị từ chối vẫn có thể tải ảnh', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Bật camera', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Bạn chưa cho phép truy cập camera');
  const png = await testImage(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Đã chụp 1/4')).toBeVisible();
});
