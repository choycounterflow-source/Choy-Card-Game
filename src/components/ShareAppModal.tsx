import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Globe,
  Link2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Send,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import type { UserProfile } from '../types';
import {
  buildPlayerShareLink,
  copyTextReliable,
  normalizeToPublicShareUrl,
} from '../lib/shareUrl';

interface ShareAppModalProps {
  user: UserProfile | null;
  shareOrigin: string;
  defaultShareOrigin: string;
  customShareOrigin: string;
  isPublicLive: boolean;
  shareHttpStatus: number;
  onRecheckShareConfig?: () => Promise<void>;
  onClose: () => void;
  onUpdatedShareOrigin?: (nextOrigin: string, nextCustom: string) => void;
}

export const ShareAppModal: React.FC<ShareAppModalProps> = ({
  user,
  shareOrigin,
  defaultShareOrigin,
  customShareOrigin,
  isPublicLive,
  shareHttpStatus,
  onRecheckShareConfig,
  onClose,
  onUpdatedShareOrigin,
}) => {
  const [includeRef, setIncludeRef] = useState<boolean>(Boolean(user?.referral_code));
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Admin custom public domain override
  const [adminUrlInput, setAdminUrlInput] = useState<string>(customShareOrigin);
  const [savingAdminUrl, setSavingAdminUrl] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  const finalShareLink = buildPlayerShareLink(
    shareOrigin,
    includeRef && user?.referral_code ? user.referral_code : null
  );

  const inviteMessage =
    user?.referral_code && includeRef
      ? `Tara dula ta sa Choy Card Game! Naay Tong-its (Regular/Butasan/Joker), Pusoy, Lucky 9, Color Game ug Super Ace Slot. Ablihi sa Chrome/Safari para ma-install dayon:\n${finalShareLink}`
      : `Tara dula ta sa Choy Card Game! Naay Tong-its, Pusoy, Lucky 9, Color Game ug Super Ace Slot. Ablihi sa Chrome/Safari para ma-install dayon:\n${finalShareLink}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(finalShareLink, {
      width: 220,
      margin: 2,
      color: {
        dark: '#031c16',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [finalShareLink]);

  const handleRecheck = async () => {
    if (!onRecheckShareConfig || rechecking) return;
    setRechecking(true);
    try {
      await onRecheckShareConfig();
    } finally {
      setRechecking(false);
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyTextReliable(finalShareLink);
    if (ok) {
      setCopiedLink(true);
      setShareFeedback('Link copied! Paste it into Messenger, Viber, WhatsApp, or SMS.');
      setTimeout(() => setCopiedLink(false), 2400);
    } else {
      setShareFeedback('Tap and hold the link box above to copy manually.');
    }
  };

  const handleCopyMessage = async () => {
    const ok = await copyTextReliable(inviteMessage);
    if (ok) {
      setCopiedMsg(true);
      setShareFeedback('Full invite message copied! Paste and send to your friends.');
      setTimeout(() => setCopiedMsg(false), 2400);
    } else {
      setShareFeedback('Unable to access clipboard automatically. Please copy the link box.');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Choy Card Game — Play Tong-its, Pusoy & Super Ace',
          text:
            user?.referral_code && includeRef
              ? `Tara dula ta sa Choy Card Game! Use my invite code ${user.referral_code}:`
              : 'Tara dula ta sa Choy Card Game — Tong-its, Pusoy, Lucky 9, Color Game & Super Ace!',
          url: finalShareLink,
        });
        setShareFeedback('Shared successfully!');
        return;
      } catch {
        // User canceled or iframe blocked navigator.share — fallback to copy
      }
    }
    await handleCopyLink();
  };

  const handleSaveAdminUrl = async (resetToDefault = false) => {
    if (!user || user.role !== 'admin') return;
    setSavingAdminUrl(true);
    setAdminMsg(null);
    const valueToSave = resetToDefault ? '' : adminUrlInput.trim();
    try {
      const res = await fetch('/api/admin/system-config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': user.id,
        },
        body: JSON.stringify({ public_share_url: valueToSave }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminMsg(data.error || 'Could not save public link.');
      } else {
        const savedCustom = String(data.systemConfig?.public_share_url || '');
        const resolved = savedCustom ? normalizeToPublicShareUrl(savedCustom) : defaultShareOrigin;
        setAdminUrlInput(savedCustom);
        onUpdatedShareOrigin?.(resolved, savedCustom);
        if (onRecheckShareConfig) {
          await onRecheckShareConfig();
        }
        setAdminMsg(
          savedCustom
            ? 'Live Public URL saved for all players!'
            : 'Reset to default Shared App URL!'
        );
      }
    } catch {
      setAdminMsg('Network error saving share URL.');
    } finally {
      setSavingAdminUrl(false);
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(inviteMessage)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(finalShareLink)}`;
  const smsHref = `sms:?&body=${encodeURIComponent(inviteMessage)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-3xl border border-amber-400/50 bg-[#052920] p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-emerald-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-emerald-950 shadow-md">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold text-white">
                Share &amp; Install Choy Card Game
              </h2>
              <p className="text-xs text-emerald-300">
                Send this live link so friends can play &amp; install the app on their phone
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share modal"
            className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-900/70 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Reachability Check Banner — Detects 404 Not Found before user sends link */}
        {isPublicLive ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-400/50 bg-emerald-950/60 px-3.5 py-2.5 text-xs text-emerald-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-emerald-300">Link is LIVE!</strong> Other users can open, register &amp; install Choy Card Game now.
              </span>
            </div>
            {onRecheckShareConfig && (
              <button
                type="button"
                onClick={handleRecheck}
                disabled={rechecking}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-[#031c16] px-2 py-1 text-[10px] font-bold text-emerald-200 hover:border-amber-400 cursor-pointer shrink-0"
              >
                <RefreshCw className={`h-3 w-3 ${rechecking ? 'animate-spin' : ''}`} />
                Check
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-red-400/60 bg-red-950/55 p-3.5 text-xs text-red-100 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-amber-300">
                    Public Link Not Deployed Yet — Free Hosting Needed (HTTP 404)
                  </p>
                  <p className="text-[11px] text-red-100/90 mt-1 leading-relaxed">
                    Kay full-stack backend app ni (naay live database, multiplayer WebSocket, ug Admin server), <strong>&quot;Not Eligible&quot;</strong> siya sa built-in static Publish mao nga 404 ang <span className="font-mono-num text-amber-200">ais-pre-</span> link. Sunda ning <strong>LIBRE nga 3-step deploy</strong> para ma-open ug ma-install sa tanan player nga walay 404:
                  </p>
                </div>
              </div>
              {onRecheckShareConfig && (
                <button
                  type="button"
                  onClick={handleRecheck}
                  disabled={rechecking}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-400/60 bg-black/40 px-2.5 py-1 text-[10px] font-bold text-amber-200 hover:bg-amber-400/20 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`h-3 w-3 ${rechecking ? 'animate-spin' : ''}`} />
                  {rechecking ? 'Checking...' : 'Recheck'}
                </button>
              )}
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-100/95 pl-1">
              <li>
                I-save ang app sa <strong className="text-white">GitHub</strong> (i-click ang GitHub / Export icon sa workspace toolbar — ready na ang <span className="font-mono-num text-emerald-200">Dockerfile</span> ug <span className="font-mono-num text-emerald-200">render.yaml</span>).
              </li>
              <li>
                Ablihi ang <strong className="text-white">render.com</strong> (Libre) → <strong>New + → Blueprint</strong> (o Web Service → Docker) → pilia imong GitHub repo → i-add ang <span className="font-mono-num text-amber-200">GEMINI_API_KEY</span> → <strong>Deploy</strong>.
              </li>
              <li>
                Pagka-live sa imong <span className="font-mono-num text-emerald-200">https://choy-card-game.onrender.com</span> link, ablihi to (o i-paste sa Admin URL box sa ubos) — <strong>100% ma-share ug ma-install na sa tanan phone!</strong>
              </li>
            </ol>
          </div>
        )}

        {/* Toggle Referral Link vs Direct Link */}
        {user?.referral_code && (
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#031c16] p-1 border border-emerald-800/80">
            <button
              type="button"
              onClick={() => setIncludeRef(true)}
              className={`rounded-lg py-2 text-xs font-bold transition-colors cursor-pointer ${
                includeRef
                  ? 'bg-amber-400 text-emerald-950'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              Invite Link ({user.referral_code})
            </button>
            <button
              type="button"
              onClick={() => setIncludeRef(false)}
              className={`rounded-lg py-2 text-xs font-bold transition-colors cursor-pointer ${
                !includeRef
                  ? 'bg-amber-400 text-emerald-950'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              Direct App Link
            </button>
          </div>
        )}

        {/* QR Code + Link Box */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center rounded-2xl border border-emerald-800 bg-[#031c16] p-4">
          <div className="sm:col-span-5 flex flex-col items-center gap-1.5">
            <div className="rounded-2xl bg-white p-2 shadow-lg">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Scan QR code to open Choy Card Game"
                  className="h-36 w-36 object-contain"
                />
              ) : (
                <div className="flex h-36 w-36 items-center justify-center text-emerald-950">
                  <QrCode className="h-12 w-12" />
                </div>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300">
              <Smartphone className="h-3 w-3 text-amber-400" />
              Scan with Phone Camera
            </span>
          </div>

          <div className="sm:col-span-7 space-y-2.5">
            <div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-amber-300 mb-1">
                <Link2 className="h-3.5 w-3.5" />
                Public Player Link
              </label>
              <input
                type="text"
                readOnly
                value={finalShareLink}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-xl border border-emerald-700 bg-[#052920] px-3 py-2 font-mono-num text-[11px] text-white outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                type="button"
                onClick={handleNativeShare}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 cursor-pointer"
              >
                <Share2 className="h-4 w-4" />
                Share Now
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyMessage}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-700 bg-[#052920] px-3 py-2 text-xs font-bold text-emerald-100 hover:border-amber-400 cursor-pointer"
            >
              {copiedMsg ? <Check className="h-3.5 w-3.5 text-amber-300" /> : <MessageCircle className="h-3.5 w-3.5 text-amber-400" />}
              {copiedMsg ? 'Invite Message Copied!' : 'Copy Ready-to-Send Invite Message'}
            </button>
          </div>
        </div>

        {/* Quick Send Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <a
            href={facebookHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/50 bg-blue-950/50 px-2.5 py-2 text-xs font-bold text-blue-200 hover:bg-blue-900/60"
          >
            <Globe className="h-3.5 w-3.5" />
            Facebook
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-950/60 px-2.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-900/60"
          >
            <Send className="h-3.5 w-3.5" />
            WhatsApp
          </a>
          <a
            href={smsHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-950/40 px-2.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/50"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            SMS / Text
          </a>
        </div>

        {shareFeedback && (
          <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/70 px-3 py-2 text-xs font-semibold text-emerald-200">
            {shareFeedback}
          </div>
        )}

        {/* How Friends Install the App */}
        <div className="rounded-2xl border border-emerald-800/90 bg-[#031c16] p-3 text-[11px] leading-relaxed text-emerald-200 space-y-1">
          <p className="font-bold text-amber-300">
            Unsaon Pag-Install sa Ibang Player (Android &amp; iPhone):
          </p>
          <p>
            1. Kung gikan sa <strong>Messenger</strong>, i-tap ang <strong>⋮ → Open in Chrome</strong> (Android) o <strong>Open in Safari</strong> (iPhone).<br />
            2. I-tap ang yellow <strong>Install App</strong> button aron ma-add sa Home Screen nga naa ang <strong>Choy Card Game</strong> icon.
          </p>
        </div>

        {/* Admin Custom Public URL Override */}
        {user?.role === 'admin' && (
          <div className="rounded-2xl border border-amber-400/40 bg-[#031c16] p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-amber-300">
                Admin: Set Live Deployed Cloud Run / Domain URL
              </span>
              {customShareOrigin && (
                <button
                  type="button"
                  disabled={savingAdminUrl}
                  onClick={() => handleSaveAdminUrl(true)}
                  className="text-[11px] font-bold text-emerald-300 hover:text-white underline cursor-pointer"
                >
                  Reset Default
                </button>
              )}
            </div>
            <p className="text-[11px] text-emerald-300/90">
              After clicking <strong>Deploy app</strong> to Cloud Run (or connecting your own domain), paste your live <span className="font-mono-num text-white">https://...run.app</span> URL here and tap Save so every player shares your active public app!
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={adminUrlInput}
                onChange={(e) => setAdminUrlInput(e.target.value)}
                placeholder="https://choy-card-game-xxxx.run.app"
                className="flex-1 rounded-xl border border-emerald-700 bg-[#052920] px-3 py-2 text-xs text-white placeholder-emerald-500 outline-none focus:border-amber-400"
              />
              <button
                type="button"
                disabled={savingAdminUrl}
                onClick={() => handleSaveAdminUrl(false)}
                className="rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {savingAdminUrl ? 'Saving...' : 'Save URL'}
              </button>
            </div>
            {adminMsg && (
              <p className="text-[11px] font-semibold text-amber-200">{adminMsg}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
