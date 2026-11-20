import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Coins,
  Crown,
  Gauge,
  Maximize2,
  Minimize2,
  Minus,
  Play,
  Plus,
  Repeat,
  RotateCw,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  SLOT_GAME_CATALOG,
  SUPER_ACE_BETS,
  type SlotGameKey,
  type SuperAceCell,
  type SuperAcePlayerState,
  type SuperAceSpinResult,
  type SuperAceSymbol,
  type Suit,
  type UserProfile,
} from '../types';
import {
  isAudioMuted,
  playCardBreak,
  playChipClink,
  playGoldenTransform,
  playReelStop,
  playScatterDrop,
  playSlotCelebrationFanfare,
  playSlotSpinStart,
  setAudioMuted,
} from '../lib/audio';
import {
  classifySlotWinTier,
  SlotWinCelebration,
  type SlotCelebrationPayload,
  type SlotWinTier,
} from './SlotWinCelebration';
import { BoldSuitIcon, CourtPortrait } from './CardArt';
import { GAME_ART_MAP } from '../lib/gameImages';
import {
  isFullscreenActive,
  toggleGameFullscreenLandscape,
} from '../lib/fullscreen';

interface SuperAceSlotViewProps {
  gameKey: SlotGameKey;
  user: UserProfile;
  onExit: () => void;
  onProfileUpdated: (updated: UserProfile) => void;
  onOpenCashIn: () => void;
}

type SlotSpinSpeed = 'slow' | 'fast' | 'extra_fast';

interface SpeedProfile {
  label: string;
  shortLabel: string;
  clearMinMs: number;
  clearDurationSec: number;
  clearColStepSec: number;
  clearRowStepSec: number;
  dropColStepMs: number;
  dropColStepSec: number;
  dropRowStepSec: number;
  dropStiffness: number;
  dropDamping: number;
  dropMass: number;
  landOffsetMs: number;
  totalDropTailMs: number;
  cascadeColStepSec: number;
  cascadeRowStepSec: number;
  sleepScale: number;
  celebrationScale: number;
  autoDelayMs: number;
}

const SPEED_PROFILES: Record<SlotSpinSpeed, SpeedProfile> = {
  slow: {
    label: 'Slow',
    shortLabel: 'Slow',
    clearMinMs: 420,
    clearDurationSec: 0.3,
    clearColStepSec: 0.072,
    clearRowStepSec: 0.02,
    dropColStepMs: 185,
    dropColStepSec: 0.185,
    dropRowStepSec: 0.032,
    dropStiffness: 220,
    dropDamping: 21,
    dropMass: 0.95,
    landOffsetMs: 310,
    totalDropTailMs: 520,
    cascadeColStepSec: 0.065,
    cascadeRowStepSec: 0.024,
    sleepScale: 1.15,
    celebrationScale: 1.0,
    autoDelayMs: 650,
  },
  fast: {
    label: 'Fast',
    shortLabel: 'Fast',
    clearMinMs: 240,
    clearDurationSec: 0.2,
    clearColStepSec: 0.04,
    clearRowStepSec: 0.012,
    dropColStepMs: 92,
    dropColStepSec: 0.092,
    dropRowStepSec: 0.018,
    dropStiffness: 360,
    dropDamping: 25,
    dropMass: 0.85,
    landOffsetMs: 200,
    totalDropTailMs: 340,
    cascadeColStepSec: 0.038,
    cascadeRowStepSec: 0.014,
    sleepScale: 0.78,
    celebrationScale: 0.82,
    autoDelayMs: 390,
  },
  extra_fast: {
    label: 'Extra Fast',
    shortLabel: 'Extra',
    clearMinMs: 135,
    clearDurationSec: 0.12,
    clearColStepSec: 0.02,
    clearRowStepSec: 0.006,
    dropColStepMs: 40,
    dropColStepSec: 0.04,
    dropRowStepSec: 0.008,
    dropStiffness: 540,
    dropDamping: 30,
    dropMass: 0.75,
    landOffsetMs: 115,
    totalDropTailMs: 195,
    cascadeColStepSec: 0.02,
    cascadeRowStepSec: 0.008,
    sleepScale: 0.44,
    celebrationScale: 0.6,
    autoDelayMs: 210,
  },
};

const SPEED_ORDER: SlotSpinSpeed[] = ['slow', 'fast', 'extra_fast'];

const COLS = 6;
const ROWS = 5;

const REGULAR_MULTS = [1, 2, 3, 4, 5];

function buildPreviewGrid(): SuperAceCell[][] {
  const sample: SuperAceSymbol[] = ['ACE', 'KING', 'QUEEN', 'JACK', 'SPADE', 'HEART', 'CLUB', 'DIAMOND'];
  const grid: SuperAceCell[][] = [];
  let seq = 0;
  for (let r = 0; r < ROWS; r++) {
    const row: SuperAceCell[] = [];
    for (let c = 0; c < COLS; c++) {
      const sym = sample[(r * 3 + c * 5) % sample.length];
      row.push({
        id: `init-${r}-${c}-${seq++}`,
        symbol: sym,
        isGolden: (r === 1 && c === 2) || (r === 2 && c === 3),
        isWild: false,
        isScatter: false,
      });
    }
    grid.push(row);
  }
  return grid;
}

export const SuperAceSlotView: React.FC<SuperAceSlotViewProps> = ({
  gameKey,
  user,
  onExit,
  onProfileUpdated,
  onOpenCashIn,
}) => {
  const theme = SLOT_GAME_CATALOG[gameKey] ?? SLOT_GAME_CATALOG.superace;
  const [grid, setGrid] = useState<SuperAceCell[][]>(() => buildPreviewGrid());
  const [betIndex, setBetIndex] = useState<number>(1); // Default ₱1
  const [slotState, setSlotState] = useState<SuperAcePlayerState>({
    totalRegularSpins: 0,
    scattersTriggered: 0,
    spinsSinceLastScatter: 0,
    freeSpinsRemaining: 0,
    freeSpinsTotal: 0,
    freeSpinBet: 1,
    freeSpinTotalWin: 0,
  });

  const [isSpinning, setIsSpinning] = useState(false);
  const [reelPhase, setReelPhase] = useState<'idle' | 'clearing' | 'dropping' | 'cascading'>('idle');
  const [spinSeq, setSpinSeq] = useState<number>(0);
  const [breakingKeys, setBreakingKeys] = useState<Set<string>>(new Set());
  const [scatterKeys, setScatterKeys] = useState<Set<string>>(new Set());
  const [transformKeys, setTransformKeys] = useState<Set<string>>(new Set());
  const [activeMultiplierIdx, setActiveMultiplierIdx] = useState<number>(0);

  const [lastWin, setLastWin] = useState<number>(0);
  const [cascadeBanner, setCascadeBanner] = useState<string>('');
  const [celebrationModal, setCelebrationModal] = useState<SlotCelebrationPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [autoSpinsLeft, setAutoSpinsLeft] = useState<number>(0);
  const [autoMenuOpen, setAutoMenuOpen] = useState<boolean>(false);
  // Default to Slow so 1st reel -> 2nd reel -> 3rd reel drop is clearly visible; switchable to Fast & Extra Fast
  const [spinSpeed, setSpinSpeed] = useState<SlotSpinSpeed>('slow');
  const [muted, setMuted] = useState<boolean>(isAudioMuted());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isFullscreenActive());

  const mountedRef = useRef(true);
  const isSpinningRef = useRef(false);
  const autoSpinsRef = useRef(0);
  const spinSpeedRef = useRef<SlotSpinSpeed>('slow');
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationResolverRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    spinSpeedRef.current = spinSpeed;
  }, [spinSpeed]);

  useEffect(() => {
    const syncFs = () => setIsFullscreen(isFullscreenActive());
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs as EventListener);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    const active = await toggleGameFullscreenLandscape();
    setIsFullscreen(active);
  };

  const activeSpeed = SPEED_PROFILES[spinSpeed];

  const dismissCelebration = useCallback(() => {
    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
    }
    setCelebrationModal(null);
    const resolve = celebrationResolverRef.current;
    celebrationResolverRef.current = null;
    if (resolve) resolve();
  }, []);

  const presentCelebration = useCallback(
    (payload: SlotCelebrationPayload, baseDurationMs: number) =>
      new Promise<void>((resolve) => {
        if (!mountedRef.current) {
          resolve();
          return;
        }
        if (celebrationTimerRef.current) {
          clearTimeout(celebrationTimerRef.current);
          celebrationTimerRef.current = null;
        }
        if (celebrationResolverRef.current) {
          celebrationResolverRef.current();
          celebrationResolverRef.current = null;
        }
        playSlotCelebrationFanfare(payload.audioTier);
        setCelebrationModal(payload);
        celebrationResolverRef.current = resolve;
        const speedProfile = SPEED_PROFILES[spinSpeedRef.current];
        const duration = Math.round(baseDurationMs * speedProfile.celebrationScale);
        celebrationTimerRef.current = setTimeout(() => {
          celebrationTimerRef.current = null;
          if (mountedRef.current) setCelebrationModal(null);
          const done = celebrationResolverRef.current;
          celebrationResolverRef.current = null;
          if (done) done();
        }, duration);
      }),
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      if (celebrationResolverRef.current) {
        celebrationResolverRef.current();
        celebrationResolverRef.current = null;
      }
    };
  }, []);

  // Load persisted slot state for this game
  useEffect(() => {
    dismissCelebration();
    setReelPhase('idle');
    setGrid(buildPreviewGrid());
    setLastWin(0);
    setCascadeBanner('');
    setErrorMsg('');
    fetch(`/api/slots/${encodeURIComponent(gameKey)}/state?userId=${encodeURIComponent(user.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mountedRef.current || !data) return;
        if (data.state) {
          setSlotState({
            ...data.state,
            freeSpinsRemaining: 0,
            freeSpinsTotal: 0,
            freeSpinTotalWin: 0,
          });
        }
        if (data.profile) onProfileUpdated(data.profile);
      })
      .catch(() => {});
  }, [gameKey, user.id, onProfileUpdated, dismissCelebration]);

  const selectedBet = SUPER_ACE_BETS[betIndex] ?? 1;
  const displayBet = selectedBet;
  const activeMultipliers = REGULAR_MULTS;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const profile = SPEED_PROFILES[spinSpeedRef.current];
      setTimeout(resolve, Math.round(ms * profile.sleepScale));
    });

  const stopAutoSpin = useCallback(() => {
    setAutoSpinsLeft(0);
    autoSpinsRef.current = 0;
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  const executeSpin = useCallback(async () => {
    if (isSpinningRef.current) return;
    setErrorMsg('');

    const betToSend = SUPER_ACE_BETS[betIndex];

    if (user.wallet_balance < betToSend) {
      setErrorMsg(`Insufficient wallet balance for ₱${betToSend} bet. Ask Admin to add coins or lower your bet.`);
      stopAutoSpin();
      return;
    }

    const speed = SPEED_PROFILES[spinSpeedRef.current];

    isSpinningRef.current = true;
    setIsSpinning(true);
    setReelPhase('clearing');
    setBreakingKeys(new Set());
    setScatterKeys(new Set());
    setTransformKeys(new Set());
    setActiveMultiplierIdx(0);
    setCascadeBanner('');
    setLastWin(0);
    playSlotSpinStart();

    const clearStartAt = performance.now();

    try {
      const res = await fetch(`/api/slots/${encodeURIComponent(gameKey)}/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, betAmount: betToSend }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Unable to spin right now.');
        stopAutoSpin();
        isSpinningRef.current = false;
        setIsSpinning(false);
        setReelPhase('idle');
        return;
      }

      const result = data as SuperAceSpinResult;
      if (!mountedRef.current) return;

      // Ensure old reels sweep down sequentially (Reel 1 -> Reel 2 -> ... -> Reel 6) before new reels drop
      const elapsedClear = performance.now() - clearStartAt;
      if (elapsedClear < speed.clearMinMs) {
        await new Promise<void>((resolve) => setTimeout(resolve, speed.clearMinMs - elapsedClear));
      }
      if (!mountedRef.current) return;

      // Drop new cards down sequentially: Reel 1 first, then Reel 2, Reel 3, Reel 4, Reel 5, Reel 6
      setSpinSeq((prev) => prev + 1);
      setReelPhase('dropping');
      setGrid(result.initialGrid);

      for (let col = 0; col < COLS; col++) {
        setTimeout(() => {
          if (mountedRef.current) playReelStop(col);
        }, col * speed.dropColStepMs + speed.landOffsetMs);
      }

      const totalDropMs = (COLS - 1) * speed.dropColStepMs + speed.totalDropTailMs;
      await new Promise<void>((resolve) => setTimeout(resolve, totalDropMs));
      if (!mountedRef.current) return;
      setReelPhase('cascading');

      if (result.scatterPositions.length > 0) {
        const sKeys = new Set<string>();
        for (let i = 0; i < result.scatterPositions.length; i++) {
          const p = result.scatterPositions[i];
          sKeys.add(`${p.row},${p.col}`);
          setScatterKeys(new Set(sKeys));
          playScatterDrop(i + 1);
          await sleep(170);
        }
      }

      let runningWin = 0;
      for (let idx = 0; idx < result.cascades.length; idx++) {
        if (!mountedRef.current) return;
        const step = result.cascades[idx];
        setActiveMultiplierIdx(Math.min(step.stepIndex, 4));

        const winSet = new Set(step.winningCells.map((p) => `${p.row},${p.col}`));
        setBreakingKeys(winSet);
        playCardBreak(step.stepIndex);
        runningWin = Number((runningWin + step.stepWin).toFixed(2));
        setLastWin(runningWin);
        setCascadeBanner(`×${step.multiplier} Cascade · +₱${step.stepWin.toFixed(2)}`);
        await sleep(520);

        if (step.goldenTransformed.length > 0 || step.bigJokerClones.length > 0) {
          const tKeys = new Set([
            ...step.goldenTransformed.map((p) => `${p.row},${p.col}`),
            ...step.bigJokerClones.map((p) => `${p.row},${p.col}`),
          ]);
          setTransformKeys(tKeys);
          playGoldenTransform();
          await sleep(340);
          setTransformKeys(new Set());
        }

        setBreakingKeys(new Set());
        setGrid(step.gridAfterDrop);
        await sleep(360);
      }

      if (result.totalWin > runningWin) {
        setLastWin(result.totalWin);
      }

      setSlotState({
        ...result.state,
        freeSpinsRemaining: 0,
        freeSpinsTotal: 0,
        freeSpinTotalWin: 0,
      });
      onProfileUpdated(result.profile);

      const tierTitle = (tier: SlotWinTier): string =>
        tier === 'excellent' ? 'EXCELLENT WIN!' : tier === 'super' ? 'SUPER WIN!' : 'BIG WIN!';
      const tierDuration = (tier: SlotWinTier): number =>
        tier === 'excellent' ? 2850 : tier === 'super' ? 2350 : 1850;

      const spinTier = classifySlotWinTier(result.totalWin, result.betAmount);

      if (result.scatterCount >= 3) {
        await presentCelebration(
          {
            kind: 'scatter',
            tier: spinTier,
            eyebrow: 'REAL SCATTER BONUS',
            title: `${result.scatterCount} SCATTERS!`,
            subtitle: 'Instant Scatter Cash Win Credited to Wallet',
            amount: result.totalWin > 0 ? result.totalWin : undefined,
            audioTier: spinTier ?? 'scatter',
          },
          2100,
        );
      } else if (spinTier) {
        await presentCelebration(
          {
            kind: 'win',
            tier: spinTier,
            eyebrow: theme.title.toUpperCase(),
            title: tierTitle(spinTier),
            subtitle:
              result.cascades.length > 1
                ? `${result.cascades.length} Cascade Chain Win`
                : 'Spin Win Credited to Wallet',
            amount: result.totalWin,
            audioTier: spinTier,
          },
          tierDuration(spinTier),
        );
      }

      isSpinningRef.current = false;
      setIsSpinning(false);
      setReelPhase('idle');
      setScatterKeys(new Set());

      if (mountedRef.current && autoSpinsRef.current > 0) {
        const nextRemaining = autoSpinsRef.current === 9999 ? 9999 : autoSpinsRef.current - 1;
        setAutoSpinsLeft(nextRemaining);
        autoSpinsRef.current = nextRemaining;
        if (nextRemaining > 0) {
          const nextAutoDelay = SPEED_PROFILES[spinSpeedRef.current].autoDelayMs;
          autoTimerRef.current = setTimeout(() => {
            if (mountedRef.current && autoSpinsRef.current > 0) {
              executeSpin();
            }
          }, nextAutoDelay);
        }
      }
    } catch {
      setErrorMsg('Network error during spin. Please try again.');
      stopAutoSpin();
      isSpinningRef.current = false;
      setIsSpinning(false);
      setReelPhase('idle');
    }
  }, [
    gameKey,
    theme.title,
    betIndex,
    user.id,
    user.wallet_balance,
    onProfileUpdated,
    stopAutoSpin,
    presentCelebration,
  ]);

  const startAutoSpin = (count: number) => {
    setAutoMenuOpen(false);
    setAutoSpinsLeft(count);
    autoSpinsRef.current = count;
    if (!isSpinningRef.current) {
      executeSpin();
    }
  };

  const handleSelectBet = (idx: number) => {
    if (isSpinning) return;
    playChipClink();
    setBetIndex(idx);
  };

  return (
    <div className="fixed inset-0 z-30 h-[100dvh] w-screen bg-[#02140f] flex flex-col overflow-hidden p-1.5 sm:p-2.5 gap-1.5 sm:gap-2">
      {/* Compact Full-Width Top Game Bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-800/90 bg-[#052920] px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              stopAutoSpin();
              onExit();
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-700 bg-[#031c16] px-2.5 py-1.5 text-xs font-bold text-emerald-100 hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Lobby
          </button>

          <img
            src={GAME_ART_MAP[gameKey]}
            alt={theme.title}
            className="h-8 w-10 sm:h-9 sm:w-12 rounded-lg object-cover border border-amber-400/60 shadow shrink-0"
          />

          <div>
            <h1 className="font-display text-sm sm:text-lg font-extrabold text-amber-400 leading-tight flex items-center gap-1.5">
              <Crown className="h-4 w-4 text-amber-400 shrink-0" />
              {theme.title}
            </h1>
            <p className="text-[10px] sm:text-[11px] text-emerald-300 leading-tight">
              6×5 Real Bet Reels · Instant Cash Payouts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="text-right pr-1">
            <span className="block text-[9px] sm:text-[10px] text-emerald-400 leading-none">
              Wallet · VIP {user.vip_level}
            </span>
            <span className="font-mono-num text-sm sm:text-base font-extrabold text-amber-300">
              ₱{user.wallet_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenCashIn}
            className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-2.5 sm:px-3 py-1.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 transition-colors cursor-pointer"
          >
            <Coins className="h-3.5 w-3.5" />
            Cash In
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Landscape'}
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen landscape'}
            className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
              isFullscreen
                ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                : 'border-emerald-700 bg-[#031c16] text-emerald-200 hover:border-amber-400 hover:text-amber-300'
            }`}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{isFullscreen ? 'Exit Full' : 'Full Screen'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? 'Unmute slot audio' : 'Mute slot audio'}
            className="rounded-xl border border-emerald-700 bg-[#031c16] p-1.5 sm:p-2 text-emerald-200 hover:border-amber-400 hover:text-amber-300 cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-amber-300" />}
          </button>
        </div>
      </div>

      {/* FULL-SCREEN 6×5 SLOT CABINET (Occupies 100% remaining screen in Landscape & Portrait) */}
      <div
        className={`relative flex-1 min-h-0 w-full rounded-2xl sm:rounded-3xl border-2 p-2 sm:p-3.5 shadow-2xl transition-colors flex flex-col lg:flex-row landscape:flex-row gap-2.5 overflow-y-auto lg:overflow-hidden landscape:overflow-hidden ${theme.accentBorder} bg-gradient-to-b ${theme.cabinetGradient}`}
      >
        {/* LEFT / MAIN STAGE: MULTIPLIERS + 6×5 REELS */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-1.5 sm:gap-2">
          {/* Multiplier Trail Header */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-amber-400/20">
            <div className="flex items-center gap-1 sm:gap-1.5">
              {activeMultipliers.map((m, idx) => {
                const isActive = isSpinning && lastWin > 0 && activeMultiplierIdx === idx;
                const isPassed = isSpinning && lastWin > 0 && activeMultiplierIdx > idx;
                return (
                  <div
                    key={m}
                    className={`rounded-lg px-2 sm:px-3 py-1 font-mono-num text-[11px] sm:text-xs font-extrabold transition-all ${
                      isActive
                        ? 'bg-amber-400 text-emerald-950 scale-110 shadow-[0_0_20px_rgba(251,191,36,0.65)]'
                        : isPassed
                          ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50'
                          : 'bg-[#031c16] text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    ×{m}
                  </div>
                );
              })}
            </div>

            <div className="text-right">
              <span className="text-[11px] font-semibold text-emerald-300">
                Real Mode · {theme.inspiredFeature}
              </span>
            </div>
          </div>

          {/* 6×5 CASCADING REEL GRID — Fills full stage height & width */}
          <div className="relative flex-1 min-h-[260px] overflow-hidden rounded-2xl border border-amber-500/35 bg-[#02120d]/95 p-1.5 sm:p-2.5 shadow-inner flex flex-col">
            <div className="grid flex-1 grid-cols-6 grid-rows-5 gap-1 sm:gap-1.5 h-full">
              {grid.map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const key = `${rIdx},${cIdx}`;
                  const isBreaking = breakingKeys.has(key);
                  const isScatterHit = scatterKeys.has(key);
                  const isTransforming = transformKeys.has(key);
                  const visual = theme.symbols[cell.symbol];
                  const isClearing = reelPhase === 'clearing';
                  const isDropping = reelPhase === 'dropping';
                  const isCascadeNew = reelPhase === 'cascading' && Boolean(cell.isNew);
                  const rowFromBottom = ROWS - 1 - rIdx;

                  const clearDelay =
                    cIdx * activeSpeed.clearColStepSec + rowFromBottom * activeSpeed.clearRowStepSec;
                  const dropDelay =
                    cIdx * activeSpeed.dropColStepSec + rowFromBottom * activeSpeed.dropRowStepSec;
                  const cascadeDelay =
                    cIdx * activeSpeed.cascadeColStepSec + rowFromBottom * activeSpeed.cascadeRowStepSec;

                  let cardSurface =
                    'bg-gradient-to-b from-[#fffef9] via-[#ffffff] to-[#f2ecdf] border border-stone-300/95 shadow-sm';
                  if (cell.isScatter) {
                    cardSurface =
                      'bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 border-2 border-yellow-100 shadow-[0_0_16px_rgba(251,191,36,0.55)]';
                  } else if (cell.symbol === 'WILD_BIG') {
                    cardSurface =
                      'bg-gradient-to-br from-red-500 via-amber-400 to-yellow-300 border-2 border-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.7)]';
                  } else if (cell.symbol === 'WILD_SMALL') {
                    cardSurface =
                      'bg-gradient-to-br from-emerald-300 via-amber-200 to-yellow-400 border-2 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.45)]';
                  } else if (cell.isGolden) {
                    cardSurface =
                      'bg-gradient-to-b from-amber-100 via-yellow-200 to-amber-300 border-2 border-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.45)]';
                  }

                  return (
                    <motion.div
                      key={`${spinSeq}-${cell.id}`}
                      layout={reelPhase === 'cascading'}
                      initial={
                        isDropping
                          ? { opacity: 0.15, y: -280, scale: 0.94 }
                          : isCascadeNew
                            ? { opacity: 0, y: -120, scale: 0.9 }
                            : false
                      }
                      animate={
                        isClearing
                          ? { opacity: 0, y: 260, scale: 0.94 }
                          : {
                              opacity: isBreaking ? 0.25 : 1,
                              y: 0,
                              scale: isBreaking
                                ? 1.12
                                : isScatterHit || isTransforming
                                  ? [1, 1.14, 1]
                                  : 1,
                              rotate: isTransforming ? [0, -8, 8, 0] : 0,
                            }
                      }
                      transition={
                        isClearing
                          ? {
                              duration: activeSpeed.clearDurationSec,
                              delay: clearDelay,
                              ease: 'easeIn',
                            }
                          : isDropping
                            ? {
                                type: 'spring',
                                stiffness: activeSpeed.dropStiffness,
                                damping: activeSpeed.dropDamping,
                                mass: activeSpeed.dropMass,
                                delay: dropDelay,
                              }
                            : isCascadeNew
                              ? {
                                  type: 'spring',
                                  stiffness: activeSpeed.dropStiffness,
                                  damping: activeSpeed.dropDamping,
                                  delay: cascadeDelay,
                                }
                              : {
                                  duration: spinSpeed === 'extra_fast' ? 0.14 : 0.24,
                                }
                      }
                      className={`relative w-full h-full min-h-[48px] rounded-lg sm:rounded-xl flex flex-col items-center justify-between p-1 select-none overflow-hidden ${cardSurface} ${
                        isBreaking ? 'ring-2 ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.95)]' : ''
                      } ${isScatterHit ? 'ring-2 ring-white' : ''}`}
                    >
                      {gameKey === 'superace' ? (() => {
                        const cardSpec: Record<
                          SuperAceSymbol,
                          {
                            cornerRank: string;
                            suit: Suit;
                            colorClass: string;
                            court?: 'J' | 'Q' | 'K' | 'JOKER';
                            frameBg?: string;
                            frameBorder?: string;
                            badge?: string;
                          }
                        > = {
                          ACE: {
                            cornerRank: 'A',
                            suit: '♠',
                            colorClass: 'text-indigo-950',
                            frameBg: 'from-indigo-100/90 via-white to-slate-100/90',
                            frameBorder: 'border-indigo-400/75',
                          },
                          KING: {
                            cornerRank: 'K',
                            suit: '♥',
                            colorClass: 'text-red-600',
                            court: 'K',
                            frameBg: 'from-rose-100/90 via-white to-red-50/90',
                            frameBorder: 'border-rose-400/80',
                          },
                          QUEEN: {
                            cornerRank: 'Q',
                            suit: '♦',
                            colorClass: 'text-blue-600',
                            court: 'Q',
                            frameBg: 'from-sky-100/90 via-white to-blue-50/90',
                            frameBorder: 'border-sky-400/80',
                          },
                          JACK: {
                            cornerRank: 'J',
                            suit: '♣',
                            colorClass: 'text-emerald-700',
                            court: 'J',
                            frameBg: 'from-emerald-100/90 via-white to-teal-50/90',
                            frameBorder: 'border-emerald-400/80',
                          },
                          SPADE: { cornerRank: '♠', suit: '♠', colorClass: 'text-indigo-950' },
                          HEART: { cornerRank: '♥', suit: '♥', colorClass: 'text-red-600' },
                          DIAMOND: { cornerRank: '♦', suit: '♦', colorClass: 'text-blue-600' },
                          CLUB: { cornerRank: '♣', suit: '♣', colorClass: 'text-emerald-700' },
                          WILD_SMALL: {
                            cornerRank: 'JK',
                            suit: '★',
                            colorClass: 'text-purple-800',
                            court: 'JOKER',
                            frameBg: 'from-amber-100 via-white to-purple-100',
                            frameBorder: 'border-amber-500',
                            badge: 'WILD',
                          },
                          WILD_BIG: {
                            cornerRank: 'JK',
                            suit: '★',
                            colorClass: 'text-red-900',
                            court: 'JOKER',
                            frameBg: 'from-amber-200 via-yellow-50 to-red-100',
                            frameBorder: 'border-red-500',
                            badge: 'BIG WILD',
                          },
                          SCATTER: {
                            cornerRank: '★',
                            suit: '★',
                            colorClass: 'text-amber-950',
                            badge: 'SCATTER',
                          },
                        };

                        const spec = cardSpec[cell.symbol];
                        const isRankFace =
                          cell.symbol === 'ACE' ||
                          cell.symbol === 'KING' ||
                          cell.symbol === 'QUEEN' ||
                          cell.symbol === 'JACK' ||
                          cell.isWild;

                        return (
                          <>
                            {/* Real playing card inner hairline */}
                            <div
                              className={`pointer-events-none absolute inset-[2px] rounded-[7px] sm:rounded-[9px] border ${
                                cell.isGolden
                                  ? 'border-amber-600/60'
                                  : cell.isScatter
                                    ? 'border-yellow-100/80'
                                    : 'border-stone-300/75'
                              }`}
                              aria-hidden="true"
                            />

                            {/* Top-Left Real Card Stacked Index */}
                            <div
                              className={`absolute top-[2px] left-[3px] z-10 flex flex-col items-center leading-none ${spec.colorClass}`}
                            >
                              {isRankFace ? (
                                <>
                                  <span className="font-display text-[9px] sm:text-[11px] font-black tracking-tighter leading-[0.95]">
                                    {spec.cornerRank}
                                  </span>
                                  <BoldSuitIcon
                                    suit={spec.suit}
                                    className="w-[8px] h-[8px] sm:w-[10px] sm:h-[10px] mt-[1px]"
                                  />
                                </>
                              ) : (
                                <BoldSuitIcon
                                  suit={spec.suit}
                                  className="w-[9px] h-[9px] sm:w-[11px] sm:h-[11px]"
                                />
                              )}
                            </div>

                            {/* Bottom-Right Real Card Inverted Index (180°) */}
                            <div
                              className={`absolute bottom-[2px] right-[3px] z-10 flex flex-col items-center leading-none rotate-180 ${spec.colorClass}`}
                            >
                              {isRankFace ? (
                                <>
                                  <span className="font-display text-[9px] sm:text-[11px] font-black tracking-tighter leading-[0.95]">
                                    {spec.cornerRank}
                                  </span>
                                  <BoldSuitIcon
                                    suit={spec.suit}
                                    className="w-[8px] h-[8px] sm:w-[10px] sm:h-[10px] mt-[1px]"
                                  />
                                </>
                              ) : (
                                <BoldSuitIcon
                                  suit={spec.suit}
                                  className="w-[9px] h-[9px] sm:w-[11px] sm:h-[11px]"
                                />
                              )}
                            </div>

                            {/* Gold Card Corner Tag */}
                            {cell.isGolden && !cell.isWild && !cell.isScatter && (
                              <span className="absolute top-[3px] right-[3px] z-10 rounded bg-amber-600 px-1 py-[1px] text-[6px] sm:text-[7px] font-black uppercase text-amber-50 leading-none shadow">
                                GOLD
                              </span>
                            )}

                            {/* Center Real Card Artwork */}
                            <div className="relative flex-1 w-full h-full flex items-center justify-center px-[9px] py-[4px] sm:px-[12px] sm:py-[6px]">
                              {cell.isScatter ? (
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <BoldSuitIcon suit="★" className="w-7 h-7 sm:w-10 sm:h-10" />
                                  <span className="rounded bg-amber-950/90 px-1.5 py-[1px] text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-amber-200 border border-amber-300/60">
                                    SCATTER
                                  </span>
                                </div>
                              ) : spec.court ? (
                                <div
                                  className={`w-full h-full rounded-[5px] border ${spec.frameBorder} ring-1 ring-inset ring-amber-400/50 bg-gradient-to-b ${spec.frameBg} flex items-center justify-center overflow-hidden shadow-inner relative`}
                                >
                                  <BoldSuitIcon
                                    suit={spec.suit}
                                    className="absolute top-[1.5px] right-[1.5px] w-[7px] h-[7px] sm:w-[9px] sm:h-[9px] opacity-85"
                                  />
                                  <BoldSuitIcon
                                    suit={spec.suit}
                                    className="absolute bottom-[1.5px] left-[1.5px] w-[7px] h-[7px] sm:w-[9px] sm:h-[9px] rotate-180 opacity-85"
                                  />
                                  <CourtPortrait
                                    rank={spec.court}
                                    suit={spec.suit}
                                    className="w-[92%] h-[92%]"
                                  />
                                  {spec.badge && (
                                    <span className="absolute bottom-[1px] inset-x-[2px] text-center rounded bg-black/80 px-1 py-[1px] text-[6px] sm:text-[7px] font-black uppercase text-amber-300 leading-none">
                                      {spec.badge}
                                    </span>
                                  )}
                                </div>
                              ) : cell.symbol === 'ACE' ? (
                                <div className="rounded-full border border-amber-400/80 bg-gradient-to-b from-indigo-100/90 via-white to-slate-100/90 p-1 sm:p-1.5 shadow-inner flex items-center justify-center">
                                  <BoldSuitIcon
                                    suit="♠"
                                    className="w-6 h-6 sm:w-9 sm:h-9"
                                  />
                                </div>
                              ) : (
                                <BoldSuitIcon
                                  suit={spec.suit}
                                  className="w-6 h-6 sm:w-9 sm:h-9"
                                />
                              )}
                            </div>
                          </>
                        );
                      })() : (
                        <>
                          <div className="w-full flex items-center justify-between leading-none">
                            <span
                              className={`font-display text-[10px] sm:text-xs font-black tracking-tight ${visual.textColor}`}
                            >
                              {cell.isScatter
                                ? '★'
                                : cell.isWild
                                  ? 'W'
                                  : visual.label.slice(0, 2)}
                            </span>
                            {cell.isGolden && !cell.isWild && !cell.isScatter && (
                              <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-amber-500 ring-1 ring-amber-200" />
                            )}
                          </div>

                          <div className="flex-1 w-full flex items-center justify-center min-h-0">
                            {visual.icon === '♠' || visual.icon === '♥' || visual.icon === '♦' || visual.icon === '♣' ? (
                              <BoldSuitIcon
                                suit={visual.icon as Suit}
                                className="max-h-full h-6 w-6 sm:h-9 sm:w-9"
                              />
                            ) : (
                              <span
                                className={`text-xl sm:text-3xl leading-none drop-shadow-xs ${visual.textColor}`}
                              >
                                {visual.icon}
                              </span>
                            )}
                          </div>

                          <span
                            className={`text-[7px] sm:text-[9px] font-black uppercase tracking-tight leading-none truncate max-w-full ${visual.textColor}`}
                          >
                            {visual.subLabel || (cell.isGolden ? 'GOLD' : visual.label)}
                          </span>
                        </>
                      )}

                      {isBreaking && (
                        <div className="absolute inset-0 bg-amber-300/45 animate-pulse pointer-events-none" />
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Cascade Win Floating Banner */}
            <AnimatePresence>
              {cascadeBanner && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-xl border border-amber-300/80 bg-[#031c16]/95 px-4 py-1.5 font-mono-num text-xs sm:text-sm font-extrabold text-amber-300 shadow-2xl whitespace-nowrap"
                >
                  {cascadeBanner}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tiered Big / Super / Excellent Win & 10-Free-Spin Total Win Celebration Overlay */}
            <AnimatePresence>
              {celebrationModal && (
                <SlotWinCelebration
                  payload={celebrationModal}
                  onDismiss={dismissCelebration}
                  turboMode={spinSpeed === 'extra_fast'}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT / BOTTOM CONTROL DECK: WIN READOUT · BETS · SPEED (SLOW / FAST / EXTRA FAST) · SPIN · AUTO */}
        <div className="shrink-0 w-full lg:w-[310px] landscape:w-[260px] sm:landscape:w-[300px] flex flex-col justify-between gap-2 rounded-2xl border border-emerald-800/70 bg-[#031c16]/90 p-2.5 sm:p-3 overflow-y-auto">
          {/* Live Win Strip */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-emerald-800/80 bg-[#02140f] px-2.5 py-2 text-center">
            <div>
              <span className="text-[9px] text-emerald-400 block uppercase">Spin Win</span>
              <span className="font-mono-num text-sm sm:text-base font-extrabold text-amber-300">
                ₱{lastWin.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <span className="text-[9px] text-emerald-400 block uppercase">Bet</span>
              <span className="font-mono-num text-sm sm:text-base font-extrabold text-white">
                ₱{displayBet.toFixed(displayBet < 1 ? 2 : 0)}
              </span>
            </div>

            <div>
              <span className="text-[9px] text-emerald-400 block uppercase">Rewards</span>
              <span className="font-mono-num text-xs sm:text-sm font-bold text-emerald-300">
                ₱{user.pending_cashback.toFixed(2)}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-500/50 bg-red-950/60 px-3 py-1.5 text-[11px] text-red-200">
              {errorMsg}
            </div>
          )}

          {/* BETTING DENOMINATION BAR (.5, 1, 2, 3, 5, 8, 10, 20, 30, 40, 50) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-emerald-200">Select Bet (₱0.5–₱50)</span>
              <span className="font-mono-num text-emerald-400">Spins: {slotState.totalRegularSpins}</span>
            </div>

            <div className="grid grid-cols-6 landscape:grid-cols-4 lg:grid-cols-4 gap-1">
              {SUPER_ACE_BETS.map((amount, idx) => {
                const active = idx === betIndex;
                return (
                  <button
                    key={amount}
                    type="button"
                    disabled={isSpinning}
                    onClick={() => handleSelectBet(idx)}
                    className={`rounded-lg py-1.5 font-mono-num text-[11px] font-extrabold transition-all cursor-pointer disabled:opacity-45 ${
                      active
                        ? 'bg-amber-400 text-emerald-950 shadow-md ring-2 ring-amber-200'
                        : 'border border-emerald-800 bg-[#052920] text-emerald-100 hover:border-amber-400/70'
                    }`}
                  >
                    {amount < 1 ? '.5' : amount}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3-SPEED SELECTOR: SLOW · FAST · EXTRA FAST */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-200">
                <Gauge className="h-3.5 w-3.5 text-amber-300" />
                Reel Drop Speed
              </span>
              <span className="font-bold text-amber-300">{activeSpeed.label}</span>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-emerald-800 bg-[#02140f] p-1">
              {SPEED_ORDER.map((mode) => {
                const selected = spinSpeed === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      playChipClink();
                      setSpinSpeed(mode);
                    }}
                    className={`rounded-lg py-1.5 px-1 text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                      selected
                        ? 'bg-amber-400 text-emerald-950 shadow'
                        : 'text-emerald-200 hover:bg-emerald-900/60 hover:text-amber-200'
                    }`}
                  >
                    {SPEED_PROFILES[mode].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PRIMARY ACTION DECK: Bet Steppers · SPIN · AUTO SPIN */}
          <div className="space-y-1.5">
            <button
              type="button"
              disabled={isSpinning}
              onClick={executeSpin}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3 px-4 font-display text-base sm:text-lg font-black transition-all shadow-xl cursor-pointer disabled:opacity-65 bg-gradient-to-r from-emerald-400 via-emerald-300 to-amber-300 text-emerald-950 hover:brightness-105"
            >
              <RotateCw className={`h-5 w-5 ${isSpinning ? 'animate-spin' : ''}`} />
              {isSpinning ? 'SPINNING...' : `SPIN ₱${displayBet}`}
            </button>

            <div className="relative flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Decrease bet"
                disabled={isSpinning || betIndex === 0}
                onClick={() => handleSelectBet(Math.max(0, betIndex - 1))}
                className="rounded-xl border border-emerald-700 bg-[#052920] p-2.5 text-emerald-100 hover:border-amber-400 disabled:opacity-40 cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Increase bet"
                disabled={isSpinning || betIndex === SUPER_ACE_BETS.length - 1}
                onClick={() => handleSelectBet(Math.min(SUPER_ACE_BETS.length - 1, betIndex + 1))}
                className="rounded-xl border border-emerald-700 bg-[#052920] p-2.5 text-emerald-100 hover:border-amber-400 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>

              {autoSpinsLeft > 0 ? (
                <button
                  type="button"
                  onClick={stopAutoSpin}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-red-500 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Stop ({autoSpinsLeft === 9999 ? '∞' : autoSpinsLeft})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAutoMenuOpen((v) => !v)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/60 bg-[#052920] px-3 py-2.5 text-xs font-extrabold text-amber-300 hover:bg-amber-400 hover:text-emerald-950 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Repeat className="h-4 w-4" />
                  Auto Spin
                </button>
              )}

              {autoMenuOpen && (
                <div className="absolute bottom-12 right-0 z-40 w-48 rounded-2xl border border-amber-400/50 bg-[#052920] p-2.5 shadow-2xl space-y-1.5">
                  <p className="text-[11px] font-bold text-amber-300 px-2 pb-1 border-b border-emerald-800">
                    Select Auto Spins
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[10, 25, 50, 100].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => startAutoSpin(cnt)}
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#031c16] border border-emerald-800 py-2 text-xs font-mono-num font-bold text-white hover:border-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        <Play className="h-3 w-3" />
                        {cnt}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => startAutoSpin(9999)}
                    className="w-full rounded-xl bg-amber-400/20 border border-amber-400/50 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400 hover:text-emerald-950 cursor-pointer"
                  >
                    Continuous (Until Stop)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
