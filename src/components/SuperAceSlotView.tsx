import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Coins,
  Crown,
  Maximize2,
  Minimize2,
  Minus,
  Play,
  Plus,
  Repeat,
  RotateCw,
  ShoppingBag,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
  Zap,
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

// Flash (single ⚡) = Slow row-by-row drop | Double Flash (⚡⚡) = Fast drop
type SlotSpinSpeed = 'slow' | 'fast';

interface SpeedProfile {
  label: string;
  clearMinMs: number;
  clearDurationSec: number;
  clearRowStepSec: number;
  clearColStepSec: number;
  dropRowStepMs: number;
  dropRowStepSec: number;
  dropColStepSec: number;
  dropStiffness: number;
  dropDamping: number;
  dropMass: number;
  landOffsetMs: number;
  totalDropTailMs: number;
  cascadeRowStepSec: number;
  cascadeColStepSec: number;
  sleepScale: number;
  autoDelayMs: number;
}

const SPEED_PROFILES: Record<SlotSpinSpeed, SpeedProfile> = {
  slow: {
    label: 'Slow Spin',
    clearMinMs: 420,
    clearDurationSec: 0.3,
    clearRowStepSec: 0.068,
    clearColStepSec: 0.012,
    // Row 1 drops down -> then Row 2 -> Row 3 -> Row 4 -> Row 5 slowly & clearly!
    dropRowStepMs: 240,
    dropRowStepSec: 0.24,
    dropColStepSec: 0.016,
    dropStiffness: 170,
    dropDamping: 20,
    dropMass: 1.05,
    landOffsetMs: 260,
    totalDropTailMs: 560,
    cascadeRowStepSec: 0.085,
    cascadeColStepSec: 0.014,
    sleepScale: 1.08,
    autoDelayMs: 650,
  },
  fast: {
    label: 'Fast Spin',
    clearMinMs: 185,
    clearDurationSec: 0.16,
    clearRowStepSec: 0.028,
    clearColStepSec: 0.006,
    dropRowStepMs: 85,
    dropRowStepSec: 0.085,
    dropColStepSec: 0.008,
    dropStiffness: 390,
    dropDamping: 27,
    dropMass: 0.8,
    landOffsetMs: 140,
    totalDropTailMs: 280,
    cascadeRowStepSec: 0.032,
    cascadeColStepSec: 0.008,
    sleepScale: 0.62,
    autoDelayMs: 320,
  },
};

const COLS = 6;
const ROWS = 5;
const BUY_SPIN_MULTIPLIER = 100;

const REGULAR_MULTS = [1, 2, 3, 4, 5];
const FREE_SPIN_MULTS = [2, 4, 6, 8, 10];

// Big Win / Super Win / Excellent Win highlight duration: full 5 seconds with sparks!
const BIG_WIN_HIGHLIGHT_MS = 5000;

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
    buyBonusTargetWin: 0,
    buyBonusRatePct: 0,
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
  const [betDrawerOpen, setBetDrawerOpen] = useState<boolean>(false);
  const [buyModalOpen, setBuyModalOpen] = useState<boolean>(false);
  // Default Slow (⚡) so row-by-row slow card drop is clearly visible; switchable to Fast (⚡⚡)
  const [spinSpeed, setSpinSpeed] = useState<SlotSpinSpeed>('slow');
  const [muted, setMuted] = useState<boolean>(isAudioMuted());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isFullscreenActive());

  const mountedRef = useRef(true);
  const isSpinningRef = useRef(false);
  const autoSpinsRef = useRef(0);
  const spinSpeedRef = useRef<SlotSpinSpeed>('slow');
  const slotStateRef = useRef<SuperAcePlayerState>(slotState);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationResolverRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    spinSpeedRef.current = spinSpeed;
  }, [spinSpeed]);

  useEffect(() => {
    slotStateRef.current = slotState;
  }, [slotState]);

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
  const isFreeSpinMode = slotState.freeSpinsRemaining > 0;
  const selectedBet = SUPER_ACE_BETS[betIndex] ?? 1;
  const displayBet = isFreeSpinMode ? slotState.freeSpinBet : selectedBet;
  const buySpinCost = Number((selectedBet * BUY_SPIN_MULTIPLIER).toFixed(2));
  const activeMultipliers = isFreeSpinMode ? FREE_SPIN_MULTS : REGULAR_MULTS;

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
    (payload: SlotCelebrationPayload, durationMs: number) =>
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
        celebrationTimerRef.current = setTimeout(() => {
          celebrationTimerRef.current = null;
          if (mountedRef.current) setCelebrationModal(null);
          const done = celebrationResolverRef.current;
          celebrationResolverRef.current = null;
          if (done) done();
        }, durationMs);
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

  // Load persisted slot state (including any active Free Scatter Spins)
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
          setSlotState(data.state);
          slotStateRef.current = data.state;
        }
        if (data.profile) onProfileUpdated(data.profile);
      })
      .catch(() => {});
  }, [gameKey, user.id, onProfileUpdated, dismissCelebration]);

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

  // Shared animation runner for both normal/free spins and Buy Free Spin Scatter entry
  const animateSpinResult = useCallback(
    async (
      result: SuperAceSpinResult,
      clearStartAt: number,
      speed: SpeedProfile,
      previousFreeSpinsRemaining: number
    ) => {
      if (!mountedRef.current) return;

      // Ensure old cards sweep down cleanly row-by-row before new rows drop in
      const elapsedClear = performance.now() - clearStartAt;
      if (elapsedClear < speed.clearMinMs) {
        await new Promise<void>((resolve) => setTimeout(resolve, speed.clearMinMs - elapsedClear));
      }
      if (!mountedRef.current) return;

      // Drop new cards down PER ROW sequentially: Row 1 -> Row 2 -> Row 3 -> Row 4 -> Row 5
      setSpinSeq((prev) => prev + 1);
      setReelPhase('dropping');
      setGrid(result.initialGrid);

      for (let row = 0; row < ROWS; row++) {
        setTimeout(() => {
          if (mountedRef.current) playReelStop(row);
        }, row * speed.dropRowStepMs + speed.landOffsetMs);
      }

      const totalDropMs = (ROWS - 1) * speed.dropRowStepMs + speed.totalDropTailMs;
      await new Promise<void>((resolve) => setTimeout(resolve, totalDropMs));
      if (!mountedRef.current) return;
      setReelPhase('cascading');

      // Highlight Scatter drops
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

      // Play cascading wins
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
        const wildTag = step.wildMultiplier && step.wildMultiplier > 1 ? ` · MULTI WILD ×${step.wildMultiplier}` : '';
        setCascadeBanner(`×${step.multiplier}${wildTag} · +₱${step.stepWin.toFixed(2)}`);
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

      setSlotState(result.state);
      slotStateRef.current = result.state;
      onProfileUpdated(result.profile);

      const tierTitle = (tier: SlotWinTier): string =>
        tier === 'excellent' ? 'EXCELLENT WIN!' : tier === 'super' ? 'SUPER WIN!' : 'BIG WIN!';

      const spinTier = classifySlotWinTier(result.totalWin, result.betAmount);
      const finishedFreeSpinRound =
        previousFreeSpinsRemaining > 0 && result.state.freeSpinsRemaining === 0;

      // 1) Scatter Free Spins triggered!
      if (result.triggeredFreeSpins > 0) {
        await presentCelebration(
          {
            kind: 'scatter',
            tier: spinTier,
            eyebrow: result.wasBuySpin
              ? `BUY FREE SPIN SCATTER (₱${(result.buyCost ?? 0).toFixed(0)})`
              : 'FREE SCATTER SPIN TRIGGERED',
            title: `${result.triggeredFreeSpins} FREE SPINS!`,
            subtitle:
              result.wasFreeSpin
                ? `+${result.triggeredFreeSpins} Extra Free Spins Added · Multipliers ×2–×10`
                : 'Multipliers Upgraded to ×2 · ×4 · ×6 · ×8 · ×10',
            amount: result.totalWin > 0 ? result.totalWin : undefined,
            audioTier: spinTier ?? 'scatter',
          },
          spinTier ? BIG_WIN_HIGHLIGHT_MS : 2600,
        );
      } else if (spinTier) {
        // 2) Big Win / Super Win / Excellent Win -> ALWAYS highlighted with sparks for 5 FULL SECONDS!
        await presentCelebration(
          {
            kind: 'win',
            tier: spinTier,
            eyebrow: theme.title.toUpperCase(),
            title: tierTitle(spinTier),
            subtitle:
              result.cascades.length > 1
                ? `${result.cascades.length} Cascade Chain Win Credited to Wallet`
                : 'Spin Win Credited to Wallet',
            amount: result.totalWin,
            audioTier: spinTier,
          },
          BIG_WIN_HIGHLIGHT_MS,
        );
      }

      // 3) Free Scatter Spins Round Complete -> Show Total Bonus Win for 5s if Big/Super/Excellent!
      if (finishedFreeSpinRound && result.state.freeSpinTotalWin > 0) {
        const bonusTier = classifySlotWinTier(result.state.freeSpinTotalWin, result.betAmount);
        await presentCelebration(
          {
            kind: 'bonus_total',
            tier: bonusTier ?? 'big',
            eyebrow: `${result.state.freeSpinsTotal} FREE SCATTER SPINS COMPLETE`,
            title: bonusTier ? tierTitle(bonusTier) : 'FREE SPINS TOTAL WIN!',
            subtitle: 'Total Scatter Bonus Credited to Wallet',
            amount: result.state.freeSpinTotalWin,
            audioTier: bonusTier ?? 'big',
          },
          BIG_WIN_HIGHLIGHT_MS,
        );
      }
    },
    [onProfileUpdated, presentCelebration, theme.title]
  );

  const executeSpin = useCallback(async () => {
    if (isSpinningRef.current) return;
    setErrorMsg('');
    setBetDrawerOpen(false);
    setBuyModalOpen(false);

    const currentSlotState = slotStateRef.current;
    const freeSpinNow = currentSlotState.freeSpinsRemaining > 0;
    const betToSend = freeSpinNow ? currentSlotState.freeSpinBet : SUPER_ACE_BETS[betIndex];

    if (!freeSpinNow && user.wallet_balance < betToSend) {
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
      await animateSpinResult(result, clearStartAt, speed, currentSlotState.freeSpinsRemaining);

      isSpinningRef.current = false;
      setIsSpinning(false);
      setReelPhase('idle');
      setScatterKeys(new Set());

      // Continue auto-spin OR auto-play remaining Free Scatter Spins if Auto is active
      if (mountedRef.current && autoSpinsRef.current > 0) {
        const nextRemaining =
          result.state.freeSpinsRemaining > 0
            ? autoSpinsRef.current
            : autoSpinsRef.current === 9999
              ? 9999
              : autoSpinsRef.current - 1;
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
  }, [gameKey, betIndex, user.id, user.wallet_balance, stopAutoSpin, animateSpinResult]);

  const executeBuySpin = useCallback(async () => {
    if (isSpinningRef.current) return;
    setErrorMsg('');
    setBuyModalOpen(false);
    setBetDrawerOpen(false);

    if (slotStateRef.current.freeSpinsRemaining > 0) {
      setErrorMsg('Finish your active Free Scatter Spins first.');
      return;
    }

    const betToSend = SUPER_ACE_BETS[betIndex];
    const cost = Number((betToSend * BUY_SPIN_MULTIPLIER).toFixed(2));
    if (user.wallet_balance < cost) {
      setErrorMsg(`Insufficient wallet balance. Need ₱${cost.toFixed(2)} to Buy Free Spin Scatter at ₱${betToSend} bet.`);
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
      const res = await fetch(`/api/slots/${encodeURIComponent(gameKey)}/buy-spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, betAmount: betToSend }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not complete Buy Free Spin Scatter.');
        isSpinningRef.current = false;
        setIsSpinning(false);
        setReelPhase('idle');
        return;
      }

      const result = data as SuperAceSpinResult;
      await animateSpinResult(result, clearStartAt, speed, 0);

      isSpinningRef.current = false;
      setIsSpinning(false);
      setReelPhase('idle');
      setScatterKeys(new Set());
    } catch {
      setErrorMsg('Network error during Buy Spin. Please try again.');
      isSpinningRef.current = false;
      setIsSpinning(false);
      setReelPhase('idle');
    }
  }, [gameKey, betIndex, user.id, user.wallet_balance, animateSpinResult]);

  const startAutoSpin = (count: number) => {
    setAutoMenuOpen(false);
    setAutoSpinsLeft(count);
    autoSpinsRef.current = count;
    if (!isSpinningRef.current) {
      executeSpin();
    }
  };

  const handleSelectBet = (idx: number) => {
    if (isSpinning || isFreeSpinMode) return;
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
              {isFreeSpinMode
                ? `FREE SCATTER MODE · ${slotState.freeSpinsRemaining}/${slotState.freeSpinsTotal} Spins Left · Bonus ₱${slotState.freeSpinTotalWin.toFixed(2)}`
                : '6×5 Cascading Reels · Wild & Multi Wild · Scatter Free Spins'}
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

      {/* FULL-SCREEN 6×5 SLOT CABINET */}
      <div
        className={`relative flex-1 min-h-0 w-full rounded-2xl sm:rounded-3xl border-2 p-2 sm:p-3.5 shadow-2xl transition-colors flex flex-col lg:flex-row landscape:flex-row gap-2.5 overflow-y-auto lg:overflow-hidden landscape:overflow-hidden ${
          isFreeSpinMode
            ? `border-amber-300 shadow-[0_0_32px_rgba(251,191,36,0.28)] bg-gradient-to-b ${theme.freeSpinGradient}`
            : `${theme.accentBorder} bg-gradient-to-b ${theme.cabinetGradient}`
        }`}
      >
        {/* LEFT / MAIN STAGE: MULTIPLIERS + 6×5 REELS + TABLE PLAY STRIP */}
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
                          : isFreeSpinMode
                            ? 'bg-amber-950/70 text-amber-200 border border-amber-400/50'
                            : 'bg-[#031c16] text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    ×{m}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-right">
              {isFreeSpinMode ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300/80 bg-amber-400/20 px-2.5 py-0.5 font-mono-num text-[11px] font-extrabold text-amber-200">
                  <Sparkles className="h-3 w-3 text-amber-300" />
                  FREE SPINS: {slotState.freeSpinsRemaining}/{slotState.freeSpinsTotal} · BONUS ₱
                  {slotState.freeSpinTotalWin.toFixed(2)}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-300">
                  {theme.inspiredFeature}
                </span>
              )}
            </div>
          </div>

          {/* 6×5 CASCADING REEL GRID — Drops Down Slowly Per Row (Row 1 -> Row 2 -> Row 3 -> Row 4 -> Row 5) */}
          <div className="relative flex-1 min-h-[250px] overflow-hidden rounded-2xl border border-amber-500/35 bg-[#02120d]/95 p-1.5 sm:p-2.5 shadow-inner flex flex-col">
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

                  // Clearing sweeps down row-by-row from bottom row out first
                  const clearDelay =
                    rowFromBottom * activeSpeed.clearRowStepSec + cIdx * activeSpeed.clearColStepSec;
                  // New cards drop down PER ROW sequentially: Row 1 (rIdx=0) -> Row 2 -> Row 3 -> Row 4 -> Row 5
                  const dropDelay =
                    rIdx * activeSpeed.dropRowStepSec + cIdx * activeSpeed.dropColStepSec;
                  const cascadeDelay =
                    rIdx * activeSpeed.cascadeRowStepSec + cIdx * activeSpeed.cascadeColStepSec;

                  let cardSurface =
                    'bg-gradient-to-b from-[#fffef9] via-[#ffffff] to-[#f2ecdf] border border-stone-300/95 shadow-sm';
                  if (cell.isScatter) {
                    cardSurface =
                      'bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 border-2 border-yellow-100 shadow-[0_0_16px_rgba(251,191,36,0.55)]';
                  } else if (cell.symbol === 'WILD_BIG') {
                    cardSurface =
                      'bg-gradient-to-br from-red-500 via-amber-400 to-yellow-300 border-2 border-amber-100 shadow-[0_0_20px_rgba(239,68,68,0.75)]';
                  } else if (cell.symbol === 'WILD_SMALL') {
                    cardSurface =
                      'bg-gradient-to-br from-emerald-300 via-amber-200 to-yellow-400 border-2 border-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.5)]';
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
                          ? { opacity: 0.1, y: -260, scale: 0.94 }
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
                                  duration: spinSpeed === 'fast' ? 0.16 : 0.26,
                                }
                      }
                      className={`relative w-full h-full min-h-[46px] rounded-lg sm:rounded-xl flex flex-col items-center justify-between p-1 select-none overflow-hidden ${cardSurface} ${
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
                            cornerRank: 'W',
                            suit: '★',
                            colorClass: 'text-purple-800',
                            court: 'JOKER',
                            frameBg: 'from-amber-100 via-white to-emerald-100',
                            frameBorder: 'border-amber-500',
                            badge: 'WILD',
                          },
                          WILD_BIG: {
                            cornerRank: '×2',
                            suit: '★',
                            colorClass: 'text-red-900',
                            court: 'JOKER',
                            frameBg: 'from-amber-200 via-yellow-50 to-red-100',
                            frameBorder: 'border-red-500',
                            badge: 'MULTI ×2',
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

                            {cell.isGolden && !cell.isWild && !cell.isScatter && (
                              <span className="absolute top-[3px] right-[3px] z-10 rounded bg-amber-600 px-1 py-[1px] text-[6px] sm:text-[7px] font-black uppercase text-amber-50 leading-none shadow">
                                GOLD
                              </span>
                            )}

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
                                    <span
                                      className={`absolute bottom-[1px] inset-x-[2px] text-center rounded px-1 py-[1px] text-[6px] sm:text-[7px] font-black uppercase leading-none ${
                                        cell.symbol === 'WILD_BIG'
                                          ? 'bg-red-700 text-yellow-100'
                                          : 'bg-black/80 text-amber-300'
                                      }`}
                                    >
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
                                : cell.symbol === 'WILD_BIG'
                                  ? '×2'
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
                            {cell.symbol === 'WILD_BIG'
                              ? 'MULTI WILD ×2'
                              : cell.symbol === 'WILD_SMALL'
                                ? 'WILD'
                                : visual.subLabel || (cell.isGolden ? 'GOLD' : visual.label)}
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

            {/* 5-Second Sparkling Big / Super / Excellent Win & Free Spins Total Celebration */}
            <AnimatePresence>
              {celebrationModal && (
                <SlotWinCelebration
                  payload={celebrationModal}
                  onDismiss={dismissCelebration}
                  turboMode={spinSpeed === 'fast'}
                />
              )}
            </AnimatePresence>
          </div>

          {/* TABLE PLAY BAR: BET AMOUNT | WIN : AMOUNT (PER SPIN) | ⚡ SLOW & ⚡⚡ FAST | COINS BET BUTTON */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-800/80 bg-[#031c16]/95 px-2.5 sm:px-3.5 py-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-xs font-bold uppercase text-emerald-400">
                  Bet:
                </span>
                <span className="font-mono-num text-sm sm:text-base font-extrabold text-white">
                  ₱{displayBet.toFixed(displayBet < 1 ? 2 : 0)}
                </span>
              </div>
              <div className="h-4 w-px bg-emerald-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-xs font-bold uppercase text-emerald-400">
                  Win :
                </span>
                <span
                  className={`font-mono-num text-sm sm:text-base font-extrabold transition-colors ${
                    lastWin > 0
                      ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]'
                      : 'text-emerald-200'
                  }`}
                >
                  ₱{lastWin.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Table Speed (⚡ Slow / ⚡⚡ Fast) & Coins Bet Trigger */}
            <div className="flex items-center gap-1.5">
              {/* Single Flash Sign (⚡) = Slow Spin */}
              <button
                type="button"
                onClick={() => {
                  playChipClink();
                  setSpinSpeed('slow');
                }}
                title="Slow Spin (Row-by-Row Card Drop)"
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition-all cursor-pointer ${
                  spinSpeed === 'slow'
                    ? 'border-amber-300 bg-amber-400 text-emerald-950 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                    : 'border-emerald-700 bg-[#02140f] text-emerald-200 hover:border-amber-400'
                }`}
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>Slow</span>
              </button>

              {/* Double Flash Sign (⚡⚡) = Fast Spin */}
              <button
                type="button"
                onClick={() => {
                  playChipClink();
                  setSpinSpeed('fast');
                }}
                title="Fast Spin"
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition-all cursor-pointer ${
                  spinSpeed === 'fast'
                    ? 'border-amber-300 bg-amber-400 text-emerald-950 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                    : 'border-emerald-700 bg-[#02140f] text-emerald-200 hover:border-amber-400'
                }`}
              >
                <span className="inline-flex items-center -space-x-1.5">
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  <Zap className="h-3.5 w-3.5 fill-current" />
                </span>
                <span>Fast</span>
              </button>

              {/* Coins Sign (Betting Button + Interactive Popover) */}
              <div className="relative">
                <button
                  type="button"
                  disabled={isSpinning || isFreeSpinMode}
                  onClick={() => {
                    playChipClink();
                    setBetDrawerOpen((v) => !v);
                  }}
                  title="Select Bet Amount"
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition-all cursor-pointer disabled:opacity-45 ${
                    betDrawerOpen
                      ? 'border-amber-300 bg-amber-400 text-emerald-950'
                      : 'border-amber-400/70 bg-[#052920] text-amber-300 hover:bg-amber-400 hover:text-emerald-950'
                  }`}
                >
                  <Coins className="h-3.5 w-3.5" />
                  <span>₱{displayBet}</span>
                </button>

                {betDrawerOpen && (
                  <div className="absolute bottom-10 right-0 z-40 w-56 rounded-2xl border border-amber-400/70 bg-[#052920] p-2.5 shadow-2xl space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5" />
                        Select Bet Amount
                      </span>
                      <button
                        type="button"
                        onClick={() => setBetDrawerOpen(false)}
                        className="text-emerald-300 hover:text-white cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {SUPER_ACE_BETS.map((amount, idx) => {
                        const active = idx === betIndex;
                        return (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => {
                              handleSelectBet(idx);
                              setBetDrawerOpen(false);
                            }}
                            className={`rounded-lg py-1.5 font-mono-num text-[11px] font-extrabold transition cursor-pointer ${
                              active
                                ? 'bg-amber-400 text-emerald-950 ring-2 ring-amber-200'
                                : 'border border-emerald-800 bg-[#031c16] text-emerald-100 hover:border-amber-400'
                            }`}
                          >
                            {amount < 1 ? '.5' : amount}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT / BOTTOM CONTROL DECK: BUY SPIN · COINS BETTING · PLAY/SPIN · AUTO SPIN */}
        <div className="shrink-0 w-full lg:w-[300px] landscape:w-[255px] sm:landscape:w-[290px] flex flex-col justify-between gap-2 rounded-2xl border border-emerald-800/70 bg-[#031c16]/90 p-2.5 sm:p-3 overflow-y-auto">
          {/* BUY FREE SPIN SCATTER BUTTON (Bet 1 -> Buy 100) */}
          <button
            type="button"
            disabled={isSpinning || isFreeSpinMode}
            onClick={() => {
              playChipClink();
              setBuyModalOpen(true);
            }}
            className="w-full rounded-2xl border-2 border-amber-300/80 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-400 px-3 py-2.5 text-emerald-950 shadow-lg hover:brightness-105 disabled:opacity-45 transition cursor-pointer flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 text-left">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-950/90 text-amber-300 shrink-0">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <span className="block font-display text-xs font-black uppercase leading-tight">
                  Buy Free Spin
                </span>
                <span className="block text-[10px] font-bold text-emerald-950/80 leading-tight">
                  10 Scatter Free Spins (100× Bet)
                </span>
              </div>
            </div>
            <span className="rounded-xl bg-emerald-950 px-2.5 py-1 font-mono-num text-xs font-black text-amber-300 whitespace-nowrap">
              ₱{buySpinCost.toLocaleString('en-PH')}
            </span>
          </button>

          {errorMsg && (
            <div className="rounded-xl border border-red-500/50 bg-red-950/60 px-3 py-1.5 text-[11px] text-red-200">
              {errorMsg}
            </div>
          )}

          {/* COINS BETTING PANEL (Always accessible on desktop & collapsible via Coins button) */}
          <div className={`space-y-1.5 ${betDrawerOpen ? 'block' : 'block'}`}>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                <Coins className="h-3.5 w-3.5" />
                Bet Amount (₱0.5–₱50)
              </span>
              <span className="font-mono-num text-emerald-400">
                Spins: {slotState.totalRegularSpins}
              </span>
            </div>

            <div className="grid grid-cols-6 landscape:grid-cols-4 lg:grid-cols-4 gap-1">
              {SUPER_ACE_BETS.map((amount, idx) => {
                const active = idx === betIndex;
                return (
                  <button
                    key={amount}
                    type="button"
                    disabled={isSpinning || isFreeSpinMode}
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

          {/* SPEED CONTROL (⚡ Slow & ⚡⚡ Fast) + Rewards Summary */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-emerald-800/80 bg-[#02140f] p-1.5">
            <button
              type="button"
              onClick={() => {
                playChipClink();
                setSpinSpeed('slow');
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-extrabold transition cursor-pointer ${
                spinSpeed === 'slow'
                  ? 'bg-amber-400 text-emerald-950 shadow'
                  : 'text-emerald-200 hover:bg-emerald-900/60'
              }`}
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              Slow
            </button>
            <button
              type="button"
              onClick={() => {
                playChipClink();
                setSpinSpeed('fast');
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-extrabold transition cursor-pointer ${
                spinSpeed === 'fast'
                  ? 'bg-amber-400 text-emerald-950 shadow'
                  : 'text-emerald-200 hover:bg-emerald-900/60'
              }`}
            >
              <span className="inline-flex items-center -space-x-1.5">
                <Zap className="h-3.5 w-3.5 fill-current" />
                <Zap className="h-3.5 w-3.5 fill-current" />
              </span>
              Fast
            </button>
          </div>

          {/* PRIMARY TABLE PLAY DECK: SPIN / FREE SPIN · −/+ BET · AUTO SPIN */}
          <div className="space-y-1.5">
            <button
              type="button"
              disabled={isSpinning}
              onClick={executeSpin}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3 px-4 font-display text-base sm:text-lg font-black transition-all shadow-xl cursor-pointer disabled:opacity-65 ${
                isFreeSpinMode
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-emerald-950 ring-2 ring-amber-200'
                  : 'bg-gradient-to-r from-emerald-400 via-emerald-300 to-amber-300 text-emerald-950 hover:brightness-105'
              }`}
            >
              <RotateCw className={`h-5 w-5 ${isSpinning ? 'animate-spin' : ''}`} />
              {isSpinning
                ? 'SPINNING...'
                : isFreeSpinMode
                  ? `FREE SPIN (${slotState.freeSpinsRemaining} LEFT)`
                  : `PLAY · ₱${displayBet}`}
            </button>

            <div className="relative flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Decrease bet"
                disabled={isSpinning || isFreeSpinMode || betIndex === 0}
                onClick={() => handleSelectBet(Math.max(0, betIndex - 1))}
                className="rounded-xl border border-emerald-700 bg-[#052920] p-2.5 text-emerald-100 hover:border-amber-400 disabled:opacity-40 cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Increase bet"
                disabled={isSpinning || isFreeSpinMode || betIndex === SUPER_ACE_BETS.length - 1}
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

      {/* BUY FREE SPIN SCATTER CONFIRMATION MODAL */}
      <AnimatePresence>
        {buyModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border-2 border-amber-400 bg-[#052920] p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-emerald-950">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-extrabold text-amber-300">
                      Buy Free Spin Scatter
                    </h3>
                    <p className="text-[11px] text-emerald-200">
                      Instant 3 Scatters · 10 Free Spins (×2–×10)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBuyModalOpen(false)}
                  className="rounded-lg p-1 text-emerald-300 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-2xl border border-emerald-700 bg-[#021611] p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-300">Active Bet Size</span>
                  <strong className="font-mono-num text-white">₱{selectedBet}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-300">Buy Free Spin Multiplier</span>
                  <strong className="font-mono-num text-amber-300">100× Bet</strong>
                </div>
                <div className="flex items-center justify-between border-t border-emerald-800 pt-2">
                  <span className="font-bold text-amber-200">Total Buy Cost</span>
                  <strong className="font-mono-num text-lg font-black text-amber-300">
                    ₱{buySpinCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {user.wallet_balance < buySpinCost && (
                <p className="text-center text-xs font-semibold text-red-300">
                  Wallet balance (₱{user.wallet_balance.toFixed(2)}) is below ₱{buySpinCost.toFixed(2)}.
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBuyModalOpen(false)}
                  className="flex-1 rounded-xl border border-emerald-700 bg-[#031c16] py-2.5 text-xs font-bold text-emerald-200 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={user.wallet_balance < buySpinCost || isSpinning}
                  onClick={executeBuySpin}
                  className="flex-1 rounded-xl bg-amber-400 py-2.5 text-xs font-black text-emerald-950 hover:bg-amber-300 disabled:opacity-45 cursor-pointer"
                >
                  Buy Now (₱{buySpinCost})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
