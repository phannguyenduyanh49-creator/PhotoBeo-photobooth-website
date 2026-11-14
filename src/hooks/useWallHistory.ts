import { useRef, useState } from 'react';
import { emptyWall, type WallDocument } from '../lib/wall';

export function useWallHistory() {
  const [state, setState] = useState({ past: [] as WallDocument[], present: emptyWall, future: [] as WallDocument[] });
  const stateRef = useRef(state); stateRef.current = state;
  const baseline = useRef<WallDocument | null>(null);
  function put(next: typeof state) { stateRef.current = next; setState(next); }
  function reset(doc: WallDocument) { baseline.current = null; put({ past: [], present: doc, future: [] }); }
  function change(doc: WallDocument) {
    const current = stateRef.current;
    if (JSON.stringify(current.present) === JSON.stringify(doc)) return;
    put({ past: [...current.past, baseline.current || current.present].slice(-50), present: doc, future: [] }); baseline.current = null;
  }
  function begin() { baseline.current = stateRef.current.present; }
  function preview(doc: WallDocument) { put({ ...stateRef.current, present: doc }); }
  function commit() {
    if (!baseline.current) return;
    const current = stateRef.current, previous = baseline.current; baseline.current = null;
    if (JSON.stringify(previous) !== JSON.stringify(current.present)) put({ ...current, past: [...current.past, previous].slice(-50), future: [] });
  }
  function cancel() { if (baseline.current) { put({ ...stateRef.current, present: baseline.current }); baseline.current = null; } }
  function undo() { const s = stateRef.current; if (s.past.length) { baseline.current = null; put({ past: s.past.slice(0, -1), present: s.past.at(-1)!, future: [s.present, ...s.future] }); } }
  function redo() { const s = stateRef.current; if (s.future.length) { baseline.current = null; put({ past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }); } }
  return { ...state, reset, change, begin, preview, commit, cancel, undo, redo };
}
