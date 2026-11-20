import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Coins,
  Flame,
  Radio,
  Shield,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Wifi,
  FlameKindling,
  Users,
} from 'lucide-react';
import type { UserProfile } from '../types';
import { AudioControlButton } from './AudioControlButton';
import { playChipClink, playWinFanfare, playReelStop } from '../lib/audio';
import { ConfettiCanvas, type ConfettiCanvasRef } from './ConfettiCanvas';

interface CockfightViewProps {
  user: UserProfile;
  onExit: () => void;
  onProfileUpdated: (updated: UserProfile) => void;
  onOpenCashIn: () => void;
}

type BetSide = 'meron' | 'wala' | 'draw';

interface HistoryItem {
  id: string;
  winner: 'meron' | 'wala' | 'draw';
  meronName: string;
  walaName: string;
  payoutMultiplier: number;
}

const BET_AMOUNTS = [20, 50, 100, 500, 1000, 5000] as const;

export const CockfightView: React.FC<CockfightViewProps> = ({
  user,
  onExit,
  onProfileUpdated,
  onOpenCashIn,
}) => {
  const [selectedBetAmount, setSelectedBetAmount] = useState<number>(100);
  const [selectedSide, setSelectedSide] = useState<BetSide | null>(null);
  const [activeBets, setActiveBets] = useState<Array<{ side: BetSide; amount: number }>>([]);
  const [isFighting, setIsFighting] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(15);
  const [matchStatus, setMatchStatus] = useState<'betting' | 'locked' | 'fighting' | 'result'>('betting');
  const [lastResult, setLastResult] = useState<{ winner: BetSide; prize: number; text: string } | null>(null);
  const [streamMuted, setStreamMuted] = useState<boolean>(false);
  const [fightHistory, setFightHistory] = useState<HistoryItem[]>([
    { id: 'h1', winner: 'meron', meronName: 'Red Star Matador', walaName: 'Bacolod Bluehawk', payoutMultiplier: 1.85 },
    { id: 'h2', winner: 'wala', meronName: 'Mindanao Gamefarm', walaName: 'Calamba Champion', payoutMultiplier: 1.95 },
    { id: 'h3', winner: 'meron', meronName: 'Tarlac Blade', walaName: 'Pampanga Fighter', payoutMultiplier: 1.85 },
    { id: 'h4', winner: 'draw', meronName: 'Davao Derby', walaName: 'Cebuano Spur', payoutMultiplier: 8.0 },
    { id: 'h5', winner: 'meron', meronName: 'Manila Pitmaster', walaName: 'Batangas Warrior', payoutMultiplier: 1.85 },
  ]);

  const confettiRef = useRef<ConfettiCanvasRef>(null);

  // Countdown timer for betting phase
  useEffect(() => {
    if (matchStatus !== 'betting') return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Lock bets and start fight
          setMatchStatus('locked');
          setTimeout(() => {
            startFightSequence();
          }, 1200);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [matchStatus, activeBets]);

  const totalMeronBets = useMemo(
    () => activeBets.filter((b) => b.side === 'meron').reduce((sum, b) => sum + b.amount, 0),
    [activeBets]
  );
  const totalWalaBets = useMemo(
    () => activeBets.filter((b) => b.side === 'wala').reduce((sum, b) => sum + b.amount, 0),
    [activeBets]
  );
  const totalDrawBets = useMemo(
    () => activeBets.filter((b) => b.side === 'draw').reduce((sum, b) => sum + b.amount, 0),
    [activeBets]
  );

  const handlePlaceBet = (side: BetSide) => {
    if (matchStatus !== 'betting') {
      alert('Bets are locked for this derby match! Wait for the next round.');
      return;
    }
    if (user.wallet_balance < selectedBetAmount) {
      alert('Insufficient wallet balance. Please cash in first.');
      onOpenCashIn();
      return;
    }

    playChipClink();
    setSelectedSide(side);

    // Deduct locally and send to server
    const newBalance = user.wallet_balance - selectedBetAmount;
    onProfileUpdated({ ...user, wallet_balance: newBalance });

    setActiveBets((prev) => [...prev, { side, amount: selectedBetAmount }]);

    // Persist bet to backend
    fetch('/api/cockfight/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        side,
        amount: selectedBetAmount,
      }),
    }).catch(() => {});
  };

  const startFightSequence = () => {
    setMatchStatus('fighting');
    setIsFighting(true);
    playReelStop();

    setTimeout(() => {
      // Determine winner randomly with slight edge to Meron (52% Meron, 44% Wala, 4% Draw)
      const rand = Math.random();
      const winner: BetSide = rand < 0.52 ? 'meron' : rand < 0.96 ? 'wala' : 'draw';
      
      let wonAmount = 0;
      let matchedSideBet = 0;
      for (const b of activeBets) {
        if (b.side === winner) {
          matchedSideBet += b.amount;
          const mult = winner === 'meron' ? 1.85 : winner === 'wala' ? 1.95 : 8.0;
          wonAmount += b.amount * mult;
        }
      }

      setIsFighting(false);
      setMatchStatus('result');

      const updatedBalance = user.wallet_balance + wonAmount;
      onProfileUpdated({ ...user, wallet_balance: updatedBalance });

      if (wonAmount > 0) {
        playWinFanfare();
        confettiRef.current?.triggerConfetti();
        setLastResult({
          winner,
          prize: wonAmount,
          text: `Victory! ${winner.toUpperCase()} won! You won ₱${wonAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}!`,
        });
      } else {
        setLastResult({
          winner,
          prize: 0,
          text: `Defeat! ${winner.toUpperCase()} won this derby match. Better luck next round!`,
        });
      }

      setFightHistory((prev) => [
        {
          id: String(Date.now()),
          winner,
          meronName: 'Red Matador Arena',
          walaName: 'Blue Steel Champion',
          payoutMultiplier: winner === 'meron' ? 1.85 : winner === 'wala' ? 1.95 : 8.0,
        },
        ...prev.slice(0, 19),
      ]);

      // Reset for next match after 4 seconds
      setTimeout(() => {
        setActiveBets([]);
        setSelectedSide(null);
        setMatchStatus('betting');
        setCountdown(15);
        setLastResult(null);
      }, 4500);
    }, 3200);
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-[#03140e] text-stone-100 select-none overflow-x-hidden">
      <ConfettiCanvas ref={confettiRef} />

      {/* TOP HEADER BAR */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-emerald-800/80 bg-[#042018]/95 px-4 py-3 shadow-md backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-700 bg-emerald-950 px-3 py-1.5 text-xs font-extrabold text-amber-200 hover:bg-emerald-900 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-emerald-950 font-black shadow">
              🐓
            </div>
            <div>
              <h1 className="font-display text-base font-black text-amber-300 leading-tight">
                Cockfight Live Arena
              </h1>
              <p className="text-[10px] text-emerald-300/80">Online Sabong Derby · Meron &amp; Wala</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AudioControlButton />
          <div className="flex items-center gap-2 rounded-xl border border-emerald-700/80 bg-black/40 px-3 py-1.5">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="font-mono-num text-xs sm:text-sm font-black text-white">
              ₱{user.wallet_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
            <button
              type="button"
              onClick={onOpenCashIn}
              className="ml-1 rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-black text-emerald-950 hover:bg-amber-300 transition cursor-pointer"
            >
              + Cash In
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN: LIVE SABONG ARENA STREAM & MATCH CARD */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* LIVE ARENA VIDEO / STREAM PLAYER BOX */}
          <div className="relative rounded-3xl border-2 border-amber-400/70 bg-black overflow-hidden shadow-[0_0_35px_rgba(251,191,36,0.35)] aspect-video flex flex-col justify-between">
            
            {/* Embedded Live Sabong Stream Player / YouTube / Arena Feed */}
            <div className="absolute inset-0 z-0">
              <iframe
                src="https://www.youtube-nocookie.com/embed/live_stream?channel=UC_x5XG1OV2P6uZZ5FSM9Ttw&autoplay=1&mute=1"
                title="Online Sabong Live Arena Broadcast"
                className="w-full h-full object-cover opacity-85 pointer-events-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none" />
            </div>

            {/* Top Stream Badges */}
            <div className="relative z-10 p-3.5 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/70 bg-red-950/95 px-3 py-1 text-xs font-black text-red-200 shadow animate-pulse">
                <Radio className="h-3.5 w-3.5 text-red-400" />
                <span>LIVE SABONG ARENA STREAM</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStreamMuted(!streamMuted)}
                  className="rounded-full bg-black/70 p-2 text-amber-300 border border-amber-400/40 hover:bg-black cursor-pointer"
                  title={streamMuted ? 'Unmute Stream Audio' : 'Mute Stream Audio'}
                >
                  {streamMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <div className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  <span>14,820 Viewers</span>
                </div>
              </div>
            </div>

            {/* Center Fighting / Status Overlay */}
            <div className="relative z-10 my-auto text-center px-4">
              {matchStatus === 'betting' && (
                <div className="inline-flex flex-col items-center rounded-2xl border-2 border-amber-400/80 bg-black/85 px-6 py-3 backdrop-blur shadow-2xl">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300">
                    Derby Betting Open
                  </span>
                  <p className="font-mono-num text-4xl font-black text-white mt-0.5">
                    00:{countdown < 10 ? `0${countdown}` : countdown}
                  </p>
                  <span className="text-[10px] text-emerald-300 mt-0.5">Place your bets on Meron or Wala</span>
                </div>
              )}

              {matchStatus === 'locked' && (
                <div className="inline-flex flex-col items-center rounded-2xl border-2 border-orange-500 bg-red-950/95 px-6 py-3 shadow-2xl animate-bounce">
                  <span className="text-sm font-black uppercase tracking-widest text-orange-200">
                    🔒 Bets Locked!
                  </span>
                  <p className="text-xs text-white font-bold mt-1">Ready for Arena Clash...</p>
                </div>
              )}

              {matchStatus === 'fighting' && (
                <div className="inline-flex flex-col items-center rounded-2xl border-2 border-amber-400 bg-[#1a0804]/95 px-8 py-4 shadow-2xl">
                  <Flame className="h-10 w-10 text-amber-400 animate-spin mb-1" />
                  <span className="font-display text-lg font-black text-amber-300 uppercase tracking-wider">
                    ⚡ DERBY CLASH IN PROGRESS ⚡
                  </span>
                  <p className="text-xs text-stone-200 mt-1">Sabong arena battle underway...</p>
                </div>
              )}

              {matchStatus === 'result' && lastResult && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex flex-col items-center rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-[#2d1203] via-black to-[#05291e] px-6 py-4 shadow-2xl max-w-md mx-auto"
                >
                  <Trophy className="h-8 w-8 text-amber-400 mb-1" />
                  <span className="font-display text-base font-black text-amber-300 uppercase">
                    Match Result: {lastResult.winner.toUpperCase()} WINS!
                  </span>
                  <p className="text-xs font-bold text-white mt-1">{lastResult.text}</p>
                </motion.div>
              )}
            </div>

            {/* Bottom Match Card Info */}
            <div className="relative z-10 p-3 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-600 px-2 py-0.5 font-bold text-white">MERON (Red)</span>
                <span className="text-stone-300">Red Star Gamefarm</span>
              </div>
              <span className="font-mono-num font-black text-amber-400">VS</span>
              <div className="flex items-center gap-2">
                <span className="text-stone-300">Bacolod Bluehawk</span>
                <span className="rounded bg-blue-600 px-2 py-0.5 font-bold text-white">WALA (Blue)</span>
              </div>
            </div>
          </div>

          {/* BETTING PLACE: MERON & WALA */}
          <div className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-white">Place Your Derby Bets</h2>
                <p className="text-xs text-emerald-300">Choose Meron (×1.85) or Wala (×1.95) to win</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-emerald-300">Chip:</span>
                {BET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      playChipClink();
                      setSelectedBetAmount(amt);
                    }}
                    className={`rounded-lg px-2.5 py-1 font-mono-num text-xs font-black transition cursor-pointer ${
                      selectedBetAmount === amt
                        ? 'bg-amber-400 text-emerald-950 ring-2 ring-white shadow'
                        : 'bg-emerald-950 border border-emerald-700 text-emerald-200 hover:bg-emerald-900'
                    }`}
                  >
                    ₱{amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Betting Buttons Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* MERON BUTTON */}
              <button
                type="button"
                disabled={matchStatus !== 'betting'}
                onClick={() => handlePlaceBet('meron')}
                className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-center transition cursor-pointer disabled:opacity-75 ${
                  selectedSide === 'meron'
                    ? 'border-red-400 bg-red-950/90 shadow-[0_0_25px_rgba(239,68,68,0.5)]'
                    : 'border-red-700/80 bg-gradient-to-b from-red-950/80 to-[#1c0808] hover:border-red-400'
                }`}
              >
                <div className="absolute top-2 right-2 rounded-full bg-red-600/30 px-2 py-0.5 text-[10px] font-black text-red-200">
                  PAYS 1.85×
                </div>
                <span className="font-display text-lg font-black uppercase tracking-wide text-red-300">
                  MERON (RED)
                </span>
                <p className="text-xs text-red-200/80 mt-0.5">Red Corner Favorite</p>
                <div className="mt-3 rounded-xl border border-red-500/40 bg-black/40 py-2">
                  <span className="text-[10px] font-bold text-red-300 block">YOUR MERON BET</span>
                  <span className="font-mono-num text-sm font-black text-white">
                    ₱{totalMeronBets.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </button>

              {/* DRAW BUTTON */}
              <button
                type="button"
                disabled={matchStatus !== 'betting'}
                onClick={() => handlePlaceBet('draw')}
                className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-center transition cursor-pointer disabled:opacity-75 ${
                  selectedSide === 'draw'
                    ? 'border-amber-400 bg-amber-950/90 shadow-[0_0_25px_rgba(251,191,36,0.5)]'
                    : 'border-amber-700/80 bg-gradient-to-b from-amber-950/80 to-[#1c1808] hover:border-amber-400'
                }`}
              >
                <div className="absolute top-2 right-2 rounded-full bg-amber-600/30 px-2 py-0.5 text-[10px] font-black text-amber-200">
                  PAYS 8.0×
                </div>
                <span className="font-display text-lg font-black uppercase tracking-wide text-amber-300">
                  DRAW (REMATA)
                </span>
                <p className="text-xs text-amber-200/80 mt-0.5">Tie Derby Match</p>
                <div className="mt-3 rounded-xl border border-amber-500/40 bg-black/40 py-2">
                  <span className="text-[10px] font-bold text-amber-300 block">YOUR DRAW BET</span>
                  <span className="font-mono-num text-sm font-black text-white">
                    ₱{totalDrawBets.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </button>

              {/* WALA BUTTON */}
              <button
                type="button"
                disabled={matchStatus !== 'betting'}
                onClick={() => handlePlaceBet('wala')}
                className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-center transition cursor-pointer disabled:opacity-75 ${
                  selectedSide === 'wala'
                    ? 'border-blue-400 bg-blue-950/90 shadow-[0_0_25px_rgba(59,130,246,0.5)]'
                    : 'border-blue-700/80 bg-gradient-to-b from-blue-950/80 to-[#080d1c] hover:border-blue-400'
                }`}
              >
                <div className="absolute top-2 right-2 rounded-full bg-blue-600/30 px-2 py-0.5 text-[10px] font-black text-blue-200">
                  PAYS 1.95×
                </div>
                <span className="font-display text-lg font-black uppercase tracking-wide text-blue-300">
                  WALA (BLUE)
                </span>
                <p className="text-xs text-blue-200/80 mt-0.5">Blue Corner Underdog</p>
                <div className="mt-3 rounded-xl border border-blue-500/40 bg-black/40 py-2">
                  <span className="text-[10px] font-bold text-blue-300 block">YOUR WALA BET</span>
                  <span className="font-mono-num text-sm font-black text-white">
                    ₱{totalWalaBets.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </button>

            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RECENT DERBY HISTORY & SCOREBOARD */}
        <div className="lg:col-span-4 space-y-4">
          
          <div className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                <span>📊</span> Derby Fight Scoreboard
              </h3>
              <span className="text-xs font-mono-num text-amber-300">Live Arena</span>
            </div>
            <p className="text-xs text-emerald-300">Recent match results history beads:</p>

            {/* Beads Row */}
            <div className="flex flex-wrap gap-2 py-1">
              {fightHistory.map((item, idx) => (
                <div
                  key={item.id}
                  title={`Match #${idx + 1}: ${item.winner.toUpperCase()} Won (${item.meronName} vs ${item.walaName})`}
                  className={`flex h-9 w-9 items-center justify-center rounded-full font-mono-num text-xs font-black shadow ${
                    item.winner === 'meron'
                      ? 'bg-red-600 text-white ring-2 ring-red-300/40'
                      : item.winner === 'wala'
                        ? 'bg-blue-600 text-white ring-2 ring-blue-300/40'
                        : 'bg-amber-500 text-emerald-950 ring-2 ring-amber-300/40'
                  }`}
                >
                  {item.winner === 'meron' ? 'M' : item.winner === 'wala' ? 'W' : 'D'}
                </div>
              ))}
            </div>

            {/* Detailed History List */}
            <div className="divide-y divide-emerald-800/60 max-h-[360px] overflow-y-auto space-y-2 pr-1 pt-2">
              {fightHistory.map((h, i) => (
                <div key={h.id} className="pt-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-white">Round #{fightHistory.length - i}</span>
                    <p className="text-[10px] text-emerald-300">
                      {h.meronName} vs {h.walaName}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 font-black text-[11px] ${
                      h.winner === 'meron'
                        ? 'bg-red-900 text-red-200'
                        : h.winner === 'wala'
                          ? 'bg-blue-900 text-blue-200'
                          : 'bg-amber-900 text-amber-200'
                    }`}
                  >
                    {h.winner.toUpperCase()} ({h.payoutMultiplier}×)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 text-xs text-emerald-200/90 space-y-2">
            <h4 className="font-bold text-amber-300">Online Sabong Rules</h4>
            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>Meron (Red Corner) pays 1.85× your stake.</li>
              <li>Wala (Blue Corner) pays 1.95× your stake.</li>
              <li>Draw (Remata) pays 8.00× your stake.</li>
              <li>Bets lock automatically 15 seconds before each match begins.</li>
            </ul>
          </div>

        </div>

      </main>
    </div>
  );
};
