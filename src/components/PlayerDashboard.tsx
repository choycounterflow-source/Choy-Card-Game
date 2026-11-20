import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  Coins,
  Copy,
  Crown,
  Gift,
  History,
  KeyRound,
  Link2,
  MapPin,
  Share2,
  Shield,
  Swords,
  Trash2,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AgentOverviewData,
  GameKey,
  GameSetting,
  GameTableSummary,
  NotificationItem,
  SlotGameKey,
  SystemConfig,
  TournamentSummary,
  Transaction,
  UserProfile,
} from '../types';
import {
  COMING_SOON_SLOT_KEYS,
  SLOT_GAME_CATALOG,
  SLOT_GAME_KEYS,
  VIP_RULES,
} from '../types';
import { GAME_ART_MAP } from '../lib/gameImages';
import { playWinFanfare } from '../lib/audio';
import {
  buildPlayerShareLink,
  copyTextReliable,
  normalizeToPublicShareUrl,
} from '../lib/shareUrl';
import { ConfettiCanvas, type ConfettiCanvasRef } from './ConfettiCanvas';

export interface WeeklyLeaderItem {
  rank: number;
  id: string;
  full_name: string;
  vip_level: number;
  total_wins: number;
  games_won: number;
  prize: number;
}

export interface VipDirectoryItem {
  id: string;
  full_name: string;
  role: string;
  vip_level: number;
  games_won: number;
  games_lost: number;
  total_wins: number;
  wallet_balance: number;
}

interface PlayerDashboardProps {
  profile: UserProfile;
  games: GameSetting[];
  systemConfig: SystemConfig;
  transactions: Transaction[];
  notifications: NotificationItem[];
  tables: GameTableSummary[];
  weeklyTop3: WeeklyLeaderItem[];
  vipDirectory: VipDirectoryItem[];
  gpsStatus: string;
  onOpenCashIn: () => void;
  onOpenCashOut: () => void;
  onOpenGameSetup: (game: GameSetting) => void;
  onOpenSlotGame: (gameKey: SlotGameKey) => void;
  onMarkNotificationsRead: () => void;
  onDeleteNotification: (notificationId: string) => void;
  onClearAllNotifications: () => void;
  onRefresh: () => void;
  publicShareOrigin?: string;
  onOpenShareModal?: () => void;
  onBackToAdmin?: () => void;
  onOpenCockfight?: () => void;
}

type DashTab = 'lobby' | 'tournaments' | 'vip' | 'agent' | 'wallet' | 'notifications';

export const PlayerDashboard: React.FC<PlayerDashboardProps> = ({
  profile,
  games,
  systemConfig,
  transactions,
  notifications,
  tables,
  weeklyTop3,
  vipDirectory,
  gpsStatus,
  onOpenCashIn,
  onOpenCashOut,
  onOpenGameSetup,
  onOpenSlotGame,
  onMarkNotificationsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onRefresh,
  publicShareOrigin,
  onOpenShareModal,
  onBackToAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<DashTab>('lobby');
  const [vipFilter, setVipFilter] = useState<'all' | '2' | '1'>('all');
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Tournaments & Agent Hub state
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [tourneyMsg, setTourneyMsg] = useState('');
  const [agentData, setAgentData] = useState<AgentOverviewData | null>(null);

  // Withdrawal PIN update state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  // Daily Login Check-in state & handler
  const [claimingDay, setClaimingDay] = useState<number | null>(null);
  const [txSubTab, setTxSubTab] = useState<'cash_in' | 'cash_out' | 'other'>('cash_in');

  const cashInTxs = useMemo(() => transactions.filter((t) => t.type === 'cash_in'), [transactions]);
  const cashOutTxs = useMemo(() => transactions.filter((t) => t.type === 'cash_out'), [transactions]);
  const otherTxs = useMemo(() => transactions.filter((t) => t.type !== 'cash_in' && t.type !== 'cash_out'), [transactions]);

  const activeTxs = txSubTab === 'cash_in' ? cashInTxs : txSubTab === 'cash_out' ? cashOutTxs : otherTxs;

  const claimedDaysList = useMemo(() => {
    try {
      return JSON.parse(profile.checkin_claimed_days || '[]') as number[];
    } catch {
      return [];
    }
  }, [profile.checkin_claimed_days]);

  const handleClaimDaily = async (dayNum: number) => {
    if (claimingDay !== null) return;
    setClaimingDay(dayNum);
    try {
      const res = await fetch('/api/player/daily-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, dayNumber: dayNum }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not claim daily reward.');
        setClaimingDay(null);
        return;
      }
      playWinFanfare();
      onRefresh();
    } catch {
      alert('Network error while claiming daily reward.');
    } finally {
      setClaimingDay(null);
    }
  };

  useEffect(() => {
    fetch(`/api/tournaments?userId=${encodeURIComponent(profile.id)}`)
      .then((r) => r.json())
      .then((d) => setTournaments(d.tournaments || []))
      .catch(() => {});

    fetch(`/api/agent/overview?userId=${encodeURIComponent(profile.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.referralCode) setAgentData(d);
      })
      .catch(() => {});
  }, [profile.id, activeTab]);

  const handleJoinTournament = async (gameKey: GameKey) => {
    setTourneyMsg('');
    const res = await fetch('/api/tournaments/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id, gameKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTourneyMsg(data.error || 'Unable to join tournament.');
    } else {
      setTournaments(data.tournaments || []);
      setTourneyMsg('Registered in tournament! Play tables for this game to earn leaderboard points.');
      onRefresh();
    }
  };

  const handleCopyInviteLink = async () => {
    const origin = publicShareOrigin || normalizeToPublicShareUrl(window.location.origin);
    const inviteUrl = buildPlayerShareLink(origin, profile.referral_code);
    const ok = await copyTextReliable(inviteUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } else {
      setCopiedLink(false);
    }
  };

  const vipCfg = profile.vip_level >= 2 ? VIP_RULES[2] : VIP_RULES[1];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredVipPlayers = useMemo(() => {
    if (vipFilter === 'all') return vipDirectory;
    return vipDirectory.filter((p) => String(p.vip_level) === vipFilter);
  }, [vipDirectory, vipFilter]);

  const tableHandsByGame = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tables) {
      map.set(t.game_key, (map.get(t.game_key) || 0) + (t.hands_played || 0));
    }
    return map;
  }, [tables]);

  const handleCopyRef = async () => {
    const ok = await copyTextReliable(profile.referral_code);
    if (ok) {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 1800);
    } else {
      setCopiedRef(false);
    }
  };

  const handlePinUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg('');
    const res = await fetch('/api/player/update-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id, currentPin, newPin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPinMsg(data.error || 'Could not update PIN.');
    } else {
      setPinMsg('Withdrawal PIN updated successfully.');
      setCurrentPin('');
      setNewPin('');
      onRefresh();
    }
  };

  const vip2CashProgress = Math.min(100, Math.round((profile.total_cash_in / 1000) * 100));
  const vip2BetProgress = Math.min(100, Math.round((profile.total_bet / 10000) * 100));

  const confettiRef = useRef<ConfettiCanvasRef>(null);
  const prevVipRef = useRef<number>(profile.vip_level);

  useEffect(() => {
    if (profile.vip_level > prevVipRef.current) {
      prevVipRef.current = profile.vip_level;
      playWinFanfare();
      confettiRef.current?.trigger();
    }
  }, [profile.vip_level]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 space-y-6">
      <ConfettiCanvas ref={confettiRef} />
      {/* Admin Preview Return Banner (when Admin previews Player Lobby) */}
      {onBackToAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/50 bg-amber-950/35 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <Shield className="h-4 w-4 text-amber-400" />
            <span>You are viewing the Player Lobby as Super Admin Choy.</span>
          </div>
          <button
            type="button"
            onClick={onBackToAdmin}
            className="rounded-lg bg-amber-400 px-3.5 py-1.5 font-bold text-emerald-950 hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer"
          >
            Return to Admin Dashboard
          </button>
        </div>
      )}

      {/* Profile & Wallet Overview Header */}
      <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-display text-2xl font-extrabold text-white">{profile.full_name}</h1>
              <span className="text-xs font-bold text-amber-300 tracking-wide">
                {vipCfg.name} · VIP Member
              </span>
              <span className="text-xs text-emerald-300 font-mono-num">{profile.phone}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-emerald-200">
              <span>
                Cashout: <strong className="text-white">{vipCfg.dailyCashoutLimit}x/day · Max ₱{vipCfg.maxCashoutAmount.toLocaleString()}</strong>
              </span>
              <span aria-hidden="true" className="text-emerald-600">·</span>
              <span className="inline-flex items-center gap-1.5">
                Referral:
                <strong className="font-mono-num text-amber-300">{profile.referral_code}</strong>
                <button
                  type="button"
                  onClick={handleCopyRef}
                  aria-label="Copy referral code"
                  className="inline-flex items-center gap-1 text-emerald-300 hover:text-white cursor-pointer"
                >
                  {copiedRef ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </span>
              <span aria-hidden="true" className="text-emerald-600">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                {gpsStatus}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 border-emerald-800/80 pt-4 lg:pt-0">
            <div className="text-left lg:text-right">
              <span className="text-xs text-emerald-300 block">Main Wallet Balance</span>
              <span className="font-mono-num text-3xl font-extrabold text-amber-400 tracking-tight">
                ₱{profile.wallet_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
              <span className="block text-[11px] text-emerald-300 font-mono-num">
                Pending Cashback: ₱{profile.pending_cashback.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenCashIn}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Coins className="h-4 w-4" />
                Cash In
              </button>
              <button
                type="button"
                onClick={onOpenCashOut}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-900/70 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Wallet className="h-4 w-4 text-amber-300" />
                Cash Out
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic VIP Tier Badge & Activity Progress Component */}
        <div className="mt-5 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-[#03241b] via-[#052920] to-[#03241b] p-4 sm:p-5 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-emerald-950 shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-sm sm:text-base font-extrabold text-white">
                    VIP Tier Status: <span className="text-amber-300">{vipCfg.name}</span>
                  </h2>
                  <span className="rounded-full bg-amber-400/20 border border-amber-400/60 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 uppercase">
                    {profile.vip_level >= 2 ? 'Master Elite' : 'Active Member'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playWinFanfare();
                      confettiRef.current?.trigger();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-black text-emerald-950 hover:bg-amber-300 transition cursor-pointer shadow"
                    title="Celebrate VIP Tier Progress"
                  >
                    🎉 Celebrate VIP
                  </button>
                </div>
                <p className="text-xs text-emerald-200">
                  {profile.vip_level >= 2
                    ? 'Maximum VIP 2 priority rewards & 3x daily cashouts active.'
                    : `Total Game Bets: ₱${profile.total_bet.toLocaleString()} · Cash-in: ₱${profile.total_cash_in.toLocaleString()}`}
                </p>
              </div>
            </div>

            <div className="w-full md:w-68 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-300">
                  {profile.vip_level >= 2 ? 'VIP 2 Max Reached' : 'Progress to VIP 2'}
                </span>
                <span className="font-mono-num text-amber-300">
                  {profile.vip_level >= 2 ? '100%' : `${vip2BetProgress}%`}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/60 border border-emerald-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 transition-all duration-700 ease-out"
                  style={{
                    width: `${profile.vip_level >= 2 ? 100 : vip2BetProgress}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-emerald-300 text-right font-mono-num">
                {profile.vip_level >= 2
                  ? 'Max VIP Level Active ⭐'
                  : `Need ₱${Math.max(0, 10000 - profile.total_bet).toLocaleString()} more in total bets to reach VIP 2`}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs inside Player Dashboard */}
        <div className="mt-5 flex items-center gap-1.5 overflow-x-auto border-t border-emerald-800/70 pt-4">
          {[
            { id: 'lobby' as DashTab, label: 'Game Tables', icon: Trophy },
            { id: 'tournaments' as DashTab, label: 'Tournaments', icon: Swords },
            { id: 'vip' as DashTab, label: 'Players by VIP', icon: Users },
            { id: 'agent' as DashTab, label: profile.role === 'agent' || profile.role === 'admin' ? 'Agent Hub' : 'Referrals', icon: Link2 },
            { id: 'wallet' as DashTab, label: 'Wallet, Bonuses & PIN', icon: History },
            { id: 'notifications' as DashTab, label: `Notifications${unreadCount ? ` (${unreadCount})` : ''}`, icon: Bell },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'notifications' && unreadCount > 0) {
                    onMarkNotificationsRead();
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-amber-400 text-emerald-950'
                    : 'text-emerald-200 hover:bg-emerald-900/70 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ==================== TAB 1: GAME LOBBY & MILESTONE TABLES ==================== */}
      {activeTab === 'lobby' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 8 Columns: 7 Games & Milestone Tables */}
          <div className="lg:col-span-8 space-y-6">
            {/* Daily Login Rewards & 7-Day Progress Calendar */}
            <section className="rounded-3xl border border-amber-400/60 bg-gradient-to-r from-[#03241b] via-[#052920] to-[#03241b] p-5 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-emerald-950 shadow-[0_0_20px_rgba(251,191,36,0.6)]">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-extrabold text-white">
                      Daily Login Rewards & Streak
                    </h2>
                    <p className="text-xs text-amber-300 font-semibold">
                      🔥 Current Streak: <strong className="font-mono-num text-white">{profile.daily_streak || claimedDaysList.length} Days</strong> · Claim bonus coins daily!
                    </p>
                  </div>
                </div>
              </div>

              {/* 7-Day Calendar Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {[
                  { day: 1, reward: 5 },
                  { day: 2, reward: 10 },
                  { day: 3, reward: 20 },
                  { day: 4, reward: 35 },
                  { day: 5, reward: 50 },
                  { day: 6, reward: 75 },
                  { day: 7, reward: 150 },
                ].map((item) => {
                  const isClaimed = claimedDaysList.includes(item.day);
                  const prevClaimed = item.day === 1 || claimedDaysList.includes(item.day - 1);
                  const isAvailable = !isClaimed && prevClaimed;

                  return (
                    <div
                      key={item.day}
                      className={`relative flex flex-col items-center justify-between rounded-2xl border p-2.5 text-center transition-all ${
                        isClaimed
                          ? 'border-emerald-600/80 bg-emerald-950/70 opacity-85'
                          : isAvailable
                            ? 'border-amber-400 bg-[#07382b] shadow-[0_0_18px_rgba(251,191,36,0.4)] ring-2 ring-amber-400/50'
                            : 'border-emerald-900/80 bg-[#021812]/80 opacity-60'
                      }`}
                    >
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
                        Day {item.day}
                      </span>
                      <div className="my-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/20 text-amber-200 font-mono-num font-black text-xs">
                        ₱{item.reward}
                      </div>
                      {isClaimed ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-900/90 px-2 py-1 text-[10px] font-bold text-emerald-200">
                          <Check className="h-3 w-3" /> Claimed
                        </span>
                      ) : isAvailable ? (
                        <button
                          type="button"
                          disabled={claimingDay === item.day}
                          onClick={() => handleClaimDaily(item.day)}
                          className="w-full rounded-xl bg-amber-400 py-1.5 text-[11px] font-black text-emerald-950 hover:bg-amber-300 transition shadow cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          {claimingDay === item.day ? 'Claiming...' : 'Claim 🎁'}
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-400/70">
                          🔒 Locked
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* All Games Picture Grid — Tap Any Game to Choose Mode & Bet Inside */}
            <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">Choose a Game to Play</h2>
                  <p className="text-xs text-emerald-300">
                    Tap any game to choose game mode & betting amount · Strict 2km GPS Separation
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {games.map((g) => {
                  const isSlot = SLOT_GAME_KEYS.includes(g.game_key as SlotGameKey);
                  const isComingSoonSlot =
                    !g.is_enabled && COMING_SOON_SLOT_KEYS.includes(g.game_key as SlotGameKey);
                  const canOpen = g.is_enabled || (isComingSoonSlot && profile.role === 'admin');
                  const timerText = isComingSoonSlot
                    ? 'Soon'
                    : isSlot
                      ? '6×5'
                      : g.turn_seconds >= 60
                        ? `${g.turn_seconds / 60}m`
                        : `${g.turn_seconds}s`;
                  const coverSrc = GAME_ART_MAP[g.game_key];
                  const totalHands = tableHandsByGame.get(g.game_key) || 0;

                  const handleGameCardClick = () => {
                    if (!canOpen) return;
                    if (g.game_key === 'cockfight') {
                      onOpenCockfight?.();
                    } else if (isSlot) {
                      onOpenSlotGame(g.game_key as SlotGameKey);
                    } else {
                      onOpenGameSetup(g);
                    }
                  };

                  return (
                    <button
                      key={g.game_key}
                      type="button"
                      disabled={!canOpen}
                      onClick={handleGameCardClick}
                      className={`group relative overflow-hidden rounded-2xl border text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        isComingSoonSlot
                          ? 'border-amber-500/40 hover:border-amber-400/80'
                          : 'border-emerald-700/80 hover:border-amber-400 hover:ring-2 hover:ring-amber-400/70 hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(251,191,36,0.28)]'
                      }`}
                    >
                      {/* Full-Bleed 4:3 Game Picture */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#031c16]">
                        <img
                          src={coverSrc}
                          alt={g.game_name}
                          loading="lazy"
                          className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                            isComingSoonSlot ? 'brightness-75 saturate-90' : ''
                          }`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#02120d] via-[#02120d]/45 to-transparent" />

                        {/* Top-Right Compact Tag */}
                        <span
                          className={`absolute top-2 right-2 rounded-md px-1.5 py-0.5 font-mono-num text-[10px] font-extrabold shadow backdrop-blur-xs ${
                            isComingSoonSlot
                              ? 'bg-black/75 text-amber-300 border border-amber-400/40'
                              : 'bg-black/70 text-emerald-200 border border-emerald-500/35 group-hover:bg-amber-400 group-hover:text-emerald-950'
                          }`}
                        >
                          {timerText}
                        </span>

                        {/* Bottom Title & Action Prompt */}
                        <div className="absolute inset-x-0 bottom-0 p-2.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-display text-sm font-black leading-tight truncate text-white group-hover:text-amber-300 drop-shadow">
                              {g.short_label}
                            </span>
                          </div>
                          <p
                            className={`mt-0.5 text-[10px] font-semibold truncate ${
                              isComingSoonSlot ? 'text-amber-200/90' : 'text-emerald-200/90'
                            }`}
                          >
                            {isComingSoonSlot
                              ? profile.role === 'admin'
                                ? 'Admin Preview · 6×5 Slot'
                                : 'Coming Soon · 6×5 Slot'
                              : !g.is_enabled
                                ? 'Disabled by Admin'
                                : isSlot
                                  ? 'Tap to Spin · 6×5 Slot'
                                  : g.game_key === 'tongits'
                                    ? 'Regular · Butasan · Joker'
                                    : totalHands > 0
                                      ? `Tap to Bet · ${totalHands} hands`
                                      : 'Tap to Choose Bet'}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Upcoming Choy Slot Lineup — Coming Soon */}
            <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4 pb-3 border-b border-emerald-800/70">
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    Choy Card Game · 6×5 Slot Series (Coming Soon)
                  </h2>
                  <p className="text-xs text-emerald-300 mt-0.5">
                    Upcoming 6×5 cascading slot titles in Choy Card Game — stay tuned for launch.
                  </p>
                </div>
                <span className="text-xs font-mono-num text-amber-300">4 Games Staged</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {COMING_SOON_SLOT_KEYS.map((slotKey) => {
                  const meta = SLOT_GAME_CATALOG[slotKey];
                  const dbGame = games.find((g) => g.game_key === slotKey);
                  const isLive = Boolean(dbGame?.is_enabled);
                  return (
                    <div
                      key={slotKey}
                      className={`overflow-hidden rounded-2xl border ${meta.accentBorder} bg-gradient-to-br ${meta.cabinetGradient} flex flex-col justify-between`}
                    >
                      <div className="relative h-32 w-full overflow-hidden">
                        <img
                          src={GAME_ART_MAP[slotKey]}
                          alt={meta.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                        <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-2">
                          <h3 className="font-display text-base font-black text-amber-300 drop-shadow">
                            {meta.title}
                          </h3>
                          <span className="rounded-md bg-black/75 border border-amber-400/40 px-2 py-0.5 font-mono-num text-[10px] font-bold text-amber-200">
                            {isLive ? 'Live Now' : 'Coming Soon'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 flex flex-col justify-between gap-3 flex-1">
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold text-white">{meta.inspiredFeature}</p>
                          <p className="text-[11px] text-emerald-200/85 leading-relaxed">
                            6×5 Cascading Reels · Bets ₱0.5–₱50 · Free Spins Feature
                          </p>
                        </div>

                        {isLive || profile.role === 'admin' ? (
                          <button
                            type="button"
                            onClick={() => onOpenSlotGame(slotKey)}
                            className="w-full rounded-xl bg-amber-400 py-2 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 transition-colors cursor-pointer"
                          >
                            {isLive ? `Play ${meta.title}` : `Admin Preview ${meta.title}`}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="w-full rounded-xl border border-amber-400/40 bg-[#031c16]/75 py-2 text-xs font-bold text-amber-300/90 cursor-not-allowed"
                          >
                            Coming Soon
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right 4 Columns: Weekly Top 3 Rewards & VIP Progression */}
          <div className="lg:col-span-4 space-y-6">
            {/* Weekly Top 3 Leaderboard */}
            <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-400" />
                  <h2 className="font-display text-base font-bold text-white">Weekly Top 3 Rewards</h2>
                </div>
                <span className="text-[11px] font-medium text-emerald-300">
                  {systemConfig.weekly_reward_enabled ? 'Active Pool' : 'Paused'}
                </span>
              </div>

              <div className="divide-y divide-emerald-800/70">
                {weeklyTop3.map((entry) => (
                  <div key={entry.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono-num text-xs font-extrabold ${
                          entry.rank === 1
                            ? 'bg-amber-400 text-emerald-950'
                            : entry.rank === 2
                              ? 'bg-slate-300 text-slate-950'
                              : 'bg-amber-700 text-white'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{entry.full_name}</p>
                        <p className="text-[11px] text-emerald-300 font-mono-num">
                          VIP {entry.vip_level} · {entry.games_won}W · ₱{entry.total_wins.toLocaleString()} won
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono-num text-sm font-extrabold text-amber-300 block">
                        ₱{entry.prize.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-emerald-400">Weekly Prize</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* VIP Tier Status Card */}
            <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-amber-400" />
                <h2 className="font-display text-base font-bold text-white">VIP Tier Benefits</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div className="rounded-2xl bg-[#031c16] border border-emerald-800/80 p-3.5">
                  <div className="flex justify-between font-bold text-white">
                    <span>VIP 1 Tier</span>
                    <span className="text-emerald-300">VIP Rewards</span>
                  </div>
                  <p className="mt-1 text-emerald-300">
                    Cash In ₱100 · Daily Cash Out (Max ₱1,000)
                  </p>
                </div>

                <div className="rounded-2xl bg-[#031c16] border border-amber-400/40 p-3.5 space-y-2">
                  <div className="flex justify-between font-bold text-amber-300">
                    <span>VIP 2 Tier</span>
                    <span>Priority VIP Rewards</span>
                  </div>
                  <p className="text-emerald-200">
                    Cash In ₱1,000 · Priority Cash Out (3x/day · Max ₱5,000)
                  </p>

                  <div className="pt-1 space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[11px] font-mono-num text-emerald-300">
                        <span>Cash-In Progress</span>
                        <span>₱{profile.total_cash_in.toLocaleString()} / ₱1,000</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-emerald-950 overflow-hidden">
                        <div className="h-full bg-emerald-400" style={{ width: `${vip2CashProgress}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-mono-num text-emerald-300">
                        <span>Betting Volume</span>
                        <span>₱{profile.total_bet.toLocaleString()} / ₱10,000</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-emerald-950 overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${vip2BetProgress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ==================== TAB 1B: TOURNAMENTS ARENA ==================== */}
      {activeTab === 'tournaments' && (
        <section className="space-y-5">
          <div className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Active Game Tournaments</h2>
                <p className="text-xs text-emerald-300">
                  Register with ₱50 entry fee, play hands on matching game tables to climb the leaderboard, and win Admin-configured prize pools!
                </p>
              </div>
            </div>
            {tourneyMsg && (
              <p className="mt-3 rounded-xl border border-amber-400/50 bg-amber-950/40 px-3.5 py-2 text-xs font-semibold text-amber-200">
                {tourneyMsg}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournaments
              .filter((t) => t.tournament_enabled)
              .map((t) => {
                const matchedGame = games.find((g) => g.game_key === t.game_key);
                return (
                  <div
                    key={t.game_key}
                    className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={GAME_ART_MAP[t.game_key]}
                            alt={t.short_label}
                            loading="lazy"
                            className="h-12 w-16 rounded-xl object-cover border border-amber-400/50 shadow shrink-0"
                          />
                          <div>
                            <h3 className="font-display text-base font-extrabold text-white">{t.short_label} Cup</h3>
                            <p className="text-xs text-emerald-300 mt-0.5">
                              Entry: <strong className="font-mono-num text-white">₱{t.entry_fee}</strong> · {t.entrants.length} Players Joined
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-emerald-300 block">Prize Pool</span>
                          <strong className="font-mono-num text-lg font-extrabold text-amber-400">
                            ₱{t.tournament_prize.toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-[#031c16] border border-emerald-800/70 p-3 space-y-2">
                        <p className="text-[11px] font-bold text-amber-300">Live Standings</p>
                        {t.entrants.length === 0 ? (
                          <p className="text-xs text-emerald-400">Be the first to register!</p>
                        ) : (
                          t.entrants.slice(0, 4).map((e, idx) => (
                            <div key={e.id} className="flex items-center justify-between text-xs">
                              <span className="text-emerald-100">
                                <strong className="font-mono-num text-amber-300 mr-1.5">#{idx + 1}</strong>
                                {e.user_name}
                              </span>
                              <span className="font-mono-num font-bold text-emerald-300">{e.score} pts</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.is_joined ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (matchedGame) {
                              if (SLOT_GAME_KEYS.includes(matchedGame.game_key as SlotGameKey)) {
                                onOpenSlotGame(matchedGame.game_key as SlotGameKey);
                              } else {
                                onOpenGameSetup(matchedGame);
                              }
                            }
                          }}
                          className="w-full rounded-xl bg-emerald-400 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 cursor-pointer"
                        >
                          Registered — Play Table for Points
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleJoinTournament(t.game_key)}
                          className="w-full rounded-xl bg-amber-400 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer"
                        >
                          Join Tournament (₱{t.entry_fee})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ==================== TAB 2B: AGENT & REFERRAL COMMISSION HUB ==================== */}
      {activeTab === 'agent' && (
        <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-800/70 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                {profile.role === 'agent' || profile.role === 'admin' ? 'Agent Commission Portal' : 'Referral Rewards Hub'}
              </h2>
              <p className="text-xs text-emerald-300">
                Earn ₱25 instant signup commission + 5% volume commission tracking for every player who joins via your invite link.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                {copiedLink ? 'Public Link Copied!' : `Copy Invite Link (${profile.referral_code})`}
              </button>
              {onOpenShareModal && (
                <button
                  type="button"
                  onClick={onOpenShareModal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/70 bg-[#031c16] px-3.5 py-2.5 text-xs font-extrabold text-amber-200 hover:bg-amber-400/20 cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="h-4 w-4" />
                  Share / QR Code
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono-num">
            <div className="rounded-2xl bg-[#031c16] border border-emerald-800 p-4">
              <span className="font-sans text-xs text-emerald-300 block">Referred Players</span>
              <strong className="text-2xl text-white">{agentData?.referredCount ?? 0}</strong>
            </div>
            <div className="rounded-2xl bg-[#031c16] border border-emerald-800 p-4">
              <span className="font-sans text-xs text-emerald-300 block">Downline Bet & Cash-In Volume</span>
              <strong className="text-2xl text-emerald-300">
                ₱{(agentData?.totalReferralVolume ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div className="rounded-2xl bg-[#031c16] border border-emerald-800 p-4">
              <span className="font-sans text-xs text-emerald-300 block">Estimated 5% Commission</span>
              <strong className="text-2xl text-amber-300">
                ₱{(agentData?.estimatedCommission ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-amber-300 mb-3">Referred Downline Roster</h3>
            {!agentData || agentData.members.length === 0 ? (
              <p className="text-xs text-emerald-300 rounded-2xl bg-[#031c16] border border-emerald-800/70 p-4">
                No players have registered with your code <strong className="font-mono-num text-amber-300">{profile.referral_code}</strong> yet. Share your Invite Link above to start earning ₱25 instant signup rewards!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-emerald-800 text-xs text-emerald-300">
                      <th className="py-2.5 pr-3">Player</th>
                      <th className="py-2.5 px-3">VIP</th>
                      <th className="py-2.5 px-3 text-right">Total Cash-In</th>
                      <th className="py-2.5 pl-3 text-right">Total Bet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-800/60">
                    {agentData.members.map((m) => (
                      <tr key={m.id}>
                        <td className="py-2.5 pr-3">
                          <span className="font-bold text-white block">{m.full_name}</span>
                          <span className="font-mono-num text-[11px] text-emerald-400">{m.phone}</span>
                        </td>
                        <td className="py-2.5 px-3 text-amber-300 font-bold">VIP {m.vip_level}</td>
                        <td className="py-2.5 px-3 text-right font-mono-num text-emerald-200">₱{m.total_cash_in.toLocaleString()}</td>
                        <td className="py-2.5 pl-3 text-right font-mono-num text-white">₱{m.total_bet.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================== TAB 2: PLAYER LIST BY VIP CATEGORY ==================== */}
      {activeTab === 'vip' && (
        <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Player Directory by VIP Category</h2>
              <p className="text-xs text-emerald-300">Live rankings across VIP 1 and VIP 2 members</p>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-[#031c16] p-1 border border-emerald-800">
              {[
                { id: 'all' as const, label: 'All Players' },
                { id: '2' as const, label: 'VIP 2' },
                { id: '1' as const, label: 'VIP 1' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setVipFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    vipFilter === f.id ? 'bg-amber-400 text-emerald-950' : 'text-emerald-300 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-800 text-xs text-emerald-300">
                  <th className="py-3 pr-4">Player</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Wins / Losses</th>
                  <th className="py-3 px-4 text-right">Total Winnings</th>
                  <th className="py-3 pl-4 text-right">Table Stack</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-800/60">
                {filteredVipPlayers.map((p) => (
                  <tr key={p.id} className="hover:bg-emerald-900/25">
                    <td className="py-3 pr-4 font-semibold text-white">
                      {p.full_name}
                      {p.id === profile.id && <span className="ml-2 text-xs text-amber-300">(You)</span>}
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-amber-300">
                      VIP {p.vip_level} · {p.role === 'bot' ? 'Pro House' : p.role === 'agent' ? 'Agent' : 'Member'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-xs text-emerald-200">
                      {p.games_won}W / {p.games_lost}L
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-emerald-300">
                      ₱{p.total_wins.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 pl-4 text-right font-mono-num text-amber-300">
                      ₱{p.wallet_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ==================== TAB 3: WALLET, BONUSES, REFERRAL & PIN ==================== */}
      {activeTab === 'wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-display text-lg font-bold text-white">Transaction History</h2>
              <div className="flex items-center gap-1 bg-[#031c16] rounded-xl p-1 border border-emerald-800/80">
                {[
                  { id: 'cash_in' as const, label: `Cash-In (${cashInTxs.length})` },
                  { id: 'cash_out' as const, label: `Cash-Out (${cashOutTxs.length})` },
                  { id: 'other' as const, label: `Other (${otherTxs.length})` },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setTxSubTab(sub.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      txSubTab === sub.id
                        ? 'bg-amber-400 text-emerald-950'
                        : 'text-emerald-200 hover:text-white'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTxs.length === 0 ? (
              <p className="text-sm text-emerald-300 py-4 text-center">No transactions in this category.</p>
            ) : (
              <div className="divide-y divide-emerald-800/60 max-h-[380px] overflow-y-auto pr-1">
                {activeTxs.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white capitalize">
                        {tx.type.replace('_', ' ')} · <span className="text-emerald-300 font-normal">{tx.payment_method || 'System'}</span>
                      </p>
                      <p className="text-xs text-emerald-400 truncate font-mono-num">
                        {tx.reference_no || tx.id} · {tx.status} · {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`font-mono-num text-sm font-bold shrink-0 ${
                        tx.type === 'cash_out' || tx.type === 'loss' || tx.type === 'rake'
                          ? 'text-red-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      {tx.type === 'cash_out' || tx.type === 'loss' || tx.type === 'rake' ? '-' : '+'}₱
                      {tx.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-amber-300">VIP & Referral Rewards</h3>
              <div className="grid grid-cols-2 gap-3 font-mono-num">
                <div className="rounded-2xl bg-[#031c16] border border-emerald-800/80 p-3.5">
                  <span className="font-sans text-[11px] text-emerald-300 block">Pending Rewards</span>
                  <strong className="text-lg text-amber-300">₱{profile.pending_cashback.toFixed(2)}</strong>
                </div>
                <div className="rounded-2xl bg-[#031c16] border border-emerald-800/80 p-3.5">
                  <span className="font-sans text-[11px] text-emerald-300 block">Total Bet Volume</span>
                  <strong className="text-lg text-white">₱{profile.total_bet.toLocaleString()}</strong>
                </div>
              </div>
              <p className="text-xs text-emerald-200 leading-relaxed">
                VIP rewards are credited by Admin Choy directly into your main wallet.
              </p>
            </div>

            {/* Withdrawal PIN Security */}
            <form onSubmit={handlePinUpdate} className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-400" />
                <h3 className="font-display text-base font-bold text-white">Update Withdrawal PIN</h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Current PIN"
                  className="rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                />
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="New 4-digit PIN"
                  className="rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              {pinMsg && <p className="text-xs text-amber-300">{pinMsg}</p>}
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-emerald-950 hover:bg-emerald-400 transition-colors cursor-pointer"
              >
                Save New Withdrawal PIN
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: NOTIFICATIONS ==================== */}
      {activeTab === 'notifications' && (
        <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-display text-lg font-bold text-white">Account &amp; Reward Notifications</h2>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAllNotifications}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/60 bg-red-950/60 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-900/70 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete All ({notifications.length})
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-emerald-300">No notifications yet.</p>
          ) : (
            <div className="divide-y divide-emerald-800/60">
              {notifications.map((n) => (
                <div key={n.id} className="py-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-amber-300">{n.title}</h3>
                      <span className="font-mono-num text-[11px] text-emerald-400">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-emerald-100 leading-relaxed">{n.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteNotification(n.id)}
                    title="Delete notification"
                    aria-label={`Delete notification ${n.title}`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-500/50 bg-red-950/50 px-2.5 py-1.5 text-[11px] font-bold text-red-200 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
