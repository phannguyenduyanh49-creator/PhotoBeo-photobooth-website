import type { PhotoRecord, SavedWall, WallDocument } from './wall';
import type { FrameOptions, LayoutId, Photo } from './layouts';

type Session = { sessionId: string; csrfToken: string; expiresAt: string };
let pendingSession: Promise<Session> | null = null;
export function getSession() {
  if (!pendingSession) pendingSession = fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' })
    .then(readJson<Session>).catch(error => { pendingSession = null; throw error; });
  return pendingSession;
}
async function readJson<T>(res: Response): Promise<T> {
  if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('Góc kỷ niệm chưa kết nối máy chủ. Hãy chạy backend hoặc kiểm tra cấu hình API.');
  const data = await res.json();
  if (!res.ok) { if (res.status === 401) pendingSession = null; throw new Error(data.error || 'Không thể kết nối máy chủ.'); }
  return data as T;
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const session = await getSession();
  const res = await fetch('/api' + path, { method, credentials: 'same-origin', cache: 'no-store', headers: {
    ...(method !== 'GET' ? { 'X-CSRF-Token': session.csrfToken } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return undefined as T;
  return readJson<T>(res);
}
export const getPhotos = () => request<{ photos: PhotoRecord[] }>('/photos');
export const getWall = () => request<SavedWall>('/wall');
export const saveWall = (wall: WallDocument, revision: number) => request<SavedWall>('/wall', 'PUT', { ...wall, revision });
export const deletePhoto = (id: string) => request<void>('/photos/' + encodeURIComponent(id), 'DELETE');
export async function deleteSession() { await request<void>('/session', 'DELETE'); pendingSession = null; }
export async function registerPhoto(photos: Photo[], layoutId: LayoutId, options: FrameOptions, requestId: string) {
  const workflow = photos.every(p => p.origin === 'camera') ? 'camera' : 'upload';
  return request<{ photo: PhotoRecord }>(`/booth/${workflow}/complete`, 'POST', {
    consent: true, requestId, layoutId,
    options: { frame: options.frame, color: options.color, caption: options.caption, showDate: options.showDate },
    photos: photos.map(p => ({ originalSrc: p.originalSrc, edit: p.edit })),
  });
}
