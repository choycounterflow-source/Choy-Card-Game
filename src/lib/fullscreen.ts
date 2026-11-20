/**
 * Full-screen & auto-landscape helpers for active game tables and slot machines.
 * Safely degrades on browsers/iOS WebViews that restrict Fullscreen or Screen Orientation APIs.
 */

interface VendorFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface VendorFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface OrientationLockable {
  lock?: (orientation: 'landscape' | 'portrait' | 'any') => Promise<void>;
  unlock?: () => void;
}

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as VendorFullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export async function requestGameFullscreenLandscape(): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  try {
    const el = document.documentElement as VendorFullscreenElement;
    if (!isFullscreenActive()) {
      if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => el.requestFullscreen());
      } else if (typeof el.webkitRequestFullscreen === 'function') {
        await el.webkitRequestFullscreen();
      }
    }
  } catch {
    // Fullscreen may be blocked outside a direct user gesture or on iOS Safari; ignore cleanly
  }

  try {
    const orientation = (window.screen?.orientation ?? null) as OrientationLockable | null;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape');
    }
  } catch {
    // Orientation lock is supported primarily in fullscreen/PWA on mobile Android; ignore cleanly
  }

  return isFullscreenActive();
}

export async function exitGameFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;

  try {
    const orientation = (window.screen?.orientation ?? null) as OrientationLockable | null;
    if (orientation && typeof orientation.unlock === 'function') {
      orientation.unlock();
    }
  } catch {
    // Ignore unsupported unlock
  }

  try {
    const doc = document as VendorFullscreenDocument;
    if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
    } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // Ignore if already exited
  }
}

export async function toggleGameFullscreenLandscape(): Promise<boolean> {
  if (isFullscreenActive()) {
    await exitGameFullscreen();
    return false;
  }
  return requestGameFullscreenLandscape();
}
