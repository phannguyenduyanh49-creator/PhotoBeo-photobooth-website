import { useCallback, useEffect, useRef, useState } from 'react';
import { countdown, delay } from '../lib/countdown';

export function useCapture() {
  const controller = useRef<AbortController | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const cancel = useCallback(() => { controller.current?.abort(); }, []);
  const run = useCallback(async (slots: number[], seconds: number, capture: (slot: number) => void, onError: (error: unknown) => void) => {
    if (controller.current || !slots.length) return;
    const current = new AbortController(); controller.current = current; setBusy(true);
    try {
      for (let i = 0; i < slots.length; i++) {
        await countdown(seconds, current.signal, setRemaining);
        if (current.signal.aborted) break;
        capture(slots[i]); setFlash(true);
        clearTimeout(flashTimer.current); flashTimer.current = setTimeout(() => setFlash(false), 180);
        if (i < slots.length - 1) await delay(700, current.signal);
      }
    } catch (err) { if (!(err instanceof DOMException && err.name === 'AbortError')) onError(err); }
    finally { controller.current = null; setBusy(false); setRemaining(null); }
  }, []);
  useEffect(() => () => { controller.current?.abort(); clearTimeout(flashTimer.current); }, []);
  return { busy, remaining, flash, run, cancel };
}
