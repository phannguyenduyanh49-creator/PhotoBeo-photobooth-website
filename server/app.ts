import express, { type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { registrationSchema, wallSchema } from './schema';
import { renderRegisteredPhoto } from './render';
import type { PhotoRecord } from '../src/lib/wall';

type Config = { database: string; origins: string[]; secure: boolean; serveDist?: boolean; trustProxy?: boolean };
type Session = { id: string; csrf: string; expires: number };
type RecordRow = Omit<PhotoRecord, 'url'> & { bytes: number; requestId: string };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const safeEqual = (a: string, b: string) => { const first = Buffer.from(a), second = Buffer.from(b); return first.length === second.length && timingSafeEqual(first, second); };
const DAY = 86400_000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function createService(config: Config) {
  if (config.database !== ':memory:') mkdirSync(dirname(config.database), { recursive: true });
  const db = new DatabaseSync(config.database);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, tokenHash TEXT UNIQUE NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS photos (
      photoId TEXT PRIMARY KEY, assetId TEXT UNIQUE NOT NULL, ownerSessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      createdAt TEXT NOT NULL, origin TEXT NOT NULL, verificationStatus TEXT NOT NULL CHECK(verificationStatus='verified'),
      photoBeoVersion TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, bytes INTEGER NOT NULL,
      requestId TEXT NOT NULL, UNIQUE(ownerSessionId, requestId));
    CREATE TABLE IF NOT EXISTS assets (assetId TEXT PRIMARY KEY REFERENCES photos(assetId) ON DELETE CASCADE, data BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS walls (owner TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE, document TEXT NOT NULL, revision INTEGER NOT NULL, updatedAt TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS photos_owner ON photos(ownerSessionId, createdAt);`);
  const cleanup = () => db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  cleanup(); const cleanupTimer = setInterval(cleanup, 60 * 60_000); cleanupTimer.unref();
  const app = express(); app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  const cookieName = config.secure ? '__Host-photobeo' : 'photobeo_session';
  const cookieOptions = { httpOnly: true, sameSite: 'strict' as const, secure: config.secure, path: '/', maxAge: 30 * DAY };
  app.use('/api', (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin', 'Referrer-Policy': 'same-origin' }); next();
  });
  app.get('/api/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 150, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Bạn thao tác quá nhanh. Hãy thử lại sau một phút.' } }));
  function session(req: Request): Session | undefined {
    const token = (req.headers.cookie ?? '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
    return db.prepare('SELECT id, csrf, expires FROM sessions WHERE tokenHash=? AND expires>?').get(hash(token), Date.now()) as Session | undefined;
  }
  const createLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Quá nhiều phiên mới. Hãy thử lại sau.' } });
  app.get('/api/session', (req, res, next) => {
    const existing = session(req);
    if (existing) { res.json({ sessionId: existing.id, csrfToken: existing.csrf, expiresAt: new Date(existing.expires).toISOString() }); return; }
    createLimiter(req, res, next);
  }, (_req, res) => {
    const token = randomBytes(32).toString('hex'), id = randomUUID(), csrf = randomBytes(32).toString('hex'), expires = Date.now() + 30 * DAY;
    db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(id, hash(token), csrf, expires);
    res.cookie(cookieName, token, cookieOptions);
    res.json({ sessionId: id, csrfToken: csrf, expiresAt: new Date(expires).toISOString() });
  });
  app.use('/api', (req, res, next) => {
    const current = session(req);
    if (!current) { res.status(401).json({ error: 'Phiên riêng tư đã hết hạn. Hãy tải lại trang.' }); return; }
    res.locals.session = current;
    if (!['GET', 'HEAD'].includes(req.method)) {
      const csrf = req.get('X-CSRF-Token') ?? '';
      if (!config.origins.includes(req.get('Origin') ?? '') || !safeEqual(csrf, current.csrf)) {
        res.status(403).json({ error: 'Yêu cầu không thuộc phiên PhotoBeo này.' }); return;
      }
    }
    next();
  });
  const recordView = (row: RecordRow) => {
    const { bytes: _bytes, requestId: _requestId, ...record } = row;
    return { ...record, url: `/api/photos/${row.photoId}/image` };
  };
  const ownedPhoto = (photoId: string, owner: string) => uuid.test(photoId) ? db.prepare('SELECT * FROM photos WHERE photoId=? AND ownerSessionId=? AND verificationStatus=?').get(photoId, owner, 'verified') as RecordRow | undefined : undefined;
  app.get('/api/photos', (_req, res) => {
    const records = db.prepare('SELECT * FROM photos WHERE ownerSessionId=? ORDER BY createdAt DESC').all(res.locals.session.id) as RecordRow[];
    res.json({ photos: records.map(recordView) });
  });
  app.get('/api/photos/:id/image', (req, res) => {
    const photo = ownedPhoto(String(req.params.id), res.locals.session.id);
    if (!photo) { res.status(404).json({ error: 'Ảnh không tồn tại trong thư viện của bạn.' }); return; }
    const asset = db.prepare('SELECT data FROM assets WHERE assetId=?').get(photo.assetId) as { data: Uint8Array };
    res.type('png').send(Buffer.from(asset.data));
  });
  let rendering = 0;
  const busyOwners = new Set<string>();
  app.post('/api/booth/:workflow/complete', rateLimit({ windowMs: 60 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Đã đạt giới hạn đăng ký ảnh trong giờ này.' } }), express.json({ limit: '24mb' }), async (req, res) => {
    if (!['camera', 'upload'].includes(String(req.params.workflow))) { res.status(404).json({ error: 'Luồng đăng ký không hợp lệ.' }); return; }
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Ảnh, bố cục hoặc thông số chỉnh sửa không hợp lệ. Không nhận ID/trạng thái xác thực từ trình duyệt.' }); return; }
    const owner = res.locals.session.id as string;
    const previous = db.prepare('SELECT * FROM photos WHERE ownerSessionId=? AND requestId=?').get(owner, parsed.data.requestId) as RecordRow | undefined;
    if (previous) { res.json({ photo: recordView(previous) }); return; }
    const usage = db.prepare('SELECT COUNT(*) count, COALESCE(SUM(bytes),0) bytes FROM photos WHERE ownerSessionId=?').get(owner) as { count: number; bytes: number };
    const globalUsage = db.prepare('SELECT COALESCE(SUM(bytes),0) bytes FROM photos').get() as { bytes: number };
    const hourly = db.prepare('SELECT COUNT(*) count FROM photos WHERE ownerSessionId=? AND createdAt>?').get(owner, new Date(Date.now() - 3600_000).toISOString()) as { count: number };
    if (usage.count >= 100 || usage.bytes > 250 * 1024 * 1024 || hourly.count >= 20 || globalUsage.bytes > 2 * 1024 ** 3) { res.status(429).json({ error: 'Thư viện hoặc giới hạn lưu ảnh đã đầy. Hãy xóa ảnh cũ hoặc thử lại sau.' }); return; }
    if (rendering >= 2 || busyOwners.has(owner)) { res.status(429).json({ error: 'Đang xử lý ảnh khác. Hãy chờ một chút rồi thử lại.' }); return; }
    rendering++; busyOwners.add(owner);
    try {
      const createdAt = new Date().toISOString();
      const { png, width, height } = await renderRegisteredPhoto(parsed.data, createdAt);
      const photo: RecordRow = { photoId: randomUUID(), assetId: randomUUID(), ownerSessionId: owner, createdAt,
        origin: String(req.params.workflow) as 'camera' | 'upload', verificationStatus: 'verified', photoBeoVersion: '2.0.0', width, height, bytes: png.length, requestId: parsed.data.requestId };
      // Atomic record + private asset: a failed render/transaction cannot produce a verified record.
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT INTO photos VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(photo.photoId, photo.assetId, owner, createdAt, photo.origin, photo.verificationStatus, photo.photoBeoVersion, width, height, png.length, photo.requestId);
        db.prepare('INSERT INTO assets VALUES (?,?)').run(photo.assetId, png); db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      res.status(201).json({ photo: recordView(photo) });
    } catch { res.status(400).json({ error: 'Không thể xác thực ảnh nguồn. Hãy dùng ảnh tĩnh JPEG, PNG hoặc WebP hợp lệ rồi tạo lại thành phẩm.' }); }
    finally { rendering--; busyOwners.delete(owner); }
  });
  app.use('/api', express.json({ limit: '64kb' }));
  app.get('/api/wall', (_req, res) => {
    const row = db.prepare('SELECT * FROM walls WHERE owner=?').get(res.locals.session.id) as { document: string; revision: number; updatedAt: string } | undefined;
    res.json(row ? { ...JSON.parse(row.document), revision: row.revision, updatedAt: row.updatedAt } : { items: [], background: '#fffdf7', revision: 0, updatedAt: null });
  });
  app.put('/api/wall', (req, res) => {
    const parsed = wallSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Bố cục không hợp lệ. Chỉ dùng ảnh đã đăng ký, sticker và ghi chú của PhotoBeo.' }); return; }
    const owner = res.locals.session.id;
    for (const item of parsed.data.items) if (item.type === 'photo') {
      const photo = ownedPhoto(item.photoId!, owner);
      if (!photo) { res.status(403).json({ error: 'Ảnh chưa được PhotoBeo xác thực hoặc không thuộc thư viện của bạn.' }); return; }
      if (Math.abs(item.width / item.height - photo.width / photo.height) > .01) { res.status(400).json({ error: 'Ảnh phải giữ đúng tỷ lệ gốc.' }); return; }
    }
    const existing = db.prepare('SELECT revision FROM walls WHERE owner=?').get(owner) as { revision: number } | undefined;
    if ((existing?.revision ?? 0) !== parsed.data.revision) { res.status(409).json({ error: 'Bảng đã thay đổi ở tab khác. Hãy tải bản đã lưu trước khi sửa tiếp.' }); return; }
    const revision = (existing?.revision ?? 0) + 1, updatedAt = new Date().toISOString();
    const doc = { items: parsed.data.items, background: parsed.data.background };
    db.prepare('INSERT INTO walls VALUES (?,?,?,?) ON CONFLICT(owner) DO UPDATE SET document=excluded.document,revision=excluded.revision,updatedAt=excluded.updatedAt').run(owner, JSON.stringify(doc), revision, updatedAt);
    res.json({ ...doc, revision, updatedAt });
  });
  app.delete('/api/photos/:id', (req, res) => {
    const photo = ownedPhoto(String(req.params.id), res.locals.session.id);
    if (!photo) { res.status(404).json({ error: 'Không tìm thấy ảnh.' }); return; }
    const wall = db.prepare('SELECT document FROM walls WHERE owner=?').get(res.locals.session.id) as { document: string } | undefined;
    if (wall && JSON.parse(wall.document).items.some((item: { photoId?: string }) => item.photoId === photo.photoId)) { res.status(409).json({ error: 'Hãy gỡ ảnh khỏi bảng và lưu trước khi xóa khỏi thư viện.' }); return; }
    db.prepare('DELETE FROM photos WHERE photoId=? AND ownerSessionId=?').run(photo.photoId, res.locals.session.id);
    res.status(204).end();
  });
  app.delete('/api/session', (_req, res) => {
    if (busyOwners.has(res.locals.session.id)) { res.status(409).json({ error: 'Hãy chờ lưu ảnh xong rồi xóa phiên.' }); return; }
    db.prepare('DELETE FROM sessions WHERE id=?').run(res.locals.session.id);
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined }); res.status(204).end();
  });
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Đường dẫn API không tồn tại.' }); });
  if (config.serveDist) {
    app.use(express.static(resolve('dist')));
    app.get(['/', '/memory-wall'], (_req, res) => { res.sendFile(resolve('dist/index.html')); });
  }
  app.use((error: { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: error.type === 'entity.too.large' ? 'Dữ liệu vượt dung lượng cho phép.' : 'Yêu cầu không hợp lệ.' });
  });
  return { app, close: () => { clearInterval(cleanupTimer); db.close(); } };
}
