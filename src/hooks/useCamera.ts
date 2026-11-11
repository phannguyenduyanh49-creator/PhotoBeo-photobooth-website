import { useCallback, useEffect, useRef, useState } from 'react';

export function cameraError(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Bạn chưa cho phép truy cập camera. Hãy mở quyền camera trong trình duyệt rồi thử lại, hoặc tải ảnh từ máy.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'Không tìm thấy camera. Hãy kết nối webcam hoặc tải ảnh từ thiết bị.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'Camera đang bận hoặc không thể mở. Hãy đóng ứng dụng khác đang dùng camera rồi thử lại.';
  if (name === 'OverconstrainedError') return 'Camera này không còn khả dụng. Hãy chọn một camera khác.';
  return 'Không thể kết nối camera. Hãy kiểm tra thiết bị, quyền truy cập và thử lại.';
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState<'off' | 'loading' | 'ready' | 'error'>('off');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const stop = useCallback(() => { requestRef.current++; release(); setStatus('off'); setError(''); }, [release]);

  const start = useCallback(async (id?: string, side: 'user' | 'environment' = 'user') => {
    const request = ++requestRef.current;
    release(); setError(''); setStatus('loading');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera cần HTTPS hoặc localhost và trình duyệt hỗ trợ camera. Bạn vẫn có thể tải ảnh lên để tạo bộ ảnh.'); setStatus('error'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        width: { ideal: 1920 }, height: { ideal: 1440 },
        ...(id ? { deviceId: { exact: id } } : { facingMode: { ideal: side } }),
      } });
      if (request !== requestRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      track.onended = () => { if (request === requestRef.current) { release(); setError('Camera đã ngắt kết nối. Hãy bật lại camera hoặc tải ảnh lên.'); setStatus('error'); } };
      setDeviceId(track.getSettings().deviceId || id || ''); setFacing(side);
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      if (request !== requestRef.current) return;
      // enumerateDevices failure should not discard a working stream.
      try { const list = await navigator.mediaDevices.enumerateDevices(); if (request === requestRef.current) setDevices(list.filter(d => d.kind === 'videoinput')); } catch { /* camera remains usable */ }
    } catch (err) { if (request === requestRef.current) { release(); setError(cameraError(err)); setStatus('error'); } }
  }, [release]);
  const ready = useCallback(() => {
    if (streamRef.current?.active && videoRef.current?.videoWidth) setStatus('ready');
  }, []);
  useEffect(() => {
    const hide = () => stop();
    window.addEventListener('pagehide', hide);
    return () => { requestRef.current++; release(); window.removeEventListener('pagehide', hide); };
  }, [release, stop]);
  return { videoRef, status, error, devices, deviceId, facing, start, stop, ready };
}
