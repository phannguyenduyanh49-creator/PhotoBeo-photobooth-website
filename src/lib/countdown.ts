export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Đã hủy', 'AbortError')); return; }
    const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(new DOMException('Đã hủy', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

export async function countdown(seconds: number, signal: AbortSignal, tick: (value: number | null) => void) {
  try {
    for (let remaining = seconds; remaining > 0; remaining--) {
      if (signal.aborted) throw new DOMException('Đã hủy', 'AbortError');
      tick(remaining); await delay(1000, signal);
    }
    if (signal.aborted) throw new DOMException('Đã hủy', 'AbortError');
  } finally { tick(null); }
}
