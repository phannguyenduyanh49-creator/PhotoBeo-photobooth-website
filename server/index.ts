import { resolve } from 'node:path';
import { createService } from './app';

const production = process.env.NODE_ENV === 'production';
const origins = (process.env.FRONTEND_ORIGIN || (production ? '' : 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001')).split(',').filter(Boolean);
if (!origins.length || (production && origins.some(origin => !origin.startsWith('https://')))) throw new Error('Cấu hình FRONTEND_ORIGIN với HTTPS trước khi chạy production.');
const service = createService({ database: resolve(process.env.PHOTO_BEO_DATA_DIR || '.data', 'photobeo.sqlite'), origins, secure: production, serveDist: true, trustProxy: process.env.TRUST_PROXY === '1' });
const server = service.app.listen(Number(process.env.PORT) || 3001, process.env.HOST || '127.0.0.1', () => console.log(`PhotoBeo API: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001}`));
server.requestTimeout = 60_000;
function close() { server.close(() => { service.close(); process.exit(0); }); server.closeIdleConnections(); }
process.on('SIGINT', close); process.on('SIGTERM', close);
