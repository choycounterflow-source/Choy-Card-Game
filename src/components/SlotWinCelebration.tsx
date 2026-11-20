import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Crown, Sparkles, Star, Trophy } from 'lucide-react';
import type { SlotCelebrationAudioTier } from '../lib/audio';

export type SlotWinTier = 'big' | 'super' | 'excellent';

export interface SlotCelebrationPayload {
  kind: 'win' | 'scatter' | 'bonus_total';
  tier: SlotWinTier | null;
  eyebrow?: string;
  title: string;
  subtitle: string;
  amount?: number;
  audioTier: SlotCelebrationAudioTier;
  spinCount?: number;
}

/**
 * Classifies a slot payout against the active bet:
 * - >= 50× bet => Excellent Win (e.g. ₱50+ on ₱1 bet)
 * - >= 30× bet => Super Win     (e.g. ₱30–₱49.99 on ₱1 bet)
 * - >= 10× bet => Big Win       (e.g. ₱10–₱29.99 on ₱1 bet)
 */
export function classifySlotWinTier(amount: number, effectiveBet: number): SlotWinTier | null {
  if (!Number.isFinite(amount) || !Number.isFinite(effectiveBet) || amount <= 0 || effectiveBet <= 0) {
    return null;
  }
  const ratio = amount / effectiveBet;
  if (ratio >= 50) return 'excellent';
  if (ratio >= 30) return 'super';
  if (ratio >= 10) return 'big';
  return null;
}

interface BalloonSpec {
  id: number;
  leftPct: number;
  scale: number;
  delay: number;
  duration: number;
  swayPx: number;
  rotateDeg: number;
  fill: string;
  highlight: string;
  knot: string;
}

interface SparkSpec {
  id: number;
  originX: number;
  originY: number;
  angleRad: number;
  distancePx: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  isStar: boolean;
}

interface CoinSpec {
  id: number;
  leftPct: number;
  delay: number;
  duration: number;
  driftX: number;
  size: number;
}

const BALLOON_PALETTES: Record<'big' | 'super' | 'excellent' | 'scatter' | 'bonus', Array<{ fill: string; highlight: string; knot: string }>> = {
  big: [
    { fill: '#F59E0B', highlight: '#FEF08A', knot: '#B45309' },
    { fill: '#10B981', highlight: '#A7F3D0', knot: '#047857' },
    { fill: '#FBBF24', highlight: '#FEF9C3', knot: '#D97706' },
    { fill: '#34D399', highlight: '#D1FAE5', knot: '#059669' },
  ],
  super: [
    { fill: '#F97316', highlight: '#FED7AA', knot: '#C2410C' },
    { fill: '#FBBF24', highlight: '#FEF08A', knot: '#B45309' },
    { fill: '#EF4444', highlight: '#FECACA', knot: '#B91C1C' },
    { fill: '#10B981', highlight: '#A7F3D0', knot: '#047857' },
  ],
  excellent: [
    { fill: '#FBBF24', highlight: '#FEF9C3', knot: '#B45309' },
    { fill: '#DC2626', highlight: '#FCA5A5', knot: '#991B1B' },
    { fill: '#10B981', highlight: '#A7F3D0', knot: '#047857' },
    { fill: '#F59E0B', highlight: '#FEF08A', knot: '#92400E' },
    { fill: '#FDE68A', highlight: '#FFFFFF', knot: '#D97706' },
  ],
  scatter: [
    { fill: '#FBBF24', highlight: '#FEF9C3', knot: '#B45309' },
    { fill: '#F59E0B', highlight: '#FDE68A', knot: '#92400E' },
    { fill: '#10B981', highlight: '#A7F3D0', knot: '#047857' },
  ],
  bonus: [
    { fill: '#FBBF24', highlight: '#FEF9C3', knot: '#B45309' },
    { fill: '#10B981', highlight: '#A7F3D0', knot: '#047857' },
    { fill: '#F59E0B', highlight: '#FDE68A', knot: '#92400E' },
  ],
};

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function buildBalloons(mode: keyof typeof BALLOON_PALETTES, count: number): BalloonSpec[] {
  const palette = BALLOON_PALETTES[mode];
  const out: BalloonSpec[] = [];
  for (let i = 0; i < count; i++) {
    const p = palette[i % palette.length];
    const lane = ((i + 0.5) / count) * 92 + 4;
    const jitter = (seededUnit(i + 11) - 0.5) * 8;
    out.push({
      id: i,
      leftPct: Math.max(4, Math.min(94, lane + jitter)),
      scale: 0.72 + seededUnit(i + 23) * 0.45,
      delay: seededUnit(i + 37) * 0.55,
      duration: 1.85 + seededUnit(i + 53) * 0.95,
      swayPx: (seededUnit(i + 71) > 0.5 ? 1 : -1) * (10 + seededUnit(i + 83) * 18),
      rotateDeg: (seededUnit(i + 97) - 0.5) * 16,
      fill: p.fill,
      highlight: p.highlight,
      knot: p.knot,
    });
  }
  return out;
}

function buildSparks(bursts: Array<{ x: number; y: number; delay: number; count: number }>, colors: string[]): SparkSpec[] {
  const out: SparkSpec[] = [];
  let id = 0;
  for (let b = 0; b < bursts.length; b++) {
    const burst = bursts[b];
    for (let i = 0; i < burst.count; i++) {
      const angleRad = (i / burst.count) * Math.PI * 2 + (seededUnit(id + 5) - 0.5) * 0.22;
      const distancePx = 70 + seededUnit(id + 19) * 135;
      out.push({
        id: id++,
        originX: burst.x,
        originY: burst.y,
        angleRad,
        distancePx,
        delay: burst.delay + seededUnit(id + 31) * 0.14,
        duration: 0.78 + seededUnit(id + 47) * 0.45,
        size: 6 + seededUnit(id + 61) * 9,
        color: colors[id % colors.length],
        isStar: id % 3 === 0,
      });
    }
  }
  return out;
}

function buildCoins(count: number): CoinSpec[] {
  const out: CoinSpec[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: i,
      leftPct: 14 + seededUnit(i + 101) * 72,
      delay: seededUnit(i + 113) * 0.6,
      duration: 1.15 + seededUnit(i + 127) * 0.65,
      driftX: (seededUnit(i + 139) - 0.5) * 110,
      size: 16 + Math.round(seededUnit(i + 149) * 10),
    });
  }
  return out;
}

interface SlotWinCelebrationProps {
  payload: SlotCelebrationPayload;
  onDismiss: () => void;
  turboMode?: boolean;
}

export const SlotWinCelebration: React.FC<SlotWinCelebrationProps> = ({
  payload,
  onDismiss,
  turboMode = false,
}) => {
  const visualMode: keyof typeof BALLOON_PALETTES =
    payload.tier ?? (payload.kind === 'scatter' ? 'scatter' : 'bonus');

  const [displayAmount, setDisplayAmount] = useState<number>(0);

  // Smooth requestAnimationFrame counting-up peso odometer
  useEffect(() => {
    const target = payload.amount ?? 0;
    if (target <= 0) {
      setDisplayAmount(0);
      return;
    }

    const baseDuration =
      visualMode === 'excellent'
        ? 1350
        : visualMode === 'super'
          ? 1100
          : 850;
    const durationMs = turboMode ? Math.round(baseDuration * 0.55) : baseDuration;
    const startTs = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTs) / durationMs);
      // Cubic ease-out so numbers race up fast then land crisply
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(Number((target * eased).toFixed(2)));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplayAmount(target);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [payload.amount, visualMode, turboMode]);

  const balloons = useMemo(() => {
    const count =
      visualMode === 'excellent'
        ? 20
        : visualMode === 'super'
          ? 14
          : visualMode === 'big' || visualMode === 'scatter'
            ? 8
            : 6;
    return buildBalloons(visualMode, count);
  }, [visualMode]);

  const sparks = useMemo(() => {
    if (visualMode === 'excellent') {
      return buildSparks(
        [
          { x: 50, y: 46, delay: 0.0, count: 24 },
          { x: 24, y: 30, delay: 0.32, count: 16 },
          { x: 76, y: 30, delay: 0.56, count: 16 },
        ],
        ['#FEF08A', '#FBBF24', '#F97316', '#FFFFFF', '#34D399', '#FCA5A5'],
      );
    }
    if (visualMode === 'super') {
      return buildSparks(
        [
          { x: 50, y: 46, delay: 0.0, count: 20 },
          { x: 28, y: 34, delay: 0.35, count: 12 },
          { x: 72, y: 34, delay: 0.48, count: 12 },
        ],
        ['#FEF08A', '#FBBF24', '#FB923C', '#FFFFFF'],
      );
    }
    return buildSparks(
      [{ x: 50, y: 48, delay: 0.0, count: 18 }],
      ['#FEF08A', '#FBBF24', '#34D399', '#FFFFFF'],
    );
  }, [visualMode]);

  const coins = useMemo(() => {
    if (visualMode === 'excellent') return buildCoins(18);
    if (visualMode === 'super') return buildCoins(10);
    if (visualMode === 'big') return buildCoins(6);
    return [];
  }, [visualMode]);

  const themeStyle = useMemo(() => {
    if (visualMode === 'excellent') {
      return {
        backdrop: 'bg-gradient-to-b from-[#2a060c]/88 via-[#180710]/90 to-[#04140f]/92',
        cardBorder: 'border-amber-300/90 shadow-[0_0_55px_rgba(251,191,36,0.65)]',
        cardBg: 'bg-gradient-to-b from-[#431019]/95 via-[#250a14]/95 to-[#0a1e17]/95',
        titleGradient: 'from-yellow-100 via-amber-300 to-orange-400',
        eyebrowClass: 'text-amber-200 border-amber-300/50 bg-amber-400/20',
        ringGlow: 'from-amber-400/35 via-rose-500/25 to-transparent',
      };
    }
    if (visualMode === 'super') {
      return {
        backdrop: 'bg-gradient-to-b from-[#291303]/85 via-[#101c16]/88 to-[#031510]/90',
        cardBorder: 'border-amber-400/85 shadow-[0_0_42px_rgba(249,115,22,0.55)]',
        cardBg: 'bg-gradient-to-b from-[#3b1c07]/95 via-[#182319]/95 to-[#061c15]/95',
        titleGradient: 'from-yellow-200 via-amber-300 to-orange-400',
        eyebrowClass: 'text-amber-200 border-orange-400/50 bg-orange-500/20',
        ringGlow: 'from-orange-400/30 via-amber-400/20 to-transparent',
      };
    }
    return {
      backdrop: 'bg-[#02120d]/82',
      cardBorder: 'border-amber-400/75 shadow-[0_0_36px_rgba(251,191,36,0.45)]',
      cardBg: 'bg-gradient-to-b from-[#08382a]/95 via-[#05241b]/95 to-[#031712]/95',
      titleGradient: 'from-amber-200 via-yellow-300 to-amber-400',
      eyebrowClass: 'text-emerald-200 border-amber-400/45 bg-emerald-950/80',
      ringGlow: 'from-amber-400/25 via-emerald-400/15 to-transparent',
    };
  }, [visualMode]);

  const EmblemIcon =
    visualMode === 'excellent'
      ? Trophy
      : visualMode === 'super'
        ? Star
        : visualMode === 'big'
          ? Crown
          : Sparkles;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${payload.title} celebration. Tap anywhere to continue.`}
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDismiss();
        }
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden p-4 text-center backdrop-blur-[2px] cursor-pointer select-none ${themeStyle.backdrop}`}
    >
      {/* Radial Golden Glow & Sunburst Halo (Super & Excellent) */}
      <div
        className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] ${themeStyle.ringGlow} opacity-90`}
      />

      {(visualMode === 'excellent' || visualMode === 'super') && (
        <motion.div
          aria-hidden="true"
          animate={{ rotate: 360 }}
          transition={{ duration: visualMode === 'excellent' ? 9 : 14, repeat: Infinity, ease: 'linear' }}
          className="pointer-events-none absolute h-[380px] w-[380px] sm:h-[480px] sm:w-[480px] opacity-35"
          style={{
            background:
              'repeating-conic-gradient(from 0deg, rgba(251,191,36,0.45) 0deg 10deg, transparent 10deg 24deg)',
            maskImage: 'radial-gradient(circle, black 12%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(circle, black 12%, transparent 70%)',
          }}
        />
      )}

      {/* Rising Festive SVG Balloons */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {balloons.map((b) => (
          <motion.div
            key={b.id}
            initial={{ y: '112%', x: 0, opacity: 0.15, rotate: -b.rotateDeg }}
            animate={{
              y: '-28%',
              x: [0, b.swayPx, -b.swayPx * 0.7, b.swayPx * 0.4],
              opacity: [0.2, 0.96, 0.96, 0],
              rotate: [-b.rotateDeg, b.rotateDeg, -b.rotateDeg * 0.6],
            }}
            transition={{
              duration: turboMode ? b.duration * 0.65 : b.duration,
              delay: turboMode ? b.delay * 0.5 : b.delay,
              ease: 'easeOut',
            }}
            style={{
              position: 'absolute',
              left: `${b.leftPct}%`,
              bottom: 0,
              transformOrigin: 'center bottom',
            }}
          >
            <svg
              width={Math.round(40 * b.scale)}
              height={Math.round(74 * b.scale)}
              viewBox="0 0 44 82"
              fill="none"
              className="drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]"
            >
              {/* Swaying Balloon String */}
              <path
                d="M22 48 C18 57, 27 64, 21 79"
                stroke="#FDE68A"
                strokeOpacity="0.72"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              {/* Knot */}
              <polygon points="19,46 25,46 22,50" fill={b.knot} />
              {/* Balloon Body */}
              <ellipse cx="22" cy="24" rx="18" ry="22" fill={b.fill} />
              {/* Metallic Gloss Specular Sheen */}
              <ellipse
                cx="15"
                cy="16"
                rx="4.8"
                ry="8.5"
                transform="rotate(-22 15 16)"
                fill={b.highlight}
                fillOpacity="0.65"
              />
              <circle cx="13" cy="10" r="2" fill="#FFFFFF" fillOpacity="0.8" />
            </svg>
          </motion.div>
        ))}
      </div>

      {/* Radial Golden Sparks & Firework Bursts (repeating cleanly across the full 5s highlight) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {sparks.map((s) => {
          const dx = Math.cos(s.angleRad) * s.distancePx;
          const dy = Math.sin(s.angleRad) * s.distancePx;
          return (
            <motion.div
              key={s.id}
              initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
              animate={{
                x: dx,
                y: dy,
                scale: [0.3, 1.35, 0],
                opacity: [1, 1, 0],
                rotate: s.isStar ? [0, 160] : 0,
              }}
              transition={{
                duration: turboMode ? s.duration * 0.85 : s.duration * 1.15,
                delay: s.delay,
                repeat: Infinity,
                repeatDelay: 0.45,
                ease: 'easeOut',
              }}
              style={{
                position: 'absolute',
                left: `${s.originX}%`,
                top: `${s.originY}%`,
              }}
            >
              {s.isStar ? (
                <svg width={s.size * 1.5} height={s.size * 1.5} viewBox="0 0 20 20" fill={s.color}>
                  <path d="M10 0 L12.4 7.6 L20 10 L12.4 12.4 L10 20 L7.6 12.4 L0 10 L7.6 7.6 Z" />
                </svg>
              ) : (
                <span
                  style={{
                    display: 'block',
                    width: s.size,
                    height: s.size,
                    borderRadius: '9999px',
                    backgroundColor: s.color,
                    boxShadow: `0 0 12px ${s.color}`,
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Shimmering Gold Coin Fountain (Big / Super / Excellent) */}
      {coins.length > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {coins.map((c) => (
            <motion.div
              key={c.id}
              initial={{ y: '105%', x: 0, opacity: 0, scale: 0.6, rotate: 0 }}
              animate={{
                y: ['105%', '18%', '85%'],
                x: [0, c.driftX * 0.6, c.driftX],
                opacity: [0, 1, 1, 0],
                scale: [0.65, 1.05, 0.85],
                rotate: [0, 220, 420],
              }}
              transition={{
                duration: turboMode ? c.duration * 0.85 : c.duration * 1.1,
                delay: c.delay,
                repeat: Infinity,
                repeatDelay: 0.6,
                ease: 'easeOut',
              }}
              style={{
                position: 'absolute',
                left: `${c.leftPct}%`,
                bottom: 0,
                width: c.size,
                height: c.size,
              }}
              className="rounded-full border-2 border-yellow-100 bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 shadow-[0_0_12px_rgba(251,191,36,0.75)] flex items-center justify-center text-[9px] font-black text-amber-950"
            >
              ₱
            </motion.div>
          ))}
        </div>
      )}

      {/* Central Celebration Emblem Card */}
      <motion.div
        initial={{ scale: 0.72, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 310, damping: 22 }}
        className={`relative z-10 w-full max-w-sm rounded-3xl border-2 px-5 py-5 sm:px-7 sm:py-6 ${themeStyle.cardBorder} ${themeStyle.cardBg}`}
      >
        {/* Top Eyebrow (e.g. 10 FREE SPINS TOTAL WIN) */}
        {payload.eyebrow && (
          <div className="mb-2 flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider ${themeStyle.eyebrowClass}`}
            >
              <Sparkles className="h-3 w-3" />
              {payload.eyebrow}
            </span>
          </div>
        )}

        {/* Animated Crest Icon */}
        <motion.div
          animate={{ scale: [1, 1.14, 1], rotate: [0, -6, 6, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.3 }}
          className="mx-auto mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-200/80 bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 text-emerald-950 shadow-[0_0_24px_rgba(251,191,36,0.75)]"
        >
          <EmblemIcon className="h-8 w-8 stroke-[2.4]" />
        </motion.div>

        {/* Tier Headline */}
        <h2
          className={`font-display text-3xl sm:text-4xl font-black uppercase tracking-wide bg-gradient-to-b ${themeStyle.titleGradient} bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(251,191,36,0.45)]`}
        >
          {payload.title}
        </h2>

        {/* Subtitle */}
        <p className="mt-1 text-xs sm:text-sm font-semibold text-emerald-100/95">
          {payload.subtitle}
        </p>

        {/* Sparkling Highlighted Win Amount Odometer */}
        {payload.amount !== undefined && (
          <motion.div
            animate={{
              boxShadow: [
                '0 0 18px rgba(251,191,36,0.55)',
                '0 0 38px rgba(254,240,138,0.95)',
                '0 0 18px rgba(251,191,36,0.55)',
              ],
              scale: [1, 1.03, 1],
            }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            className="relative mt-3 rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-950/90 via-black/75 to-amber-950/90 px-4 py-3 shadow-inner"
          >
            <Sparkles className="pointer-events-none absolute -top-2.5 -left-2.5 h-5 w-5 text-yellow-300 animate-pulse drop-shadow-[0_0_8px_rgba(254,240,138,0.95)]" />
            <Sparkles className="pointer-events-none absolute -top-2.5 -right-2.5 h-5 w-5 text-amber-300 animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.95)]" />
            <Sparkles className="pointer-events-none absolute -bottom-2 -left-2 h-4 w-4 text-amber-200 animate-bounce" />
            <Sparkles className="pointer-events-none absolute -bottom-2 -right-2 h-4 w-4 text-yellow-200 animate-bounce" />
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-300 mb-0.5">
              WIN AMOUNT
            </span>
            <p className="font-mono-num text-3xl sm:text-4xl font-black tracking-tight text-yellow-100 drop-shadow-[0_2px_14px_rgba(251,191,36,0.95)]">
              +₱{displayAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </motion.div>
        )}

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-amber-200/75">
          Tap anywhere to continue
        </p>
      </motion.div>
    </motion.div>
  );
};
