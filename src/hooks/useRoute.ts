import { useSyncExternalStore } from 'react';
const subscribe = (listener: () => void) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); };
export function navigate(path: string) { window.history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0); }
export function useRoute() { return useSyncExternalStore(subscribe, () => window.location.pathname); }
