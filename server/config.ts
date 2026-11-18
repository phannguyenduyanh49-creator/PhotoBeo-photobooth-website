import { resolve } from 'node:path';
import { FileObjectStore, S3ObjectStore } from './storage';
export function configuration() {
  const secure = process.env.NODE_ENV === 'production';
  const origins = (process.env.FRONTEND_ORIGIN || (secure ? '' : 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001')).split(',').filter(Boolean);
  if (!origins.length || (secure && origins.some(o => !o.startsWith('https://')))) throw new Error('FRONTEND_ORIGIN phải là HTTPS trên production.');
  const directory = resolve(process.env.PHOTO_BEO_DATA_DIR || '.data');
  if (process.env.STORAGE_DRIVER && !['local', 's3'].includes(process.env.STORAGE_DRIVER)) throw new Error('Unknown STORAGE_DRIVER');
  if (process.env.STORAGE_DRIVER === 's3' && !process.env.S3_BUCKET) throw new Error('Missing S3_BUCKET');
  const storage = process.env.STORAGE_DRIVER === 's3'
    ? new S3ObjectStore(process.env.S3_BUCKET!, process.env.AWS_REGION || 'us-east-1', process.env.S3_ENDPOINT)
    : new FileObjectStore(resolve(process.env.PHOTO_BEO_OBJECT_DIR || resolve(directory, 'objects')));
  return { database: resolve(directory, 'photobeo.sqlite'), origins, secure, storage, trustProxy: process.env.TRUST_PROXY === '1' };
}
