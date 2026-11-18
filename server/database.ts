import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export const DAY = 86_400_000;
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (err) { db.exec('ROLLBACK'); throw err; }
}
/** Versioned, transactional migration. Legacy blobs remain staged until object writes succeed. */
export function migrate(db: DatabaseSync) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;');
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  if (version > 3) throw new Error('Database version newer than this server');
  if (version === 3) return;
  transaction(db, () => {
    const legacy = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
    if (legacy) db.exec('ALTER TABLE photos RENAME TO legacy_photos; ALTER TABLE assets RENAME TO legacy_assets; ALTER TABLE walls RENAME TO legacy_walls; ALTER TABLE sessions RENAME TO legacy_sessions;');
    db.exec(`
      CREATE TABLE users (userId TEXT PRIMARY KEY, createdAt TEXT NOT NULL, recoveryHash TEXT UNIQUE);
      CREATE TABLE sessions (sessionId TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users ON DELETE CASCADE, tokenHash TEXT UNIQUE NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE photo_sessions (sessionId TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users ON DELETE CASCADE, createdAt TEXT NOT NULL, workflow TEXT NOT NULL);
      CREATE TABLE photo_assets (assetId TEXT PRIMARY KEY, photoId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES users ON DELETE CASCADE, storageKey TEXT UNIQUE NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('temporary','permanent')), state TEXT NOT NULL CHECK(state IN ('pending','ready')), createdAt TEXT NOT NULL, bytes INTEGER NOT NULL, metadata TEXT NOT NULL,
        UNIQUE(userId,photoId,kind));
      CREATE TABLE photos (photoId TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users ON DELETE CASCADE, sessionId TEXT NOT NULL REFERENCES photo_sessions,
        assetId TEXT UNIQUE NOT NULL REFERENCES photo_assets, createdAt TEXT NOT NULL, expiresAt TEXT NOT NULL, filter TEXT NOT NULL, template TEXT NOT NULL, requestId TEXT NOT NULL,
        UNIQUE(userId,requestId));
      CREATE TABLE memory_walls (owner TEXT PRIMARY KEY REFERENCES users ON DELETE CASCADE, document TEXT NOT NULL, revision INTEGER NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE wall_items (itemId TEXT NOT NULL, owner TEXT NOT NULL REFERENCES memory_walls ON DELETE CASCADE, position INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(owner,itemId));
      CREATE TABLE deletion_outbox (storageKey TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, lastError TEXT);
      CREATE TABLE migration_blobs (storageKey TEXT PRIMARY KEY, data BLOB NOT NULL);
      CREATE INDEX photos_expiration ON photos(expiresAt);
      CREATE INDEX photos_user_created ON photos(userId,createdAt);
      CREATE INDEX assets_user_kind ON photo_assets(userId,kind,state);
      CREATE INDEX sessions_expiration ON sessions(expires);
    `);
    if (legacy) {
      const sessions = db.prepare('SELECT * FROM legacy_sessions').all() as unknown as { id: string; tokenHash: string; csrf: string; expires: number }[];
      for (const s of sessions) {
        db.prepare('INSERT INTO users VALUES (?,?,NULL)').run(s.id, new Date(s.expires - 30 * DAY).toISOString());
        db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').run(s.id, s.id, s.tokenHash, s.csrf, s.expires);
      }
      const photos = db.prepare('SELECT p.*,a.data FROM legacy_photos p JOIN legacy_assets a USING(assetId)').all() as unknown as Record<string, any>[];
      const walls = db.prepare('SELECT * FROM legacy_walls').all() as unknown as { owner: string; document: string; revision: number; updatedAt: string }[];
      for (const p of photos) {
        const { data, requestId, bytes, ...meta } = p;
        const sessionId = randomUUID(), expiresAt = new Date(Date.parse(p.createdAt) + 30 * DAY).toISOString();
        Object.assign(meta, { userId: p.ownerSessionId, sessionId, expiresAt, filter: [], template: { layoutId: 'legacy' } });
        db.prepare('INSERT INTO photo_sessions VALUES (?,?,?,?)').run(sessionId, p.ownerSessionId, p.createdAt, p.origin);
        for (const kind of ['temporary', ...(walls.some(w => w.owner === p.ownerSessionId && JSON.parse(w.document).items.some((i: any) => i.photoId === p.photoId)) ? ['permanent'] : [])]) {
          const assetId = kind === 'temporary' ? p.assetId : randomUUID(), key = `${kind}/${assetId}.png`;
          db.prepare('INSERT INTO photo_assets VALUES (?,?,?,?,?,?,?,?,?)').run(assetId, p.photoId, p.ownerSessionId, key, kind, 'pending', p.createdAt, bytes, JSON.stringify({ ...meta, expiresAt: kind === 'permanent' ? null : expiresAt }));
          db.prepare('INSERT INTO migration_blobs VALUES (?,?)').run(key, data);
        }
        db.prepare('INSERT INTO photos VALUES (?,?,?,?,?,?,?,?,?)').run(p.photoId, p.ownerSessionId, sessionId, p.assetId, p.createdAt, expiresAt, '[]', '{"layoutId":"legacy"}', requestId);
      }
      for (const w of walls) {
        db.prepare('INSERT INTO memory_walls VALUES (?,?,?,?)').run(w.owner, w.document, w.revision, w.updatedAt);
        JSON.parse(w.document).items.forEach((i: any, n: number) => db.prepare('INSERT INTO wall_items VALUES (?,?,?,?)').run(i.id, w.owner, n, JSON.stringify(i)));
      }
      db.exec('DROP TABLE legacy_assets; DROP TABLE legacy_photos; DROP TABLE legacy_walls; DROP TABLE legacy_sessions;');
    }
    db.exec('PRAGMA user_version=3');
  });
}
