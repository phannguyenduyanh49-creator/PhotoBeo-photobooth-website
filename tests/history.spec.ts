import { expect, test, type Page } from '@playwright/test';

async function finish(page: Page) {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('public/filter-sample.jpg');
  await expect(page.getByText('Đã chụp 1/6')).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục →' }).click();
  await page.getByRole('button', { name: 'Polaroid', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục →' }).click();
  await page.getByRole('button', { name: 'Xem thành phẩm', exact: true }).click();
  await expect(page.getByAltText('Thành phẩm PhotoBeo — giống hệt ảnh PNG tải về')).toBeVisible({ timeout: 20_000 });
}
test('lịch sử reload, ngày hết hạn, tải/xóa độc lập Wall và khôi phục quyền truy cập', async ({ page, context }) => {
  await finish(page);
  await page.getByRole('button', { name: 'Lưu vào lịch sử', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Tôi đồng ý gửi ảnh và lưu thành phẩm riêng tư.' }).check();
  await page.getByRole('button', { name: 'Đồng ý và lưu ảnh', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đã lưu lịch sử 30 ngày' })).toBeVisible();
  await page.getByRole('button', { name: 'Lịch sử ảnh', exact: true }).click();
  await expect(page.locator('.history-card')).toHaveCount(1);
  await page.reload(); await expect(page.locator('.history-card')).toHaveCount(1);
  await expect(page.locator('.expiry time')).toHaveAttribute('datetime', /T/);
  const download = page.waitForEvent('download'); await page.getByRole('link', { name: 'Tải HD', exact: true }).click(); expect((await download).suggestedFilename()).toContain('PhotoBeo');
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Tạo mã khôi phục', exact: true }).click();
  const key = page.getByLabel('Mã khôi phục mới'); await expect(key).not.toHaveValue(''); const recoveryKey = await key.inputValue();
  await page.screenshot({ path: 'artifacts/v3-history.png', fullPage: true, mask: [key] });
  await page.getByRole('button', { name: 'Giữ trên Wall', exact: true }).click();
  await expect(page.locator('.wall-hit')).toHaveCount(1);
  await page.getByRole('button', { name: 'Lưu bảng', exact: true }).click(); await expect(page.getByText('Đã lưu bố cục riêng tư trên máy chủ.')).toBeVisible();
  await page.getByRole('button', { name: 'Lịch sử ảnh', exact: true }).click();
  await page.getByRole('button', { name: /^Xóa ảnh lịch sử/ }).click(); await expect(page.locator('.history-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Góc kỷ niệm', exact: true }).click(); await expect(page.locator('.wall-hit')).toHaveCount(1);
  await page.reload(); await expect(page.locator('.wall-hit')).toHaveCount(1); await expect(page.getByText('Lưu lâu dài', { exact: true })).toBeVisible();
  await context.clearCookies(); await page.goto('/history'); await page.getByLabel('Mã khôi phục', { exact: true }).fill(recoveryKey);
  await page.getByRole('button', { name: 'Khôi phục thư viện', exact: true }).click(); await expect(page.getByText('Đã khôi phục thư viện riêng tư.')).toBeVisible();
  await page.getByRole('button', { name: 'Góc kỷ niệm', exact: true }).click(); await expect(page.locator('.wall-hit')).toHaveCount(1);
  await page.getByRole('button', { name: 'Xóa bảng và ảnh Wall', exact: true }).click(); await expect(page.locator('.wall-hit')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.wall-hit')).toHaveCount(0);
});
for (const width of [390, 820]) test(`bốn màn hình và ảnh thành phẩm vừa khung ở chiều rộng ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1180 });
  await page.goto('/'); await page.locator('input[type=file]').setInputFiles('public/filter-sample.jpg'); await expect(page.getByText('Đã chụp 1/6')).toBeVisible();
  for (const step of [1, 2, 3]) {
    await expect(page.getByLabel(`Bước ${step}/4`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (step === 2) await page.getByRole('button', { name: 'Polaroid', exact: true }).click();
    await page.screenshot({ path: `artifacts/v3-${width}-step-${step}.png`, fullPage: true });
    await page.getByRole('button', { name: step === 3 ? 'Xem thành phẩm' : 'Tiếp tục →', exact: true }).click();
  }
  const img = page.getByAltText('Thành phẩm PhotoBeo — giống hệt ảnh PNG tải về'); await expect(img).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => img.evaluate(img => { const r = img.getBoundingClientRect(), v = img.closest('.zoom-viewport')!.getBoundingClientRect(); return r.width <= v.width && r.height <= v.height; })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/v3-${width}-step-4.png`, fullPage: true });
});
