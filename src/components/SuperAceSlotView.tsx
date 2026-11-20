import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Coins,
  Flame,
  Info,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  Repeat,
  RotateCw,
  Settings,
  ShoppingBag,
  Sparkles,
  Square,
  Wifi,
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
  playCardBreak,
  playChipClink,
  playGoldenTransform,
  playReelStop,
  playScatterDrop,
  playSlotCelebrationFanfare,
  playSlotSpinStart,
} from '../lib/audio';
import { AudioControlButton } from './AudioControlButton';
import {
  classifySlotWinTier,
  SlotWinCelebration,
  type SlotCelebrationPayload,
  type SlotWinTier,
} from './SlotWinCelebration';
import { OdometerCounter } from './OdometerCounter';
import {
  BoldSuitIcon,
  SuperAceJackPortrait,
  SuperAceKingPortrait,
  SuperAceQueenPortrait,
  SuperAceScatterEmblem,
  SuperAceSpadeEmblem,
  SuperAceSuitPip,
  SuperAceWildCrown,
} from './CardArt';
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

// Flash (single ⚡) = Slow row-by-row drop | Turbo (🔥⚡) = Fast drop
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
    label: 'Turbo Spin',
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
const BIG_WIN_HIGHLIGHT_MS = 5000;
const INTRO_HIDDEN_KEY = 'choy_superace_intro_hidden_v1';

const INTRO_SLIDES = [
  {
    caption: 'After the Golden poker wins, it will turn into wild in the same place.',
    badge: 'GOLDEN POKER → WILD',
  },
  {
    caption: 'Consecutive cascade eliminations boost Combo Multipliers up to ×5 (×10 in Free Spins)!',
    badge: 'COMBO MULTIPLIER ×1–×10',
  },
  {
    caption: 'Land 3 Scatters or tap BUY BONUS to trigger 10 Free Scatter Spins instantly!',
    badge: '10 FREE SCATTER SPINS',
  },
];

function buildPreviewGrid(): SuperAceCell[][] {
  const sample: SuperAceSymbol[] = ['ACE', 'KING', 'QUEEN', 'JACK', 'SPADE', 'HEART', 'CLUB', 'DIAMOND'];
  const grid: SuperAceCell[][] = [];
  let seq = 0;
  for (let r = 0; r < ROWS; r++) {
    const row: SuperAceCell[] = [];
    for (let c = 0; c < COLS; c++) {
      // Showcase iconic Super Ace column rhythm on initial load: A, K (gold top), Q, J, ♠, ♥
      const sym =
        r < 3 && c < 5
          ? (['ACE', 'KING', 'QUEEN', 'JACK', 'SPADE'] as SuperAceSymbol[])[c]
          : sample[(r * 3 + c * 5) % sample.length];
      row.push({
        id: `init-${r}-${c}-${seq++}`,
        symbol: sym,
        isGolden: (r === 0 && c === 1) || (r === 2 && c === 3),
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

  // Intro Feature Splash (matches reference Screenshot_20261121-025009)
  const [showIntroSplash, setShowIntroSplash] = useState<boolean>(() => {
    if (gameKey !== 'superace') return false;
    try {
      return localStorage.getItem(INTRO_HIDDEN_KEY) !== 'true';
    } catch {
      return true;
    }
  });
  const [dontShowIntroNextTime, setDontShowIntroNextTime] = useState<boolean>(false);
  const [introProgress, setIntroProgress] = useState<number>(18);
  const [introSlide, setIntroSlide] = useState<number>(0);

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
  const [infoModalOpen, setInfoModalOpen] = useState<boolean>(false);
  const [spinSpeed, setSpinSpeed] = useState<SlotSpinSpeed>('slow');
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

  // Animate Intro Splash loading progress smoothly to 100%
  useEffect(() => {
    if (!showIntroSplash) return;
    setIntroProgress(22);
    const interval = setInterval(() => {
      setIntroProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return Math.min(100, prev + 16);
      });
    }, 180);
    return () => clearInterval(interval);
  }, [showIntroSplash]);

  const handleCloseIntro = () => {
    playChipClink();
    if (dontShowIntroNextTime) {
      try {
        localStorage.setItem(INTRO_HIDDEN_KEY, 'true');
      } catch {
        // ignore storage restrictions
      }
    }
    setShowIntroSplash(false);
  };

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

  // Shared animation runner for both normal/free spins and Buy Free Spin Scatter entry
  const animateSpinResult = useCallback(
    async (
      result: SuperAceSpinResult,
      clearStartAt: number,
      speed: SpeedProfile,
      previousFreeSpinsRemaining: number
    ) => {
      if (!mountedRef.current) return;

      const elapsedClear = performance.now() - clearStartAt;
      if (elapsedClear < speed.clearMinMs) {
        await new Promise<void>((resolve) => setTimeout(resolve, speed.clearMinMs - elapsedClear));
      }
      if (!mountedRef.current) return;

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

      if (result.triggeredFreeSpins > 0) {
        await presentCelebration(
          {
            kind: 'scatter',
            tier: spinTier,
            eyebrow: result.wasBuySpin
              ? `BUY BONUS SCATTER (₱${(result.buyCost ?? 0).toFixed(0)})`
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
    setAutoMenuOpen(false);
    setBuyModalOpen(false);

    const currentSlotState = slotStateRef.current;
    const freeSpinNow = currentSlotState.freeSpinsRemaining > 0;
    const betToSend = freeSpinNow ? currentSlotState.freeSpinBet : SUPER_ACE_BETS[betIndex];

    if (!freeSpinNow && user.wallet_balance < betToSend) {
      setErrorMsg(`Insufficient wallet balance for ₱${betToSend} bet. Cash In or choose a lower bet.`);
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
      setErrorMsg(`Insufficient wallet balance. Need ₱${cost.toFixed(2)} to Buy Bonus at ₱${betToSend} bet.`);
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
        setErrorMsg(data.error || 'Could not complete Buy Bonus.');
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
      setErrorMsg('Network error during Buy Bonus. Please try again.');
      isSpinningRef.current = false;
      setIsSpinning(false);
      setReelPhase('idle');
    }
  }, [gameKey, betIndex, user.id, user.wallet_balance, animateSpinResult]);

  const startAutoSpin = (count: number) => {
    setAutoMenuOpen(false);
    setBetDrawerOpen(false);
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

  const renderSuperAceCardFace = (cell: SuperAceCell) => {
    if (cell.isScatter) {
      return (
        <div className="w-full h-full flex items-center justify-center p-0.5">
          <SuperAceScatterEmblem className="w-[94%] h-[94%] drop-shadow" />
        </div>
      );
    }

    if (cell.symbol === 'WILD_BIG' || cell.symbol === 'WILD_SMALL') {
      return (
        <div className="w-full h-full flex items-center justify-center p-0.5">
          <SuperAceWildCrown
            isMulti={cell.symbol === 'WILD_BIG'}
            className="w-[95%] h-[95%] drop-shadow"
          />
        </div>
      );
    }

    if (cell.symbol === 'ACE') {
      return (
        <>
          <span className="absolute top-[2px] left-[4px] z-10 font-serif text-[13px] sm:text-[17px] font-black leading-none text-[#14171f]">
            A
          </span>
          <div className="w-full h-full flex items-center justify-center pt-1.5 pb-0.5 px-1">
            <SuperAceSpadeEmblem className="w-[82%] h-[82%] max-h-[68px]" />
          </div>
        </>
      );
    }

    if (cell.symbol === 'KING') {
      return (
        <>
          <span className="absolute top-[2px] left-[4px] z-10 font-serif text-[13px] sm:text-[17px] font-black leading-none text-[#14171f]">
            K
          </span>
          <div className="w-full h-full flex items-end justify-center pt-1 px-0.5">
            <SuperAceKingPortrait className="w-[94%] h-[94%]" />
          </div>
        </>
      );
    }

    if (cell.symbol === 'QUEEN') {
      return (
        <>
          <span className="absolute top-[2px] left-[4px] z-10 font-serif text-[13px] sm:text-[17px] font-black leading-none text-[#14171f]">
            Q
          </span>
          <div className="w-full h-full flex items-end justify-center pt-1 px-0.5">
            <SuperAceQueenPortrait className="w-[94%] h-[94%]" />
          </div>
        </>
      );
    }

    if (cell.symbol === 'JACK') {
      return (
        <>
          <span className="absolute top-[2px] left-[4px] z-10 font-serif text-[13px] sm:text-[17px] font-black leading-none text-[#14171f]">
            J
          </span>
          <div className="w-full h-full flex items-end justify-center pt-1 px-0.5">
            <SuperAceJackPortrait className="w-[94%] h-[94%]" />
          </div>
        </>
      );
    }

    const suitMap: Record<'SPADE' | 'HEART' | 'DIAMOND' | 'CLUB', '♠' | '♥' | '♦' | '♣'> = {
      SPADE: '♠',
      HEART: '♥',
      DIAMOND: '♦',
      CLUB: '♣',
    };
    const pipSuit = suitMap[cell.symbol as keyof typeof suitMap] ?? '♠';

    return (
      <div className="w-full h-full flex items-center justify-center p-2">
        <SuperAceSuitPip suit={pipSuit} className="w-[62%] h-[62%] max-w-[44px] max-h-[44px]" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-30 h-[100dvh] w-screen bg-[#090b1a] flex flex-col overflow-hidden select-none">
      {/* Subtle Royal Damask Dark Navy Wallpaper Backdrop (matching reference) */}
      <div
        className="pointer-events-none fixed inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 25%, #2a3166 2px, transparent 2.5px), radial-gradient(circle at 75% 75%, #222958 2px, transparent 2.5px), linear-gradient(135deg, #0d1026 0%, #070917 100%)',
          backgroundSize: '26px 26px, 26px 26px, 100% 100%',
        }}
        aria-hidden="true"
      />

      {/* ==================== SUPER ACE INTRO SPLASH OVERLAY (Reference Screenshot 1) ==================== */}
      <AnimatePresence>
        {showIntroSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden px-4 py-4 sm:py-6"
            style={{
              background:
                'radial-gradient(circle at 50% 42%, #e6f466 0%, #8ec736 32%, #1d8a35 68%, #0c4d1f 100%)',
            }}
          >
            {/* Sunburst Rays */}
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'repeating-conic-gradient(from 0deg at 50% 44%, rgba(255,253,190,0.45) 0deg 10deg, transparent 10deg 22deg)',
              }}
              aria-hidden="true"
            />

            {/* Floating Golden Coins Around Corners */}
            <div className="pointer-events-none absolute -top-5 -left-4 h-24 w-24 rounded-full border-4 border-amber-200 bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 shadow-2xl flex items-center justify-center -rotate-12 opacity-90">
              <span className="font-display text-4xl font-black text-amber-100 drop-shadow">$</span>
            </div>
            <div className="pointer-events-none absolute top-10 -right-6 h-20 w-20 rounded-full border-4 border-amber-200 bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 shadow-2xl flex items-center justify-center rotate-12 opacity-90">
              <span className="font-display text-3xl font-black text-amber-100 drop-shadow">$</span>
            </div>
            <div className="pointer-events-none absolute bottom-16 -left-5 h-20 w-20 rounded-full border-4 border-amber-200 bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 shadow-2xl flex items-center justify-center rotate-12 opacity-80">
              <span className="font-display text-3xl font-black text-amber-100 drop-shadow">$</span>
            </div>
            <div className="pointer-events-none absolute -bottom-4 -right-3 h-24 w-24 rounded-full border-4 border-amber-200 bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 shadow-2xl flex items-center justify-center -rotate-12 opacity-85">
              <span className="font-display text-4xl font-black text-amber-100 drop-shadow">$</span>
            </div>

            {/* Top Bar */}
            <div className="relative z-10 w-full max-w-md flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  stopAutoSpin();
                  onExit();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-black/40 text-white hover:bg-black/60 cursor-pointer"
                aria-label="Back to lobby"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="rounded-full border border-amber-200/70 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                CHOY SLOT ARENA
              </span>
            </div>

            {/* Center Feature Showcase */}
            <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center gap-3 my-auto">
              {/* Metallic Beveled SuperAce Logo */}
              <div className="space-y-1">
                <h1
                  className="font-display text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-b from-[#fffce0] via-[#ffd76a] to-[#b36c12] bg-clip-text text-transparent drop-shadow-[0_3px_0_rgba(45,20,0,0.95)]"
                  style={{ WebkitTextStroke: '1px #3b1c04' }}
                >
                  SuperAce
                </h1>
                {/* Volatility Chili Meter */}
                <div className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-0.5">
                  <span className="text-xs font-bold text-lime-100">Volatility:</span>
                  <div className="flex items-center gap-0.5 text-sm leading-none">
                    <span className="drop-shadow">🌶️</span>
                    <span className="drop-shadow">🌶️</span>
                    <span className="opacity-35 grayscale">🌶️</span>
                    <span className="opacity-35 grayscale">🌶️</span>
                    <span className="opacity-35 grayscale">🌶️</span>
                  </div>
                </div>
              </div>

              {/* Feature Demo Card Board with Prev/Next Arrows */}
              <div className="relative w-full flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIntroSlide((s) => (s - 1 + INTRO_SLIDES.length) % INTRO_SLIDES.length)}
                  className="p-1.5 text-amber-200 hover:text-white cursor-pointer"
                  aria-label="Previous feature slide"
                >
                  <ChevronLeft className="h-7 w-7 drop-shadow" />
                </button>

                <div className="relative w-[240px] sm:w-[270px] rounded-xl border-2 border-amber-300/90 bg-[#0b3e44] p-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.5)]">
                  {/* 4×3 Mini Classic Poker Grid */}
                  <div className="grid grid-cols-4 gap-1">
                    {(['KING', 'ACE', 'KING', 'DIAMOND', 'ACE', 'QUEEN', 'ACE', 'HEART', 'KING', 'KING', 'QUEEN', 'WILD_SMALL'] as SuperAceSymbol[]).map(
                      (sym, idx) => {
                        const isGoldWildDemo = idx === 3 || idx === 10 || idx === 11;
                        return (
                          <div
                            key={idx}
                            className={`relative aspect-[3/4] rounded-md overflow-hidden flex items-center justify-center ${
                              isGoldWildDemo && introSlide === 0
                                ? 'bg-gradient-to-b from-amber-200 via-yellow-300 to-amber-500 ring-2 ring-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.85)]'
                                : 'bg-gradient-to-b from-[#f7f9fc] to-[#dde3ee] border border-slate-400/60'
                            }`}
                          >
                            {isGoldWildDemo && introSlide === 0 ? (
                              <SuperAceWildCrown className="w-[92%] h-[92%]" />
                            ) : sym === 'ACE' ? (
                              <SuperAceSpadeEmblem className="w-[80%] h-[80%]" />
                            ) : sym === 'KING' ? (
                              <SuperAceKingPortrait className="w-[92%] h-[92%]" />
                            ) : sym === 'QUEEN' ? (
                              <SuperAceQueenPortrait className="w-[92%] h-[92%]" />
                            ) : sym === 'HEART' ? (
                              <SuperAceSuitPip suit="♥" className="w-[62%] h-[62%]" />
                            ) : (
                              <SuperAceSuitPip suit="♦" className="w-[62%] h-[62%]" />
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* Floating Featured Golden WILD Popout & Curved Arrow Overlay (Slide 0) */}
                  {introSlide === 0 && (
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                      className="pointer-events-none absolute top-[18%] left-[14%] w-[86px] sm:w-[98px] aspect-[3/4] rounded-xl border-2 border-yellow-100 bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-500 p-1 shadow-[0_0_24px_rgba(250,204,21,0.9)]"
                    >
                      <SuperAceWildCrown className="w-full h-full" />
                    </motion.div>
                  )}

                  {introSlide === 1 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[1px] rounded-lg p-3 gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                        Combo Multipliers
                      </span>
                      <div className="flex items-center gap-1.5 rounded-full border-2 border-amber-300 bg-gradient-to-b from-amber-300 via-yellow-500 to-amber-700 px-3 py-1 shadow-lg">
                        {[1, 2, 3, 5].map((m, i) => (
                          <span
                            key={m}
                            className={`font-display text-sm font-black ${
                              i === 3 ? 'text-red-700 scale-110' : 'text-amber-950'
                            }`}
                          >
                            ×{m}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-200">
                        Doubled to ×2 · ×4 · ×6 · ×8 · ×10 in Free Spins!
                      </span>
                    </div>
                  )}

                  {introSlide === 2 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[1px] rounded-lg p-3 gap-2">
                      <div className="flex items-center gap-2">
                        <SuperAceScatterEmblem className="w-12 h-12" />
                        <SuperAceScatterEmblem className="w-14 h-14" />
                        <SuperAceScatterEmblem className="w-12 h-12" />
                      </div>
                      <span className="rounded-lg bg-amber-400 px-2.5 py-0.5 text-xs font-black text-emerald-950">
                        10 FREE SPINS + BUY BONUS
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIntroSlide((s) => (s + 1) % INTRO_SLIDES.length)}
                  className="p-1.5 text-amber-200 hover:text-white cursor-pointer"
                  aria-label="Next feature slide"
                >
                  <ChevronRight className="h-7 w-7 drop-shadow" />
                </button>
              </div>

              {/* Caption & Pagination Dots */}
              <div className="space-y-2 max-w-xs">
                <p className="text-xs sm:text-sm font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] leading-snug">
                  {INTRO_SLIDES[introSlide].caption}
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  {INTRO_SLIDES.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIntroSlide(i)}
                      aria-label={`Slide ${i + 1}`}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        introSlide === i ? 'w-5 bg-amber-300' : 'w-2 bg-amber-100/45'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Loading Bar, CTA & "Don't show next time" */}
            <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-2.5 pb-1">
              <div className="w-full space-y-1">
                <div className="h-3 w-full overflow-hidden rounded-full border border-emerald-950/70 bg-black/55 p-[2px]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300 transition-all duration-200"
                    style={{ width: `${introProgress}%` }}
                  />
                </div>
                <p className="text-center text-xs font-bold text-white drop-shadow">
                  {introProgress < 100 ? `Loading... ${introProgress}%` : 'Ready to Play!'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseIntro}
                className="w-full rounded-2xl border-2 border-amber-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-500 py-2.5 font-display text-base font-black uppercase tracking-wide text-amber-950 shadow-[0_6px_20px_rgba(0,0,0,0.45)] hover:brightness-105 active:scale-95 transition cursor-pointer"
              >
                {introProgress < 100 ? 'Skip & Play Now' : 'Play SuperAce'}
              </button>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-white/95 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShowIntroNextTime}
                  onChange={(e) => setDontShowIntroNextTime(e.target.checked)}
                  className="h-4 w-4 rounded border-white/60 accent-amber-400 cursor-pointer"
                />
                Don&apos;t show next time
              </label>

              <div className="pt-1 text-center">
                <span className="font-display text-sm font-black tracking-widest bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">
                  CHOY CARD GAME
                </span>
                <p className="text-[9px] font-semibold tracking-wider text-white/75 uppercase">
                  Fair Certified RNG · 6×5 Cascading Card Reels
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== TOP ROYAL HEADER BAR (Back + BUY BONUS Ruby Orb + Audio/FS) ==================== */}
      <div className="relative z-20 shrink-0 w-full max-w-[560px] mx-auto flex items-center justify-between px-3 pt-2 pb-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              stopAutoSpin();
              onExit();
            }}
            title="Back to Lobby"
            aria-label="Back to Lobby"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/35 bg-[#121633]/90 text-slate-200 hover:border-amber-400 hover:text-amber-300 transition cursor-pointer shadow"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer ${
              isFullscreen
                ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                : 'border-indigo-400/35 bg-[#121633]/90 text-slate-200 hover:border-amber-400'
            }`}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <AudioControlButton variant="compact" align="left" />
        </div>

        {/* Center Free Spin Status Pill when active */}
        {isFreeSpinMode && (
          <div className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-500/25 px-2.5 py-1 font-mono-num text-[10px] sm:text-xs font-black text-amber-200 shadow-lg">
            <Sparkles className="h-3 w-3 text-amber-300" />
            FREE {slotState.freeSpinsRemaining}/{slotState.freeSpinsTotal}
          </div>
        )}

        {/* Top-Right Ruby-Gold BUY BONUS Orb (matches Screenshot_20261121-025033!) */}
        <button
          type="button"
          disabled={isSpinning || isFreeSpinMode}
          onClick={() => {
            playChipClink();
            setBuyModalOpen(true);
          }}
          className="relative group flex h-12 w-12 sm:h-14 sm:w-14 flex-col items-center justify-center rounded-full border-2 border-amber-300 bg-gradient-to-br from-rose-500 via-red-600 to-red-900 shadow-[0_0_20px_rgba(239,68,68,0.65)] hover:scale-105 active:scale-95 disabled:opacity-45 transition cursor-pointer"
          title={`Buy Free Spin Scatter (₱${buySpinCost})`}
        >
          <span className="pointer-events-none absolute inset-1 rounded-full border border-amber-200/45" />
          <span className="font-display text-[10px] sm:text-[11px] font-black leading-none text-amber-200 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
            BUY
          </span>
          <span className="font-display text-[8px] sm:text-[9px] font-black leading-none text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
            BONUS
          </span>
        </button>
      </div>

      {/* ==================== MAIN SUPER ACE WOOD-AND-FELT CABINET ==================== */}
      <div className="relative z-10 flex-1 min-h-0 w-full max-w-[560px] mx-auto flex flex-col px-1.5 sm:px-2 pb-1">
        {/* CARVED MAHOGANY WOOD TOP ARCH + METALLIC TITLE + GOLDEN MULTIPLIER PILL */}
        <div
          className="relative shrink-0 rounded-t-2xl border-t-2 border-x-2 border-[#7c3d1e] px-2 pt-1.5 pb-1 shadow-2xl"
          style={{
            background:
              'linear-gradient(180deg, #5d2914 0%, #3d1709 42%, #240c04 100%)',
          }}
        >
          {/* Polished Wood Top Highlight Line */}
          <div className="pointer-events-none absolute inset-x-3 top-0.5 h-[2px] rounded-full bg-amber-300/35" />

          {/* Metallic Beveled Logo */}
          <div className="flex items-center justify-center gap-2 leading-none mb-1">
            <h1
              className="font-display text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-b from-[#fffce0] via-[#f7c85c] to-[#b56d14] bg-clip-text text-transparent drop-shadow-[0_2px_0_rgba(25,8,0,0.95)]"
            >
              {gameKey === 'superace' ? 'SuperAce' : theme.title}
            </h1>
            {isFreeSpinMode && (
              <span className="rounded bg-amber-400 px-1.5 py-0.5 font-mono-num text-[9px] font-black text-amber-950">
                BONUS ₱{slotState.freeSpinTotalWin.toFixed(2)}
              </span>
            )}
          </div>

          {/* Glowing Golden Pill Multiplier Bar (×1 ×2 ×3 ×4 ×5 or ×2 ×4 ×6 ×8 ×10) */}
          <div className="mx-auto max-w-[360px] rounded-full border-2 border-[#ffe28a] bg-gradient-to-b from-[#f8c746] via-[#d7931d] to-[#9b5d09] px-3 py-0.5 shadow-[0_0_16px_rgba(245,184,46,0.45)] flex items-center justify-around">
            {activeMultipliers.map((m, idx) => {
              const isActive =
                (isSpinning && lastWin > 0 && activeMultiplierIdx === idx) ||
                (!isSpinning && idx === 0);
              const isPassed = isSpinning && lastWin > 0 && activeMultiplierIdx > idx;
              return (
                <span
                  key={m}
                  className={`font-display text-sm sm:text-base font-black tabular-nums transition-all px-1.5 rounded-full ${
                    isActive
                      ? 'text-[#fff7a8] scale-115 drop-shadow-[0_0_8px_rgba(220,38,38,0.95)]'
                      : isPassed
                        ? 'text-amber-100'
                        : 'text-[#311704]/90'
                  }`}
                  style={
                    isActive
                      ? {
                          WebkitTextStroke: '1px #b91c1c',
                          textShadow: '0 0 10px rgba(239,68,68,0.95), 0 0 4px #facc15',
                        }
                      : undefined
                  }
                >
                  ×{m}
                </span>
              );
            })}
          </div>
        </div>

        {/* 3D STACKED CARD DECK SHOES ABOVE ALL 6 REEL COLUMNS (matching Screenshot 2 & 3!) */}
        <div className="shrink-0 grid grid-cols-6 gap-1 sm:gap-1.5 bg-[#1b0b05] border-x-2 border-[#7c3d1e] px-1.5 sm:px-2 pt-1 pb-0.5">
          {Array.from({ length: COLS }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="relative h-4 sm:h-5 rounded-t-md border border-slate-400/70 bg-gradient-to-b from-[#d9dce3] via-[#b7bdc8] to-[#7d8492] overflow-hidden shadow-inner flex flex-col justify-end"
            >
              {/* Red-trimmed card back peeking on top */}
              <div className="mx-1 mb-[2px] h-1.5 rounded-xs bg-gradient-to-r from-rose-900/70 via-rose-700/60 to-rose-900/70 border border-white/40" />
              {/* Stacked card edge striations */}
              <div className="h-[5px] w-full bg-[repeating-linear-gradient(180deg,#f8fafc_0px,#f8fafc_1px,#64748b_1px,#64748b_2px)]" />
            </div>
          ))}
        </div>

        {/* DARK TEAL CASINO FELT 6×5 REEL WINDOW */}
        <div
          className={`relative flex-1 min-h-[240px] overflow-hidden border-x-2 border-b-[3px] px-1.5 sm:px-2 py-1.5 shadow-[inset_0_0_28px_rgba(0,0,0,0.65)] flex flex-col ${
            isFreeSpinMode
              ? 'border-amber-300'
              : 'border-[#c8a252]'
          }`}
          style={{
            background: isFreeSpinMode
              ? 'radial-gradient(circle at 50% 45%, #1d645b 0%, #0d3e3a 58%, #072225 100%)'
              : 'radial-gradient(circle at 50% 45%, #196b70 0%, #0e4a50 60%, #072c31 100%)',
          }}
        >
          {/* Radiant Vertical Anticipation Spin Light Streaks (matching Screenshot_20261121-025018!) */}
          {(reelPhase === 'clearing' || reelPhase === 'dropping') && (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-6 gap-1.5 px-2 z-0">
              {Array.from({ length: COLS }).map((_, colIdx) => (
                <div
                  key={colIdx}
                  className={`h-full rounded-md transition-opacity duration-200 ${
                    colIdx % 2 === 0
                      ? 'bg-gradient-to-b from-amber-300/15 via-yellow-400/35 to-amber-400/65'
                      : 'bg-gradient-to-b from-emerald-300/20 via-emerald-400/40 to-amber-300/40'
                  } animate-pulse`}
                />
              ))}
            </div>
          )}

          {/* 6×5 CASCADING REELS GRID */}
          <div className="relative z-10 grid flex-1 grid-cols-6 grid-rows-5 gap-1 sm:gap-1.5 h-full">
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
                  rowFromBottom * activeSpeed.clearRowStepSec + cIdx * activeSpeed.clearColStepSec;
                const dropDelay =
                  rIdx * activeSpeed.dropRowStepSec + cIdx * activeSpeed.dropColStepSec;
                const cascadeDelay =
                  rIdx * activeSpeed.cascadeRowStepSec + cIdx * activeSpeed.cascadeColStepSec;

                let cardSurface =
                  'bg-gradient-to-b from-[#f8fafd] via-[#ffffff] to-[#dfe5ef] border border-slate-400/90 shadow-[0_2px_4px_rgba(0,0,0,0.4)]';
                if (cell.isScatter) {
                  cardSurface =
                    'bg-gradient-to-b from-amber-200 via-yellow-400 to-orange-500 border-2 border-yellow-100 shadow-[0_0_16px_rgba(251,191,36,0.75)]';
                } else if (cell.symbol === 'WILD_BIG') {
                  cardSurface =
                    'bg-gradient-to-b from-yellow-200 via-amber-400 to-red-500 border-2 border-yellow-100 shadow-[0_0_20px_rgba(239,68,68,0.85)]';
                } else if (cell.symbol === 'WILD_SMALL') {
                  cardSurface =
                    'bg-gradient-to-b from-yellow-100 via-amber-300 to-amber-500 border-2 border-yellow-100 shadow-[0_0_16px_rgba(250,204,21,0.75)]';
                } else if (cell.isGolden) {
                  cardSurface =
                    'bg-gradient-to-b from-[#fff5b8] via-[#fbd04b] to-[#d48e15] border-2 border-[#fff3a6] shadow-[0_0_14px_rgba(250,204,21,0.65)]';
                }

                return (
                  <motion.div
                    key={`${spinSeq}-${cell.id}`}
                    layout={reelPhase === 'cascading'}
                    initial={
                      isDropping
                        ? { opacity: 0.15, y: -240, scale: 0.94 }
                        : isCascadeNew
                          ? { opacity: 0, y: -110, scale: 0.9 }
                          : false
                    }
                    animate={
                      isClearing
                        ? { opacity: 0, y: 240, scale: 0.94 }
                        : {
                            opacity: isBreaking ? 0.25 : 1,
                            y: 0,
                            scale: isBreaking
                              ? 1.1
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
                    className={`relative w-full h-full min-h-[44px] rounded-[6px] sm:rounded-[8px] flex flex-col items-center justify-center overflow-hidden ${cardSurface} ${
                      isBreaking ? 'ring-2 ring-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.95)]' : ''
                    } ${isScatterHit ? 'ring-2 ring-white' : ''}`}
                  >
                    {/* Golden Card Gleam Inner Frame */}
                    {cell.isGolden && !cell.isWild && !cell.isScatter && (
                      <div
                        className="pointer-events-none absolute inset-[2px] rounded-[5px] border border-amber-700/50"
                        aria-hidden="true"
                      />
                    )}

                    {gameKey === 'superace' ? (
                      renderSuperAceCardFace(cell)
                    ) : (
                      <>
                        <div className="w-full flex items-center justify-between px-1 pt-0.5 leading-none">
                          <span className={`font-display text-[9px] sm:text-xs font-black ${visual.textColor}`}>
                            {cell.isScatter ? '★' : cell.symbol === 'WILD_BIG' ? '×2' : cell.isWild ? 'W' : visual.label.slice(0, 2)}
                          </span>
                          {cell.isGolden && !cell.isWild && !cell.isScatter && (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                          )}
                        </div>
                        <div className="flex-1 w-full flex items-center justify-center min-h-0">
                          {visual.icon === '♠' || visual.icon === '♥' || visual.icon === '♦' || visual.icon === '♣' ? (
                            <BoldSuitIcon suit={visual.icon as Suit} className="h-6 w-6 sm:h-8 sm:w-8" />
                          ) : (
                            <span className={`text-xl sm:text-2xl leading-none ${visual.textColor}`}>
                              {visual.icon}
                            </span>
                          )}
                        </div>
                        <span className={`text-[7px] sm:text-[8px] font-black uppercase pb-0.5 truncate max-w-full ${visual.textColor}`}>
                          {cell.symbol === 'WILD_BIG'
                            ? 'MULTI ×2'
                            : cell.symbol === 'WILD_SMALL'
                              ? 'WILD'
                              : visual.subLabel || visual.label}
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
                className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 rounded-xl border-2 border-amber-300 bg-[#2b1005]/95 px-4 py-1 font-mono-num text-xs sm:text-sm font-black text-amber-200 shadow-2xl whitespace-nowrap"
              >
                {cascadeBanner}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Toast inside Reel Window */}
          {errorMsg && (
            <div className="absolute top-2 inset-x-3 z-20 rounded-xl border border-red-400/70 bg-red-950/90 px-3 py-1.5 text-center text-[11px] font-semibold text-red-100 shadow-xl">
              {errorMsg}
            </div>
          )}

          {/* FLOATING BRONZE/GOLD BET MATRIX POPUP (Matches Screenshot_20261121-025033!) */}
          <AnimatePresence>
            {betDrawerOpen && (
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.96 }}
                className="absolute inset-x-2 bottom-2 z-30 rounded-lg border-2 border-[#c8a252] bg-[#1a150e]/96 shadow-[0_14px_38px_rgba(0,0,0,0.85)] overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-[#5b4827] bg-[#261d11] px-3 py-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-200">
                    <Coins className="h-3.5 w-3.5 text-amber-400" />
                    Select Bet Amount (₱)
                  </span>
                  <button
                    type="button"
                    onClick={() => setBetDrawerOpen(false)}
                    className="rounded p-0.5 text-amber-200/80 hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 divide-x divide-y divide-[#3a301e]">
                  {[...SUPER_ACE_BETS].reverse().map((amount) => {
                    const idx = SUPER_ACE_BETS.indexOf(amount);
                    const active = idx === betIndex;
                    return (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => {
                          handleSelectBet(idx);
                          setBetDrawerOpen(false);
                        }}
                        className={`py-3 font-mono-num text-sm font-bold transition cursor-pointer ${
                          active
                            ? 'bg-gradient-to-b from-[#695b30] to-[#3f371d] text-amber-100 ring-2 ring-inset ring-amber-300/90 shadow-inner'
                            : 'text-stone-100 hover:bg-[#2c2417]'
                        }`}
                      >
                        {amount}
                      </button>
                    );
                  })}
                  <div className="flex items-center justify-center text-[10px] font-bold text-amber-400/70">
                    CHOY
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* FLOATING AUTOPLAY POPOVER */}
          <AnimatePresence>
            {autoMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-3 bottom-2 z-30 w-52 rounded-xl border-2 border-[#c8a252] bg-[#1a150e]/96 p-2.5 shadow-2xl space-y-2"
              >
                <div className="flex items-center justify-between border-b border-[#4c3d22] pb-1.5">
                  <span className="text-xs font-bold text-amber-200">Autoplay Spins</span>
                  <button
                    type="button"
                    onClick={() => setAutoMenuOpen(false)}
                    className="text-amber-200/70 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[10, 25, 50, 100].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => startAutoSpin(cnt)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#5a4826] bg-[#2a2114] py-2 font-mono-num text-xs font-bold text-amber-100 hover:border-amber-300 hover:bg-[#3a2d1a] cursor-pointer"
                    >
                      <Play className="h-3 w-3" />
                      {cnt}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => startAutoSpin(9999)}
                  className="w-full rounded-lg border border-amber-400/60 bg-amber-500/20 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-400 hover:text-amber-950 cursor-pointer"
                >
                  Continuous (Until Stop)
                </button>
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

        {/* CURVED MAHOGANY BOTTOM CONTROL CONSOLE (Matches Screenshot_20261121-025033!) */}
        <div
          className="relative shrink-0 rounded-b-2xl border-x-2 border-b-2 border-[#7c3d1e] px-2 pt-2 pb-2 shadow-2xl"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, #5b2612 0%, #3a1508 55%, #1c0904 100%)',
          }}
        >
          <div className="flex items-center justify-between gap-1 sm:gap-3 max-w-[440px] mx-auto">
            {/* 1. Settings / Info Gear Button */}
            <div className="flex flex-col items-center gap-0.5 w-14">
              <button
                type="button"
                onClick={() => {
                  playChipClink();
                  setInfoModalOpen(true);
                }}
                title="Paytable & Game Info"
                className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border-2 border-[#8c6443] bg-gradient-to-b from-[#5d3326] to-[#2e1510] text-amber-200/90 shadow-lg hover:border-amber-300 hover:text-amber-200 active:scale-95 transition cursor-pointer"
              >
                <Settings className="h-5 w-5" />
              </button>
              <span className="text-[9px] font-semibold text-amber-200/75 leading-none">
                Rules
              </span>
            </div>

            {/* 2. Coins Bet Button (Opens Bronze Bet Matrix) */}
            <div className="flex flex-col items-center gap-0.5 w-16">
              <button
                type="button"
                disabled={isSpinning || isFreeSpinMode}
                onClick={() => {
                  playChipClink();
                  setAutoMenuOpen(false);
                  setBetDrawerOpen((v) => !v);
                }}
                title="Select Bet Amount"
                className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border-2 shadow-lg active:scale-95 disabled:opacity-45 transition cursor-pointer ${
                  betDrawerOpen
                    ? 'border-amber-200 bg-gradient-to-b from-amber-400 to-amber-700 text-amber-950'
                    : 'border-[#8c6443] bg-gradient-to-b from-[#5d3326] to-[#2e1510] text-amber-200 hover:border-amber-300'
                }`}
              >
                <Coins className="h-5 w-5" />
              </button>
              <span className="font-mono-num text-[10px] font-bold text-amber-100 whitespace-nowrap leading-none">
                Bet ₱{displayBet}
              </span>
            </div>

            {/* 3. GIANT GLOWING CIRCULAR GOLDEN SPIN BUTTON */}
            <div className="relative -mt-4 flex flex-col items-center">
              <button
                type="button"
                disabled={isSpinning}
                onClick={executeSpin}
                aria-label={isFreeSpinMode ? 'Free Spin' : 'Spin Reels'}
                className={`relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-[3px] border-[#fff5b5] shadow-[0_0_26px_rgba(251,191,36,0.75)] active:scale-95 disabled:opacity-80 transition cursor-pointer ${
                  isFreeSpinMode
                    ? 'bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-600'
                    : 'bg-gradient-to-b from-[#ffe878] via-[#f5a718] to-[#b86204]'
                }`}
              >
                <span className="pointer-events-none absolute inset-1 rounded-full border-2 border-white/55" />
                <RotateCw
                  className={`absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)] text-white/35 ${
                    isSpinning ? 'animate-spin' : ''
                  }`}
                />
                <span className="relative z-10 font-display text-xs sm:text-sm font-black tracking-wider text-amber-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.7)]">
                  {isSpinning
                    ? '...'
                    : isFreeSpinMode
                      ? `FREE ${slotState.freeSpinsRemaining}`
                      : 'CHOY'}
                </span>
              </button>
            </div>

            {/* 4. Autoplay Circular Button */}
            <div className="flex flex-col items-center gap-0.5 w-16">
              {autoSpinsLeft > 0 ? (
                <button
                  type="button"
                  onClick={stopAutoSpin}
                  className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border-2 border-red-300 bg-gradient-to-b from-red-500 to-red-800 text-white shadow-lg active:scale-95 transition cursor-pointer"
                  title="Stop Autoplay"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    playChipClink();
                    setBetDrawerOpen(false);
                    setAutoMenuOpen((v) => !v);
                  }}
                  className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border-2 shadow-lg active:scale-95 transition cursor-pointer ${
                    autoMenuOpen
                      ? 'border-amber-200 bg-gradient-to-b from-amber-400 to-amber-700 text-amber-950'
                      : 'border-[#8c6443] bg-gradient-to-b from-[#5d3326] to-[#2e1510] text-amber-200 hover:border-amber-300'
                  }`}
                  title="Autoplay Spins"
                >
                  <Repeat className="h-5 w-5" />
                </button>
              )}
              <span className="text-[9px] font-semibold text-amber-200/80 whitespace-nowrap leading-none">
                {autoSpinsLeft > 0
                  ? `Stop (${autoSpinsLeft === 9999 ? '∞' : autoSpinsLeft})`
                  : 'Autoplay'}
              </span>
            </div>

            {/* 5. Lightning TURBO / Slow Toggle Button (with fiery TURBO badge matching reference!) */}
            <div className="relative flex flex-col items-center gap-0.5 w-14">
              {spinSpeed === 'fast' && (
                <span className="pointer-events-none absolute -top-5 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-orange-600 via-amber-400 to-red-600 px-1.5 py-[1px] font-display text-[9px] font-black italic tracking-tight text-white shadow-[0_0_10px_rgba(249,115,22,0.9)]">
                  <Flame className="h-2.5 w-2.5 fill-yellow-200 text-yellow-200" />
                  TURBO
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  playChipClink();
                  setSpinSpeed((s) => (s === 'slow' ? 'fast' : 'slow'));
                }}
                title={spinSpeed === 'fast' ? 'Switch to Slow Row-by-Row Drop' : 'Enable Turbo Fast Spin'}
                className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border-2 shadow-lg active:scale-95 transition cursor-pointer ${
                  spinSpeed === 'fast'
                    ? 'border-amber-200 bg-gradient-to-b from-amber-400 via-orange-500 to-red-700 text-white shadow-[0_0_16px_rgba(249,115,22,0.75)]'
                    : 'border-[#8c6443] bg-gradient-to-b from-[#5d3326] to-[#2e1510] text-amber-300 hover:border-amber-300'
                }`}
              >
                <Zap className="h-5 w-5 fill-current" />
              </button>
              <span className="text-[9px] font-semibold text-amber-200/80 leading-none">
                {spinSpeed === 'fast' ? 'Turbo' : 'Normal'}
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM DARK STATUS STRIP: VIP BADGE · BALANCE · WIN · CASH IN · SIGNAL */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-2 pt-1.5 pb-0.5 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="rounded bg-gradient-to-b from-slate-300 to-slate-500 px-1.5 py-0.5 font-mono-num text-[10px] font-black text-slate-950 shadow">
              VIP {user.vip_level}
            </span>
            <div className="flex items-baseline gap-1 min-w-0">
              <span className="text-[11px] font-semibold text-amber-300/90">Balance</span>
              <span className="font-mono-num text-xs sm:text-sm font-black text-white truncate">
                ₱{user.wallet_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenCashIn}
              title="Cash In Coins"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 hover:bg-amber-300 cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-semibold text-emerald-300/85">Win</span>
              <span
                className={`font-mono-num text-xs sm:text-sm font-black ${
                  lastWin > 0 ? 'text-amber-300' : 'text-slate-300'
                }`}
              >
                <OdometerCounter targetValue={lastWin} prefix="₱" decimals={2} duration={800} />
              </span>
            </div>
            <Wifi className="h-4 w-4 text-emerald-400" aria-label="Connected" />
          </div>
        </div>
      </div>

      {/* ==================== PAYTABLE & RULES MODAL (GEAR BUTTON) ==================== */}
      <AnimatePresence>
        {infoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border-2 border-[#c8a252] bg-[#1a140d] p-5 shadow-2xl space-y-4 text-stone-100"
            >
              <div className="flex items-center justify-between border-b border-[#4c3b20] pb-2.5">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-amber-400" />
                  <h3 className="font-display text-base font-black text-amber-300">
                    {theme.title} Features &amp; Rules
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoModalOpen(false)}
                  className="rounded-lg p-1 text-amber-200/70 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-stone-200 leading-relaxed">
                <p>{theme.featureSummary}</p>
                <div className="rounded-xl border border-[#4c3b20] bg-black/35 p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-amber-300 font-bold">Regular Multipliers</span>
                    <span className="font-mono-num font-bold">×1 · ×2 · ×3 · ×4 · ×5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-300 font-bold">Free Spin Multipliers</span>
                    <span className="font-mono-num font-bold">×2 · ×4 · ×6 · ×8 · ×10</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-300 font-bold">Buy Bonus (10 Free Spins)</span>
                    <span className="font-mono-num font-bold">100× Active Bet</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-300 font-bold">Total Spins Played</span>
                    <span className="font-mono-num font-bold">{slotState.totalRegularSpins}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {gameKey === 'superace' && (
                  <button
                    type="button"
                    onClick={() => {
                      setInfoModalOpen(false);
                      setShowIntroSplash(true);
                    }}
                    className="flex-1 rounded-xl border border-amber-400/50 bg-[#2d2112] py-2.5 text-xs font-bold text-amber-200 hover:bg-[#3d2d18] cursor-pointer"
                  >
                    Feature Guide
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInfoModalOpen(false)}
                  className="flex-1 rounded-xl bg-amber-400 py-2.5 text-xs font-black text-amber-950 hover:bg-amber-300 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== BUY FREE SPIN BONUS MODAL ==================== */}
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
              className="w-full max-w-sm rounded-3xl border-2 border-amber-400 bg-[#1c130b] p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-800 border border-amber-300 text-amber-200">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-extrabold text-amber-300">
                      Buy Bonus Free Spins
                    </h3>
                    <p className="text-[11px] text-amber-100/80">
                      Instant 3 Scatters · 10 Free Spins (×2–×10)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBuyModalOpen(false)}
                  className="rounded-lg p-1 text-amber-200/70 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-2xl border border-[#5b4523] bg-black/45 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-amber-200/80">Active Bet Size</span>
                  <strong className="font-mono-num text-white">₱{selectedBet}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-200/80">Buy Bonus Multiplier</span>
                  <strong className="font-mono-num text-amber-300">100× Bet</strong>
                </div>
                <div className="flex items-center justify-between border-t border-[#4b381b] pt-2">
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
                  className="flex-1 rounded-xl border border-[#5b4523] bg-[#2a1f13] py-2.5 text-xs font-bold text-amber-100 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={user.wallet_balance < buySpinCost || isSpinning}
                  onClick={executeBuySpin}
                  className="flex-1 rounded-xl bg-amber-400 py-2.5 text-xs font-black text-amber-950 hover:bg-amber-300 disabled:opacity-45 cursor-pointer"
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

