import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { createService } from './app';
import { defaultEdit } from '../src/lib/filters';
import type { PhotoRecord, WallItem } from '../src/lib/wall';
import type { Server } from 'node:http';

const directory = mkdtempSync(join(tmpdir(), 'photobeo-security-'));
const config = { database: join(directory, 'test.sqlite'), origins: ['http://localhost:5173'], secure: false };
let service: ReturnType<typeof createService>, server: Server, base: string;
type Client = { cookie: string; csrf: string; id: string };
let owner: Client, stranger: Client, photo: PhotoRecord;
function source() {
  const canvas = createCanvas(400, 300), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cc7788'; ctx.fillRect(0, 0, 400, 300); ctx.fillStyle = '#55aabb'; ctx.fillRect(200, 0, 200, 300);
  return canvas.toDataURL('image/png');
}
const originalSrc = source();
const payload = () => ({ consent: true, requestId: crypto.randomUUID(), layoutId: 'polaroid', options: { frame: 'pastel', color: '#ffe4ee', caption: 'Kỷ niệm riêng tư', showDate: true }, photos: [{ originalSrc, edit: defaultEdit }] });
async function start() {
  service = createService(config); server = service.app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
async function close() { server.closeIdleConnections(); await new Promise<void>(resolve => server.close(() => resolve())); service.close(); }
async function client(): Promise<Client> {
  const response = await fetch(base + '/api/session'); const session = await response.json();
  expect(response.headers.get('set-cookie')).toContain('HttpOnly'); expect(response.headers.get('set-cookie')).toContain('SameSite=Strict');
  return { cookie: response.headers.get('set-cookie')!.split(';')[0], csrf: session.csrfToken, id: session.sessionId };
}
const request = (c: Client, path: string, method = 'GET', body?: unknown, extraHeaders?: Record<string, string>) => fetch(base + path, {
  method, headers: { Cookie: c.cookie, Origin: 'http://localhost:5173', 'X-CSRF-Token': c.csrf, ...(body ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders }, body: body ? JSON.stringify(body) : undefined,
});
function wallItem(id: string): WallItem { return { id: crypto.randomUUID(), type: 'photo', photoId: id, x: 100, y: 100, width: photo.width / photo.height * 300, height: 300, rotation: 13 }; }

beforeAll(async () => {
  await start(); owner = await client(); stranger = await client();
  const result = await request(owner, '/api/booth/upload/complete', 'POST', payload());
  expect(result.status).toBe(201); photo = (await result.json()).photo;
}, 30_000);
afterAll(async () => { await close(); rmSync(directory, { recursive: true, force: true }); });

describe('Xác thực và quyền sở hữu ở server', () => {
  it('server tạo record xác thực, PNG thật, không công khai asset', async () => {
    expect(photo).toMatchObject({ ownerSessionId: owner.id, origin: 'upload', verificationStatus: 'verified', photoBeoVersion: '2.0.0' });
    expect(photo.photoId).not.toBe(photo.assetId);
    const response = await request(owner, photo.url); expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer()); expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect((await fetch(base + photo.url)).status).toBe(401);
    expect((await request(stranger, photo.url)).status).toBe(404);
    expect((await request(stranger, '/api/photos')).status).toBe(200);
    expect((await (await request(stranger, '/api/photos')).json()).photos).toEqual([]);
  });
  it('từ chối ID giả, ID phiên khác và URL tùy ý trên wall', async () => {
    for (const id of [crypto.randomUUID(), photo.photoId]) {
      const response = await request(stranger, '/api/wall', 'PUT', { items: [wallItem(id)], background: '#fffdf7', revision: 0 });
      expect(response.status).toBe(403);
    }
    expect((await request(owner, '/api/wall', 'PUT', { items: [{ ...wallItem(photo.photoId), url: 'https://example.com/arbitrary.png' }], background: '#fffdf7', revision: 0 })).status).toBe(400);
  });
  it('từ chối xác thực, owner và origin do client tự gán', async () => {
    for (const field of ['photoId', 'ownerSessionId', 'verificationStatus', 'origin']) {
      expect((await request(owner, '/api/booth/upload/complete', 'POST', { ...payload(), [field]: 'forged' })).status).toBe(400);
    }
    expect((await request(owner, '/api/booth/upload/complete', 'POST', { ...payload(), consent: false })).status).toBe(400);
  });
  it('kiểm tra nội dung file, không tin MIME/base64 và số ảnh', async () => {
    const bad = payload(); bad.photos[0].originalSrc = 'data:image/png;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
    expect((await request(owner, '/api/booth/upload/complete', 'POST', bad)).status).toBe(400);
    const mismatch = payload(); mismatch.photos[0].originalSrc = originalSrc.replace('image/png', 'image/jpeg');
    expect((await request(owner, '/api/booth/upload/complete', 'POST', mismatch)).status).toBe(400);
    expect((await request(owner, '/api/booth/upload/complete', 'POST', { ...payload(), layoutId: 'grid6' })).status).toBe(400);
    expect((await request(owner, '/api/booth/upload/complete', 'POST', { ...payload(), photos: [{ originalSrc, edit: { ...defaultEdit, brightness: 999 } }] })).status).toBe(400);
  });
  it('chặn CSRF và Origin ngoài danh sách', async () => {
    const body = { items: [], background: '#fffdf7', revision: 0 };
    expect((await request(owner, '/api/wall', 'PUT', body, { 'X-CSRF-Token': '' })).status).toBe(403);
    expect((await request(owner, '/api/wall', 'PUT', body, { Origin: 'https://evil.example' })).status).toBe(403);
    expect((await request(owner, '/api/wall', 'PUT', body, { 'X-CSRF-Token': 'a'.repeat(64) })).status).toBe(403);
  });
  it('lưu đủ transform/layer/ghi chú; kiểm tra phiên bản và tồn tại sau restart', async () => {
    const item = wallItem(photo.photoId);
    const note: WallItem = { id: crypto.randomUUID(), type: 'note', text: '<script>vẫn chỉ là chữ</script>', color: '#fff1bf', x: 400, y: 200, width: 200, height: 180, rotation: -10 };
    const body = { items: [item, note], background: '#fffdf7', revision: 0 };
    const response = await request(owner, '/api/wall', 'PUT', body); expect(response.status).toBe(200);
    expect((await response.json()).revision).toBe(1);
    expect((await request(owner, '/api/wall', 'PUT', body)).status).toBe(409);
    await close(); await start();
    const saved = await (await request(owner, '/api/wall')).json(); expect(saved.items).toEqual(body.items); expect(saved.revision).toBe(1);
    expect((await (await request(stranger, '/api/wall')).json()).items).toEqual([]);
    expect((await request(owner, '/api/photos/' + photo.photoId, 'DELETE')).status).toBe(409);
    expect((await request(stranger, '/api/photos/' + photo.photoId, 'DELETE')).status).toBe(404);
  });
  it('chống tạo bản sao khi retry và xóa thật cả record/asset/phiên', async () => {
    const body = payload();
    const first = await (await request(owner, '/api/booth/camera/complete', 'POST', body)).json();
    const second = await (await request(owner, '/api/booth/camera/complete', 'POST', body)).json();
    expect(first.photo.photoId).toBe(second.photo.photoId); expect(first.photo.origin).toBe('camera');
    expect((await request(owner, '/api/photos/' + first.photo.photoId, 'DELETE')).status).toBe(204);
    expect((await request(owner, first.photo.url)).status).toBe(404);
    expect((await request(owner, '/api/session', 'DELETE')).status).toBe(204);
    expect((await request(owner, photo.url)).status).toBe(401);
  });
});
