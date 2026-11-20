export const FALLBACK_SHARED_APP_URL =
  'https://ais-pre-esajh5tb77exk5tdp6dme7-893033407659.asia-northeast1.run.app';

/**
 * Ensures any development preview URL (`ais-dev-...`) is converted to the
 * public shareable URL (`ais-pre-...`) so invited players never hit a private
 * developer redirect page.
 */
export function normalizeToPublicShareUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return FALLBACK_SHARED_APP_URL;

  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    if (parsed.hostname.startsWith('ais-dev-')) {
      parsed.hostname = parsed.hostname.replace(/^ais-dev-/, 'ais-pre-');
    }
    // Never share localhost or the Google AI Studio editor domain itself
    if (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname.includes('aistudio.google.com')
    ) {
      return FALLBACK_SHARED_APP_URL;
    }
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    if (trimmed.includes('ais-dev-')) {
      return trimmed.replace('://ais-dev-', '://ais-pre-');
    }
    return FALLBACK_SHARED_APP_URL;
  }
}

export function buildPlayerShareLink(baseUrl: string, referralCode?: string | null): string {
  const cleanBase = normalizeToPublicShareUrl(baseUrl);
  const code = (referralCode || '').trim();
  if (!code) return `${cleanBase}/`;
  return `${cleanBase}/?ref=${encodeURIComponent(code)}`;
}

/**
 * Reliable clipboard copy that works both in standard tabs and inside sandboxed iframes.
 */
export async function copyTextReliable(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below for iframe clipboard restrictions
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
