import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import type { Server } from 'node:http';
import { createService } from './app';
import { FileObjectStore } from './storage';
import { DAY } from './database';
import { defaultEdit } from '../src/lib/filters';
import type { PhotoRecord } from '../src/lib/wall';

const paths: string[] = [], closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closers.splice(0)) await close(); for (const p of paths.splice(0)) rmSync(p, { recursive: true, force: true }); });
class FailingStore extends FileObjectStore {
  fail = false;
  override async delete(key: string) { if (this.fail) throw new Error('offline'); return super.delete(key); }
}
async function setup(legacy?: (path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'photobeo-v3-')); paths.push(dir); const database = join(dir, 'test.sqlite'); legacy?.(database);
  let clock = Date.parse('2026-11-18T10:00:00.000Z'); const storage = new FailingStore(join(dir, 'objects'));
  const service = createService({ database, storage, origins: ['http://localhost:5173'], secure: false, now: () => clock }); await service.ready;
  const server: Server = service.app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  closers.push(async () => { server.closeIdleConnections(); await new Promise<void>(r => server.close(() => r())); await service.close(); });
  type Client = { cookie: string; csrf: string };
  async function client(): Promise<Client> { const res = await fetch(base + '/api/session'), data = await res.json(); return { cookie: res.headers.get('set-cookie')!.split(';')[0], csrf: data.csrfToken }; }
  const req = (c: Client, path: string, method = 'GET', body?: unknown) => fetch(base + path, { method, headers: { Cookie: c.cookie, Origin: 'http://localhost:5173', 'X-CSRF-Token': c.csrf, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const canvas = createCanvas(100, 100); canvas.getContext('2d').fillRect(0, 0, 100, 100);
  async function photo(c: Client): Promise<PhotoRecord> {
    const res = await req(c, '/api/booth/upload/complete', 'POST', { consent: true, requestId: randomUUID(), layoutId: 'polaroid', options: { frame: 'pastel', color: '#ffe4ee', caption: '', showDate: true }, photos: [{ originalSrc: canvas.toDataURL(), edit: defaultEdit }] });
    expect(res.status).toBe(201); return (await res.json()).photo;
  }
  return { dir, database, storage, service, client, req, photo, advance: (n: number) => { clock += n; }, now: () => clock };
}
describe('Lịch sử 30 ngày, bản sao lâu dài và cleanup retry', () => {
  it('hết hạn chính xác; Wall tồn tại, khôi phục tài khoản sau khi cookie hết hạn; xóa riêng từng kho', async () => {
    const x = await setup(), owner = await x.client(), stranger = await x.client(), p = await x.photo(owner);
    expect(Date.parse(p.expiresAt!) - Date.parse(p.createdAt)).toBe(30 * DAY);
    expect(p).toHaveProperty('sessionId'); expect(p.userId).toBeTruthy(); expect(p.filter).toHaveLength(1); expect(p.template.layoutId).toBe('polaroid');
    expect(existsSync(join(x.dir, 'objects', p.storageKey))).toBe(true);
    const pin = await x.req(owner, '/api/wall/assets', 'POST', { photoId: p.photoId }); expect(pin.status).toBe(200);
    const permanent = (await pin.json()).photo as PhotoRecord;
    expect(permanent.expiresAt).toBeNull(); expect(permanent.storageKey).not.toBe(p.storageKey);
    expect((await x.req(stranger, '/api/wall/assets', 'POST', { photoId: p.photoId })).status).toBe(403);
    expect((await x.req(stranger, permanent.url)).status).toBe(404);
    const body = { items: [{ id: randomUUID(), type: 'photo', photoId: p.photoId, x: 100, y: 100, width: p.width / p.height * 300, height: 300, rotation: 10 }], background: '#fffdf7', revision: 0 };
    expect((await x.req(owner, '/api/wall', 'PUT', body)).status).toBe(200);
    const recovery = (await (await x.req(owner, '/api/account/recovery-key', 'POST')).json()).recoveryKey;
    x.advance(30 * DAY - 1); await x.service.cleanup(); expect(existsSync(join(x.dir, 'objects', p.storageKey))).toBe(true);
    x.advance(1); await x.service.cleanup(); expect(existsSync(join(x.dir, 'objects', p.storageKey))).toBe(false);
    expect(existsSync(join(x.dir, 'objects', permanent.storageKey))).toBe(true);
    const current = await x.client(); const restored = await x.req(current, '/api/account/restore', 'POST', { recoveryKey: recovery }); expect(restored.status).toBe(200);
    const session = await restored.json(); const restoredOwner = { cookie: restored.headers.get('set-cookie')!.split(';')[0], csrf: session.csrfToken };
    expect((await (await x.req(restoredOwner, '/api/photos')).json()).photos).toEqual([]);
    expect((await (await x.req(restoredOwner, '/api/wall')).json()).items).toEqual(body.items);
    const list = (await (await x.req(restoredOwner, '/api/wall/photos')).json()).photos;
    expect(list).toHaveLength(1); expect((await x.req(restoredOwner, list[0].url)).status).toBe(200);
    expect((await x.req(restoredOwner, '/api/wall/assets/' + p.photoId, 'DELETE')).status).toBe(409);
    expect((await x.req(restoredOwner, '/api/wall', 'DELETE')).status).toBe(204);
    expect(existsSync(join(x.dir, 'objects', permanent.storageKey))).toBe(false);
    const db = new DatabaseSync(x.database); expect((db.prepare('SELECT COUNT(*) n FROM photos').get() as any).n).toBe(0); expect((db.prepare('SELECT COUNT(*) n FROM wall_items').get() as any).n).toBe(0); db.close();
  });
  it('lỗi Storage vẫn ẩn ảnh hết hạn, giữ outbox qua restart và xóa idempotent khi chạy lại', async () => {
    const x = await setup(), owner = await x.client(), p = await x.photo(owner);
    x.storage.fail = true; x.advance(30 * DAY);
    expect((await x.service.cleanup()).pendingDeletes).toBe(1);
    const current = await x.client(); expect((await (await x.req(current, '/api/photos')).json()).photos).toEqual([]);
    const db = new DatabaseSync(x.database); expect((db.prepare('SELECT COUNT(*) n FROM photos').get() as any).n).toBe(0); expect((db.prepare('SELECT COUNT(*) n FROM deletion_outbox').get() as any).n).toBe(1); db.close();
    expect(existsSync(join(x.dir, 'objects', p.storageKey))).toBe(true);
    // Reopen the database after shutting down the first service; the outbox is durable.
    await closers.pop()!();
    x.storage.fail = false;
    const restarted = createService({ database: x.database, storage: x.storage, origins: ['http://localhost:5173'], secure: false, now: x.now });
    closers.push(() => restarted.close()); await restarted.ready;
    expect((await restarted.cleanup()).pendingDeletes).toBe(0); expect((await restarted.cleanup()).pendingDeletes).toBe(0);
    expect(existsSync(join(x.dir, 'objects', p.storageKey))).toBe(false);
  });
  it('signed URL hết hạn hoặc bị sửa không truy cập được; refresh phát URL mới', async () => {
    const x = await setup(), owner = await x.client(), p = await x.photo(owner);
    expect((await x.req(owner, p.url.replace('signature=', 'signature=x'))).status).toBe(403);
    x.advance(300_001); expect((await x.req(owner, p.url)).status).toBe(403);
    const refreshed = (await (await x.req(owner, '/api/photos')).json()).photos[0]; expect((await x.req(owner, refreshed.url)).status).toBe(200);
  });
  it('migration v2 giữ photoId, cookie và Wall, tạo hai object độc lập; chạy lại an toàn', async () => {
    const user = randomUUID(), photoId = randomUUID(), assetId = randomUUID(), token = 'a'.repeat(64), csrf = 'b'.repeat(64);
    const x = await setup(path => {
      const db = new DatabaseSync(path); db.exec(`CREATE TABLE sessions(id TEXT PRIMARY KEY,tokenHash TEXT,csrf TEXT,expires INTEGER); CREATE TABLE photos(photoId TEXT PRIMARY KEY,assetId TEXT,ownerSessionId TEXT,createdAt TEXT,origin TEXT,verificationStatus TEXT,photoBeoVersion TEXT,width INTEGER,height INTEGER,bytes INTEGER,requestId TEXT); CREATE TABLE assets(assetId TEXT,data BLOB); CREATE TABLE walls(owner TEXT,document TEXT,revision INTEGER,updatedAt TEXT);`);
      db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(user, createHash('sha256').update(token).digest('hex'), csrf, Date.parse('2026-12-01T00:00:00Z'));
      const png = createCanvas(100,100).toBuffer('image/png');
      db.prepare('INSERT INTO photos VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(photoId,assetId,user,'2026-11-17T00:00:00.000Z','upload','verified','2.0.0',100,100,png.length,randomUUID());
      db.prepare('INSERT INTO assets VALUES (?,?)').run(assetId,png);
      db.prepare('INSERT INTO walls VALUES (?,?,?,?)').run(user,JSON.stringify({items:[{id:randomUUID(),type:'photo',photoId,x:0,y:0,width:100,height:100,rotation:0}],background:'#fffdf7'}),1,'2026-11-17T00:00:00.000Z'); db.close();
    });
    const owner = { cookie: 'photobeo_session=' + token, csrf };
    const history = (await (await x.req(owner, '/api/photos')).json()).photos, wall = (await (await x.req(owner, '/api/wall/photos')).json()).photos;
    expect(history[0].photoId).toBe(photoId); expect(wall[0].photoId).toBe(photoId); expect(wall[0].permanent).toBe(true); expect(history[0].storageKey).not.toBe(wall[0].storageKey);
    expect((await x.req(owner, wall[0].url)).status).toBe(200);
    const db = new DatabaseSync(x.database); expect((db.prepare('PRAGMA user_version').get() as any).user_version).toBe(3); expect((db.prepare('SELECT COUNT(*) n FROM migration_blobs').get() as any).n).toBe(0); db.close();
    await closers.pop()!();
    const reopened = createService({ database: x.database, storage: x.storage, origins: ['http://localhost:5173'], secure: false, now: x.now });
    closers.push(() => reopened.close()); await reopened.ready;
    const check = new DatabaseSync(x.database); expect((check.prepare('SELECT COUNT(*) n FROM photo_assets').get() as any).n).toBe(2); check.close();
  });
  it('pin retry không tạo thêm object; xóa Wall không xóa lịch sử còn hạn', async () => {
    const x = await setup(), owner = await x.client(), p = await x.photo(owner);
    const first = (await (await x.req(owner, '/api/wall/assets', 'POST', { photoId: p.photoId })).json()).photo;
    const second = (await (await x.req(owner, '/api/wall/assets', 'POST', { photoId: p.photoId })).json()).photo;
    expect(second.assetId).toBe(first.assetId);
    expect((await x.req(owner, '/api/wall', 'DELETE')).status).toBe(204);
    expect((await x.req(owner, p.url)).status).toBe(200);
    expect(existsSync(join(x.dir, 'objects', first.storageKey))).toBe(false);
    expect((await (await x.req(owner, '/api/photos')).json()).photos).toHaveLength(1);
  });
});
