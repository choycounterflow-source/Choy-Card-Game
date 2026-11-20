import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { copyTextReliable } from '../lib/shareUrl';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'banner' }> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, isInAppBrowser, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  const isEmbedded = useMemo(() => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const directAppUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, []);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable && !isEmbedded && !isInAppBrowser) {
      const accepted = await install();
      if (!accepted) setShowGuide(true);
    } else {
      setShowGuide(true);
    }
  };

  const handleCopyUrl = async () => {
    if (!directAppUrl) return;
    const ok = await copyTextReliable(directAppUrl);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-[#06362a] to-emerald-900/60 p-3 shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/choy-face-192.png?v=3"
              alt="Choy Card Game Icon"
              referrerPolicy="no-referrer"
              className="h-11 w-11 rounded-xl object-cover border-2 border-amber-400/80 shadow-md shrink-0"
            />
            <div className="min-w-0">
              <p className="font-display text-xs sm:text-sm font-extrabold text-white truncate">
                Install Choy Card Game
              </p>
              <p className="text-[11px] text-emerald-200/90 leading-snug">
                {isInAppBrowser
                  ? 'Open in Chrome/Safari para ma-install sa Home Screen'
                  : '1-tap Home Screen app · Full-screen cards & slots'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-emerald-950 shadow-sm hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Install
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-emerald-950 shadow-sm hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          Install App
        </button>
      )}

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-700/80 bg-[#052920] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src="/choy-face-192.png?v=3"
                  alt="Choy Card Game App Icon"
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-2xl object-cover border-2 border-amber-400/70 shadow-lg shrink-0"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-amber-400" />
                    <h3 className="font-display text-lg font-bold text-white leading-tight">
                      Install Choy Card Game
                    </h3>
                  </div>
                  <p className="text-[11px] text-emerald-300">Choy Card Game · Standalone App</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-900 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isInAppBrowser ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-amber-400/45 bg-amber-950/45 p-3 text-xs text-amber-100 leading-relaxed">
                  <strong>Messenger / In-App Browser Detected:</strong> Dili mo-install direkta sulod sa Messenger o Facebook browser. Ablihi una sa <strong>Chrome</strong> (Android) o <strong>Safari</strong> (iPhone).
                </div>
                <ol className="space-y-2 text-xs text-emerald-100 leading-relaxed list-decimal list-inside">
                  <li>Tap the <strong>⋮</strong> (three dots) or <strong>Share</strong> icon at the top-right corner.</li>
                  <li>Choose <strong>Open in Chrome</strong> / <strong>Open in External Browser</strong> (or Copy Link below and paste in Chrome/Safari).</li>
                  <li>Tap <strong>Install App</strong> to add <strong>Choy Card Game</strong> to your Home Screen.</li>
                </ol>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 px-4 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Link Copied — Paste in Chrome/Safari!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy App Link for Chrome / Safari
                    </>
                  )}
                </button>
              </div>
            ) : isEmbedded ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-amber-400/40 bg-amber-950/40 p-3 text-xs text-amber-100 leading-relaxed">
                  <strong>Important:</strong> You are viewing inside an embedded preview frame. Open the direct app link in a new browser tab first, then tap <strong>Install App</strong>.
                </div>

                <div className="flex flex-col gap-2">
                  <a
                    href={directAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 px-4 text-sm font-bold text-emerald-950 hover:bg-amber-300 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Choy Card Game in Full Tab
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-950/70 py-2 px-4 text-xs font-semibold text-emerald-100 hover:bg-emerald-900 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Direct App Link Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-amber-300" />
                        Copy Direct App Link
                      </>
                    )}
                  </button>
                </div>

                <ol className="space-y-1.5 text-xs text-emerald-200/90 leading-relaxed list-decimal list-inside pt-1">
                  <li>Tap <strong>Open Choy Card Game in Full Tab</strong> (or paste the copied link in Chrome/Safari).</li>
                  <li>Once opened directly, tap Chrome&apos;s <strong>⋮ menu → Add to Home screen / Install app</strong>.</li>
                  <li>Verify the popup says <strong>Choy Card Game</strong> with your Joker icon before tapping Install.</li>
                </ol>
              </div>
            ) : isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-emerald-100 leading-relaxed list-decimal list-inside">
                <li>Tap the <strong>Share</strong> icon in your Safari toolbar.</li>
                <li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> to launch Choy Card Game full-screen like a native app.</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2.5 text-sm text-emerald-100 leading-relaxed list-decimal list-inside">
                <li>Open your Chrome menu (<strong>⋮</strong> three dots) at the top right.</li>
                <li>Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Confirm it says <strong>Choy Card Game</strong>, then tap <strong>Install</strong>.</li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl border border-emerald-700/80 bg-emerald-950/70 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-900 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-950/95 px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg">
      <WifiOff className="h-3.5 w-3.5 text-amber-400" />
      <span>Offline Mode — Cached view active</span>
    </div>
  );
};
