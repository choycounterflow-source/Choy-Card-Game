/**
 * Clears browser Cache Storage, unregisters stale PWA Service Workers,
 * clears local/session storage cache, and reloads fresh from the server.
 */
export async function clearAppCacheAndReload(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // Ignore restricted cache storage environments
  }

  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    // Ignore restricted SW environments
  }

  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.clear();
  } catch {
    // ignore
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('cache_cleared', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}
