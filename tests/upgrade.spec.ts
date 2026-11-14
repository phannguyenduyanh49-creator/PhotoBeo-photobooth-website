import { expect, test, type Page } from '@playwright/test';

async function uploadOne(page: Page) {
  await page.getByRole('button', { name: 'Polaroid', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles('public/filter-sample.jpg');
  await expect(page.getByText('Đã chụp 1/1')).toBeVisible();
}
const resultImage = (page: Page) => page.getByAltText('Thành phẩm PhotoBeo — giống hệt ảnh PNG tải về');

test('chỉnh ảnh cũ không mất gốc, 24 preset, before/after và preset cá nhân', async ({ page }) => {
  await page.goto('/'); await uploadOne(page);
  await page.getByRole('button', { name: 'Chọn ảnh 1 để thay thế' }).click();
  const thumbnail = page.locator('.slot-select img');
  await expect(thumbnail).toHaveAttribute('src', /^data:image\/png/);
  const original = await thumbnail.getAttribute('src');
  for (const group of ['Cơ bản', 'Pastel', 'Film', 'Sáng tạo']) {
    await page.getByRole('button', { name: group, exact: true }).click(); await expect(page.locator('.real-filter')).toHaveCount(6);
  }
  await page.getByRole('button', { name: 'Pastel', exact: true }).click();
  await page.getByRole('button', { name: 'Mơ oải hương', exact: true }).click();
  await expect(thumbnail).not.toHaveAttribute('src', original!);
  await page.getByRole('button', { name: 'Tinh chỉnh', exact: true }).click();
  const brightness = page.getByLabel('Độ sáng', { exact: true }); await brightness.focus(); await brightness.press('ArrowRight');
  await page.getByRole('button', { name: 'Trước / Sau' }).click(); await expect(page.getByAltText('Ảnh gốc trước chỉnh sửa')).toBeVisible();
  await page.getByRole('button', { name: 'Đang xem ảnh gốc' }).click();
  await page.getByLabel('Tên preset cá nhân').fill('Màu của Beo'); await page.getByRole('button', { name: 'Lưu preset', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Màu của Beo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Khôi phục Original' }).click(); await expect(thumbnail).toHaveAttribute('src', original!);
  await page.getByRole('button', { name: 'Màu của Beo', exact: true }).click(); await expect(thumbnail).not.toHaveAttribute('src', original!);
  await page.getByRole('button', { name: 'Xem thành phẩm', exact: true }).click();
  await expect(resultImage(page)).toBeVisible({ timeout: 20_000 });
  expect(await resultImage(page).getAttribute('src')).toBe(await page.getByRole('link', { name: 'Tải ảnh HD' }).getAttribute('href'));
  await page.getByLabel('Phóng to thành phẩm').focus(); await page.getByLabel('Phóng to thành phẩm').press('ArrowRight');
  await expect(page.getByText('101%', { exact: true })).toBeVisible();
});

test('đồng ý lưu, xác thực, scrapbook kéo/xoay/resize/layer, undo/redo, reload và xuất PNG', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', err => errors.push(err.message));
  const uploads: string[] = []; page.on('request', req => { if (req.url().includes('/api/booth/')) uploads.push(req.url()); });
  await page.goto('/'); await uploadOne(page);
  await page.getByRole('button', { name: 'Xem thành phẩm', exact: true }).click(); await expect(resultImage(page)).toBeVisible({ timeout: 20_000 });
  expect(uploads).toHaveLength(0);
  await page.getByRole('button', { name: 'Thêm vào Creative Wall' }).click();
  await expect(page.getByRole('button', { name: 'Đồng ý và lưu ảnh' })).toBeDisabled(); expect(uploads).toHaveLength(0);
  await page.getByRole('checkbox', { name: 'Tôi đồng ý gửi ảnh và lưu thành phẩm riêng tư.' }).check();
  await page.getByRole('button', { name: 'Đồng ý và lưu ảnh' }).click();
  await expect(page.getByRole('button', { name: 'Mở Góc kỷ niệm' })).toBeVisible({ timeout: 30_000 }); expect(uploads).toHaveLength(1);
  await expect(resultImage(page)).toHaveAttribute('src', /^\/api\/photos\//);
  await page.getByRole('button', { name: 'Mở Góc kỷ niệm' }).click(); await expect(page).toHaveURL(/memory-wall/);
  await expect(page.locator('.wall-hit')).toHaveCount(1);
  const item = page.getByRole('button', { name: 'Ảnh trên bảng 1', exact: true }); const box = (await item.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 }); await page.mouse.up();
  await page.getByLabel('Góc xoay đối tượng').focus(); await page.getByLabel('Góc xoay đối tượng').press('ArrowRight');
  await page.getByLabel('Kích thước đối tượng').focus(); await page.getByLabel('Kích thước đối tượng').press('ArrowRight');
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click(); await page.getByLabel('Nội dung ghi chú').fill('Một ngày thật xinh ♡');
  await page.getByRole('button', { name: 'Băng dính', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm sticker Trái tim', exact: true }).click(); await expect(page.locator('.wall-hit')).toHaveCount(4);
  await page.getByRole('button', { name: 'Ra sau', exact: true }).click();
  await page.getByRole('button', { name: 'Gỡ khỏi trang giấy', exact: true }).click(); await expect(page.locator('.wall-hit')).toHaveCount(3);
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click(); await expect(page.locator('.wall-hit')).toHaveCount(4);
  await page.getByRole('button', { name: 'Làm lại', exact: true }).click(); await expect(page.locator('.wall-hit')).toHaveCount(3);
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu bảng', exact: true }).click(); await expect(page.getByText('Đã lưu bố cục riêng tư trên máy chủ.')).toBeVisible();
  await page.reload(); await expect(page.locator('.wall-hit')).toHaveCount(4);
  await page.screenshot({ path: 'artifacts/memory-wall-desktop.png', fullPage: true });
  const dataTransfer = await page.evaluateHandle(() => { const data = new DataTransfer(); data.items.add(new File(['unregistered'], 'arbitrary.png', { type: 'image/png' })); return data; });
  await page.locator('.wall-scroll').dispatchEvent('drop', { dataTransfer }); await dataTransfer.dispose();
  await expect(page.getByRole('alert')).toContainText('Chỉ dán ảnh đã được PhotoBeo xác thực');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Xuất PNG', exact: true }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toContain('PhotoBeo-Goc-ky-niem'); await download.saveAs('artifacts/memory-wall-export.png');
  await expect(page.getByText('Đã lưu bố cục và xuất PNG 3200 × 2400 px.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/memory-wall-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('tablet và đường dẫn wall trực tiếp có empty/error state thật', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 }); await page.goto('/');
  await page.screenshot({ path: 'artifacts/tablet.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/memory-wall'); await expect(page.getByText('Chưa có ảnh nào')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo ảnh đầu tiên' })).toBeVisible();
  await page.route('**/api/wall', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Máy chủ tạm ngưng để bảo trì.' }) }));
  await page.reload(); await expect(page.getByRole('alert')).toContainText('Máy chủ tạm ngưng');
});
