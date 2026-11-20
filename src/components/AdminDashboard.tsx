import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  Coins,
  Database,
  Download,
  Gamepad2,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  Trophy,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  AdminOverviewData,
  GameKey,
  GameSetting,
  GameTableSummary,
  SlotGameKey,
  TongitsVariant,
  UserProfile,
} from '../types';
import { COMING_SOON_SLOT_KEYS } from '../types';
import { clearAppCacheAndReload } from '../lib/cache';
import { AdminSecretStudio } from './AdminSecretStudio';

interface AdminDashboardProps {
  admin: UserProfile;
  onPreviewLobby: () => void;
}

type AdminSection = 'overview' | 'approvals' | 'games' | 'players' | 'bots' | 'ai_rewards';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ admin, onPreviewLobby }) => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [section, setSection] = useState<AdminSection>('overview');
  const [vipFilter, setVipFilter] = useState<'all' | '2' | '1' | 'agent' | 'bot' | 'admin'>('all');
  const [loading, setLoading] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const [secretStudioOpen, setSecretStudioOpen] = useState(false);
  const [toast, setToast] = useState('');
  const isInsideStudioPreview =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('studio_preview') === '1';

  // Editable states
  const [aiKnowledge, setAiKnowledge] = useState('');
  const [weeklyEnabled, setWeeklyEnabled] = useState(true);
  const [top1, setTop1] = useState(3000);
  const [top2, setTop2] = useState(1500);
  const [top3, setTop3] = useState(500);
  const [cashbackInputs, setCashbackInputs] = useState<Record<string, string>>({});
  const [coinInputs, setCoinInputs] = useState<Record<string, string>>({});
  const [botCoinInputs, setBotCoinInputs] = useState<Record<string, string>>({});
  const [tourneyPrizes, setTourneyPrizes] = useState<Record<string, string>>({});

  // Create Agent form
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentPassword, setAgentPassword] = useState('agent123');
  const [agentWallet, setAgentWallet] = useState('0');

  // Per-Table Setup Filters & Editable Bet Prices (Tong-its 2P/3P Regular/Butasan/Joker & All Games)
  const [tableGameFilter, setTableGameFilter] = useState<string>('tongits');
  const [tableVariantFilter, setTableVariantFilter] = useState<'all' | TongitsVariant>('all');
  const [tableSeatsFilter, setTableSeatsFilter] = useState<'all' | '2' | '3'>('all');
  const [tableEdits, setTableEdits] = useState<Record<string, { bet: string; minWallet: string }>>({});
  const [newTableVariant, setNewTableVariant] = useState<TongitsVariant>('Regular');
  const [newTableSeats, setNewTableSeats] = useState<2 | 3>(3);
  const [newTableBet, setNewTableBet] = useState('20');
  const [newTableMinWallet, setNewTableMinWallet] = useState('800');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/overview?adminId=${encodeURIComponent(admin.id)}`, {
        headers: { 'x-admin-id': admin.id },
      });
      const json: AdminOverviewData = await res.json();
      if (res.ok) {
        setData(json);
        setAiKnowledge(json.systemConfig.ask_choy_knowledge);
        setWeeklyEnabled(json.systemConfig.weekly_reward_enabled);
        setTop1(json.systemConfig.weekly_top1_prize);
        setTop2(json.systemConfig.weekly_top2_prize);
        setTop3(json.systemConfig.weekly_top3_prize);

        const nextCb: Record<string, string> = {};
        json.players.forEach((p) => {
          nextCb[p.id] = p.pending_cashback > 0 ? p.pending_cashback.toFixed(2) : '50';
        });
        setCashbackInputs(nextCb);
        setCoinInputs((prev) => {
          const next = { ...prev };
          json.players.forEach((p) => {
            if (!next[p.id]) next[p.id] = '500';
          });
          return next;
        });
        setBotCoinInputs((prev) => {
          const next = { ...prev };
          json.players
            .filter((p) => p.role === 'bot')
            .forEach((b) => {
              if (!next[b.id]) next[b.id] = '1000';
            });
          return next;
        });

        const nextTp: Record<string, string> = {};
        json.games.forEach((g) => {
          nextTp[g.game_key] = String(g.tournament_prize);
        });
        setTourneyPrizes(nextTp);

        const nextTblEdits: Record<string, { bet: string; minWallet: string }> = {};
        json.tables.forEach((t) => {
          nextTblEdits[t.id] = { bet: String(t.bet_amount), minWallet: String(t.min_wallet) };
        });
        setTableEdits(nextTblEdits);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [admin.id]);

  const adminFetch = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-id': admin.id,
      },
      body: body ? JSON.stringify({ ...(body as Record<string, unknown>), adminId: admin.id }) : undefined,
    });
    const json = await res.json();
    if (!res.ok) {
      showToast(json.error || 'Action failed');
      return null;
    }
    return json;
  };

  const decideTx = async (txId: string, decision: 'approved' | 'rejected') => {
    const res = await adminFetch(`/api/admin/transactions/${txId}/decide`, 'POST', { decision });
    if (res) {
      showToast(`Transaction ${decision}.`);
      fetchOverview();
    }
  };

  const toggleAllGames = async (enabled: boolean) => {
    const res = await adminFetch('/api/admin/games/toggle-all', 'POST', { enabled });
    if (res) {
      showToast(enabled ? 'All 7 games enabled.' : 'All 7 games disabled.');
      fetchOverview();
    }
  };

  const updateGame = async (g: GameSetting, patch: Partial<GameSetting>) => {
    const res = await adminFetch(`/api/admin/games/${g.game_key}`, 'PATCH', {
      is_enabled: patch.is_enabled ?? g.is_enabled,
      turn_seconds: patch.turn_seconds ?? g.turn_seconds,
      tournament_enabled: patch.tournament_enabled ?? g.tournament_enabled,
      tournament_prize: patch.tournament_prize ?? Number(tourneyPrizes[g.game_key] || g.tournament_prize),
    });
    if (res) {
      showToast(`${g.short_label} configuration saved.`);
      fetchOverview();
    }
  };

  const updateTableRow = async (
    tbl: GameTableSummary,
    patch: Partial<{ is_enabled: boolean; bet_amount: number; min_wallet: number }>
  ) => {
    const res = await adminFetch(`/api/admin/tables/${encodeURIComponent(tbl.id)}`, 'PATCH', {
      is_enabled: patch.is_enabled ?? tbl.is_enabled,
      bet_amount: patch.bet_amount ?? tbl.bet_amount,
      min_wallet: patch.min_wallet ?? tbl.min_wallet,
    });
    if (res) {
      const statusTxt =
        patch.is_enabled !== undefined
          ? patch.is_enabled
            ? 'ENABLED'
            : 'DISABLED'
          : 'UPDATED';
      showToast(`${tbl.game_key.toUpperCase()} ${tbl.variant} ${tbl.max_players}P (₱${patch.bet_amount ?? tbl.bet_amount}) ${statusTxt}.`);
      fetchOverview();
    }
  };

  const toggleFilteredTables = async (enabled: boolean) => {
    const res = await adminFetch('/api/admin/tables/toggle-group', 'POST', {
      gameKey: tableGameFilter,
      variant: tableGameFilter === 'tongits' ? tableVariantFilter : 'all',
      maxPlayers: tableGameFilter === 'tongits' ? tableSeatsFilter : 'all',
      enabled,
    });
    if (res) {
      showToast(enabled ? 'Enabled all filtered tables.' : 'Disabled all filtered tables.');
      fetchOverview();
    }
  };

  const handleCreateCustomTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/tables/create', 'POST', {
      gameKey: (tableGameFilter === 'all' ? 'tongits' : tableGameFilter) as GameKey,
      variant: newTableVariant,
      maxPlayers: newTableSeats,
      betAmount: Number(newTableBet),
      minWallet: Number(newTableMinWallet),
    });
    if (res) {
      showToast(`Created ${newTableVariant} ${newTableSeats}P Bet ₱${newTableBet} table!`);
      fetchOverview();
    }
  };

  const saveSystemConfig = async () => {
    const res = await adminFetch('/api/admin/system-config', 'PATCH', {
      weekly_reward_enabled: weeklyEnabled,
      weekly_top1_prize: Number(top1),
      weekly_top2_prize: Number(top2),
      weekly_top3_prize: Number(top3),
      ask_choy_knowledge: aiKnowledge,
    });
    if (res) {
      showToast('Ask Choy AI Brain & Weekly Reward settings saved!');
      fetchOverview();
    }
  };

  const distributeWeekly = async () => {
    const res = await adminFetch('/api/admin/distribute-weekly', 'POST', {});
    if (res) {
      showToast(`Weekly Top 3 rewards distributed to ${res.paid?.length || 0} winners!`);
      fetchOverview();
    }
  };

  const sendCashback = async (targetUserId: string, playerName: string) => {
    const amt = Number(cashbackInputs[targetUserId] || 0);
    if (!amt || amt <= 0) {
      showToast('Enter a valid cashback amount first.');
      return;
    }
    const res = await adminFetch('/api/admin/send-cashback', 'POST', {
      targetUserId,
      amount: amt,
    });
    if (res) {
      showToast(`Sent ₱${amt.toFixed(2)} cashback reward to ${playerName}!`);
      fetchOverview();
    }
  };

  const addBotWallet = async (botId: string, botName: string, amount: number, setZero = false) => {
    const res = await adminFetch('/api/admin/bot/add-wallet', 'POST', { botId, amount, setZero });
    if (res) {
      showToast(
        setZero
          ? `Reset ${botName}'s wallet to ₱0.00.`
          : amount >= 0
            ? `Added ₱${amount.toLocaleString()} coins to ${botName}.`
            : `Deducted ₱${Math.abs(amount).toLocaleString()} from ${botName}.`
      );
      fetchOverview();
    }
  };

  const updateBotWinRate = async (botId: string, winRate: number) => {
    const res = await adminFetch('/api/admin/bot/win-rate', 'POST', { botId, winRate });
    if (res) {
      showToast(`Updated bot target win rate to ${winRate}%.`);
      fetchOverview();
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/create-agent', 'POST', {
      fullName: agentName,
      phone: agentPhone,
      password: agentPassword,
      initialWallet: Number(agentWallet || 0),
    });
    if (res) {
      showToast(`Agent ${agentName} created (${res.agent?.referral_code}).`);
      setAgentName('');
      setAgentPhone('');
      setAgentWallet('0');
      fetchOverview();
    }
  };

  const adjustPlayer = async (
    targetUserId: string,
    playerName: string,
    opts: {
      vipLevel?: 1 | 2;
      addCoins?: number;
      deductCoins?: number;
      resetWallet?: boolean;
      bonusAmount?: number;
      resetCashout?: boolean;
    }
  ) => {
    const res = await adminFetch('/api/admin/player/adjust', 'POST', {
      targetUserId,
      ...opts,
    });
    if (res) {
      if (opts.resetWallet) {
        showToast(`Reset ${playerName}'s wallet to ₱0.00.`);
      } else if (opts.addCoins && opts.addCoins > 0) {
        showToast(`Added ₱${opts.addCoins.toLocaleString()} coins to ${playerName}!`);
      } else if (opts.deductCoins && opts.deductCoins > 0) {
        showToast(`Deducted ₱${opts.deductCoins.toLocaleString()} coins from ${playerName}.`);
      } else {
        showToast(`Updated ${playerName} account settings.`);
      }
      fetchOverview();
    }
  };

  const payoutTournamentWinner = async (gameKey: string, gameLabel: string) => {
    const res = await adminFetch('/api/admin/tournaments/payout', 'POST', { gameKey });
    if (res) {
      showToast(`${gameLabel} Champion ${res.winnerName} paid ₱${Number(res.prize).toLocaleString()}!`);
      fetchOverview();
    }
  };

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportTransactionsCsv = () => {
    if (!data) return;
    const header = 'ID,Player,Phone,Type,Method,Reference,Amount,Status,CreatedAt';
    const rows = data.transactions.map((t) =>
      [
        t.id,
        `"${(t.user_name || '').replace(/"/g, '""')}"`,
        t.user_phone || '',
        t.type,
        `"${(t.payment_method || '').replace(/"/g, '""')}"`,
        t.reference_no || '',
        t.amount,
        t.status,
        t.created_at,
      ].join(',')
    );
    downloadFile('choyjiez_transactions.csv', [header, ...rows].join('\n'), 'text/csv;charset=utf-8');
    showToast('Exported choyjiez_transactions.csv');
  };

  const exportPlayersCsv = () => {
    if (!data) return;
    const header = 'Name,Phone,Role,VIP,Wallet,TotalCashIn,TotalBet,Wins,Losses,PendingCashback,ReferralCode';
    const rows = data.players.map((p) =>
      [
        `"${p.full_name.replace(/"/g, '""')}"`,
        p.phone,
        p.role,
        p.vip_level,
        p.wallet_balance,
        p.total_cash_in,
        p.total_bet,
        p.total_wins,
        p.total_losses,
        p.pending_cashback,
        p.referral_code,
      ].join(',')
    );
    downloadFile('choyjiez_players.csv', [header, ...rows].join('\n'), 'text/csv;charset=utf-8');
    showToast('Exported choyjiez_players.csv');
  };

  const exportSupabaseSql = async () => {
    const res = await fetch(`/api/admin/export-sql?adminId=${encodeURIComponent(admin.id)}`, {
      headers: { 'x-admin-id': admin.id },
    });
    if (!res.ok) {
      showToast('Failed to export Supabase SQL.');
      return;
    }
    const sqlText = await res.text();
    downloadFile('choyjiez_supabase_schema.sql', sqlText, 'text/sql;charset=utf-8');
    showToast('Downloaded choyjiez_supabase_schema.sql!');
  };

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-emerald-300">
        Loading Super Admin Control Panel...
      </div>
    );
  }

  if (!data) return null;

  const pendingTxs = data.transactions.filter((t) => t.status === 'pending');
  const bots = data.players.filter((p) => p.role === 'bot');
  const filteredPlayers = data.players.filter((p) => {
    if (vipFilter === 'all') return true;
    if (vipFilter === 'agent' || vipFilter === 'bot' || vipFilter === 'admin') return p.role === vipFilter;
    return String(p.vip_level) === vipFilter;
  });

  const maxAnalyticsVolume = Math.max(100, ...data.analytics.map((a) => a.pot_volume));

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 space-y-6">
      {/* Header Control Strip */}
      <section className="rounded-3xl border border-amber-400/40 bg-[#052920] p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-emerald-950">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white">
                Super Admin Control Panel
              </h1>
              <p className="text-xs text-emerald-300 font-mono-num">
                {admin.full_name} · {admin.phone} · Full Game, Coins, Cashback, Bot & Ask Choy AI Control
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isInsideStudioPreview && (
              <button
                type="button"
                onClick={() => setSecretStudioOpen(true)}
                title="Secret Admin Builder Studio (PIN Protected)"
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/70 bg-amber-400/15 px-3 py-2 text-xs font-extrabold text-amber-200 hover:bg-amber-400 hover:text-emerald-950 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Secret Studio</span>
              </button>
            )}
            <button
              type="button"
              disabled={clearingCache}
              onClick={async () => {
                setClearingCache(true);
                await clearAppCacheAndReload();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-[#031c16] px-3.5 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/15 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${clearingCache ? 'animate-spin' : ''}`} />
              {clearingCache ? 'Clearing...' : 'Clear Cache'}
            </button>
            <button
              type="button"
              onClick={fetchOverview}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700 bg-[#031c16] px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:border-amber-400 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={onPreviewLobby}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Gamepad2 className="h-4 w-4" />
              Enter Game Lobby
            </button>
          </div>
        </div>

        {toast && (
          <div className="mt-4 rounded-xl border border-amber-400/50 bg-amber-950/50 px-4 py-2.5 text-xs font-semibold text-amber-200">
            {toast}
          </div>
        )}

        {/* Section Tabs */}
        <div className="mt-5 flex items-center gap-1.5 overflow-x-auto border-t border-emerald-800/70 pt-4">
          {[
            { id: 'overview' as AdminSection, label: 'Analytics & Milestones', icon: BarChart3 },
            { id: 'approvals' as AdminSection, label: `Cash-In / Out Counter (${pendingTxs.length})`, icon: Coins },
            { id: 'games' as AdminSection, label: 'Games & Table Setup', icon: Gamepad2 },
            { id: 'players' as AdminSection, label: 'VIP Players & Cashback', icon: Users },
            { id: 'bots' as AdminSection, label: '80% Bots & Agents', icon: Bot },
            { id: 'ai_rewards' as AdminSection, label: 'Ask Choy AI & Weekly Prizes', icon: Brain },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  section === tab.id
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

      {/* 4 Financial KPI Counters (Always Visible) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-800/80 bg-[#052920] p-4">
          <span className="text-xs text-emerald-300 block">Counter Cash-In (Approved)</span>
          <strong className="mt-1 block font-mono-num text-2xl font-extrabold text-emerald-300">
            ₱{data.kpis.totalCashIn.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="rounded-2xl border border-emerald-800/80 bg-[#052920] p-4">
          <span className="text-xs text-emerald-300 block">Counter Cash-Out (Released)</span>
          <strong className="mt-1 block font-mono-num text-2xl font-extrabold text-amber-300">
            ₱{data.kpis.totalCashOut.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="rounded-2xl border border-emerald-800/80 bg-[#052920] p-4">
          <span className="text-xs text-emerald-300 block">Auto-Rake Collected</span>
          <strong className="mt-1 block font-mono-num text-2xl font-extrabold text-sky-300">
            ₱{data.kpis.totalRake.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="rounded-2xl border border-emerald-800/80 bg-[#052920] p-4">
          <span className="text-xs text-emerald-300 block">Pending Requests · Bots</span>
          <strong className="mt-1 block font-mono-num text-2xl font-extrabold text-white">
            {data.kpis.pendingCount} Pending · {data.kpis.activeBots} Bots
          </strong>
        </div>
      </section>

      {/* ==================== SECTION 1: ANALYTICS & MILESTONES ==================== */}
      {section === 'overview' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Database className="h-5 w-5 text-amber-400" />
              <div>
                <h2 className="font-display text-sm font-bold text-white">Supabase Schema & Accounting Reports Export</h2>
                <p className="text-xs text-emerald-300">Download live PostgreSQL/Supabase migration SQL or CSV ledgers in one click.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportSupabaseSql}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                Supabase SQL
              </button>
              <button
                type="button"
                onClick={exportTransactionsCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700 bg-[#031c16] px-3.5 py-2 text-xs font-bold text-emerald-100 hover:border-amber-400 cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                Transactions CSV
              </button>
              <button
                type="button"
                onClick={exportPlayersCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700 bg-[#031c16] px-3.5 py-2 text-xs font-bold text-emerald-100 hover:border-amber-400 cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                Players CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-white mb-4">Game Volume & Rake Analytics</h2>
            <div className="space-y-3.5">
              {data.analytics.map((row) => {
                const widthPct = Math.max(6, Math.round((row.pot_volume / maxAnalyticsVolume) * 100));
                return (
                  <div key={row.game_key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{row.game_name}</span>
                      <span className="font-mono-num text-emerald-200">
                        {row.hands_played} hands · Pot ₱{row.pot_volume.toLocaleString()} · Rake ₱{row.rake_earned.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-[#031c16] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-white mb-4">Recent Table Milestones</h2>
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {data.tables
                .filter((t) => t.milestone_log.length > 0)
                .slice(0, 8)
                .map((tbl) => (
                  <div key={tbl.id} className="rounded-2xl border border-emerald-800/80 bg-[#031c16] p-3 text-xs">
                    <div className="flex justify-between font-bold text-amber-300">
                      <span className="uppercase">{tbl.game_key} · Bet ₱{tbl.bet_amount}</span>
                      <span className="font-mono-num text-emerald-300">{tbl.hands_played} hands</span>
                    </div>
                    <p className="mt-1 text-white font-medium">{tbl.milestone_log[0]?.label}</p>
                    <p className="text-[11px] text-emerald-300 mt-0.5">{tbl.milestone_log[0]?.detail}</p>
                  </div>
                ))}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ==================== SECTION 2: CASH-IN / CASH-OUT COUNTER ==================== */}
      {section === 'approvals' && (
        <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg font-bold text-white">Cash-In & Cash-Out Approval Counter</h2>
            <p className="text-xs text-emerald-300">
              Verify GCash / Maya / Intuit Terminal references before crediting or releasing funds.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-emerald-800 text-xs text-emerald-300">
                  <th className="py-3 pr-3">Player</th>
                  <th className="py-3 px-3">Type · Method</th>
                  <th className="py-3 px-3">Sender / Receiver · Ref</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-800/60">
                {data.transactions.slice(0, 30).map((tx) => (
                  <tr key={tx.id} className="hover:bg-emerald-900/20">
                    <td className="py-3 pr-3">
                      <span className="font-semibold text-white block">{tx.user_name}</span>
                      <span className="font-mono-num text-[11px] text-emerald-400">{tx.user_phone}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold capitalize text-amber-300 block">{tx.type.replace('_', ' ')}</span>
                      <span className="text-[11px] text-emerald-300">{tx.payment_method}</span>
                    </td>
                    <td className="py-3 px-3 text-xs text-emerald-200 max-w-[240px]">
                      <span className="block truncate">{tx.sender_details}</span>
                      <span className="font-mono-num text-[11px] text-emerald-400">Ref: {tx.reference_no || '—'}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num font-bold text-white">
                      ₱{tx.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-xs font-semibold capitalize">
                      <span
                        className={
                          tx.status === 'pending'
                            ? 'text-amber-300'
                            : tx.status === 'approved' || tx.status === 'completed'
                              ? 'text-emerald-300'
                              : 'text-red-300'
                        }
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {tx.status === 'pending' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => decideTx(tx.id, 'approved')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-300 cursor-pointer whitespace-nowrap"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => decideTx(tx.id, 'rejected')}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-red-500 cursor-pointer whitespace-nowrap"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-500">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ==================== SECTION 3: GAMES & TOURNAMENT SETUP ==================== */}
      {section === 'games' && (
        <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-white">All Games & Tournament Setup</h2>
              <p className="text-xs text-emerald-300">
                Enable or disable individual games, toggle all games at once, and configure tournament prize pools.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAllGames(true)}
                className="rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 whitespace-nowrap cursor-pointer"
              >
                Enable All Games
              </button>
              <button
                type="button"
                onClick={() => toggleAllGames(false)}
                className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-red-500 whitespace-nowrap cursor-pointer"
              >
                Disable All Games
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {data.games.map((g) => (
              <div
                key={g.game_key}
                className="rounded-2xl border border-emerald-800/90 bg-[#031c16] p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">{g.game_name}</h3>
                    <p className="text-[11px] font-mono-num text-emerald-300">
                      Timer: {g.turn_seconds >= 60 ? `${g.turn_seconds / 60} mins` : `${g.turn_seconds}s`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateGame(g, { is_enabled: !g.is_enabled })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      g.is_enabled
                        ? 'bg-emerald-400 text-emerald-950'
                        : COMING_SOON_SLOT_KEYS.includes(g.game_key as SlotGameKey)
                          ? 'bg-amber-500/25 border border-amber-400/60 text-amber-200 hover:bg-amber-400 hover:text-emerald-950'
                          : 'bg-red-900/80 text-red-200'
                    }`}
                  >
                    {g.is_enabled
                      ? 'Enabled'
                      : COMING_SOON_SLOT_KEYS.includes(g.game_key as SlotGameKey)
                        ? 'Coming Soon · Launch'
                        : 'Disabled'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-emerald-800/70 pt-3">
                  <button
                    type="button"
                    onClick={() => updateGame(g, { tournament_enabled: !g.tournament_enabled })}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
                      g.tournament_enabled
                        ? 'bg-amber-400 text-emerald-950'
                        : 'border border-emerald-700 text-emerald-300'
                    }`}
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    {g.tournament_enabled ? 'Tourney ON' : 'Tourney OFF'}
                  </button>
                  <input
                    type="number"
                    value={tourneyPrizes[g.game_key] ?? String(g.tournament_prize)}
                    onChange={(e) =>
                      setTourneyPrizes((prev) => ({ ...prev, [g.game_key]: e.target.value }))
                    }
                    className="w-28 rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-1.5 text-xs font-mono-num text-white focus:border-amber-400 focus:outline-none"
                    placeholder="Prize ₱"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateGame(g, { tournament_prize: Number(tourneyPrizes[g.game_key] || 0) })
                    }
                    className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
                  >
                    Set Prize
                  </button>
                  {g.tournament_enabled && (
                    <button
                      type="button"
                      onClick={() => payoutTournamentWinner(g.game_key, g.short_label)}
                      className="rounded-lg border border-amber-400/60 bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/25 cursor-pointer whitespace-nowrap"
                    >
                      Payout #1 Champ
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ==================== PER-TABLE SETUP: TONG-ITS 2P/3P REGULAR/BUTASAN/JOKER & BETTING PRICES ==================== */}
          <div className="border-t border-emerald-800/80 pt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-amber-300">
                  Tong-its & Card Tables Setup (Enable / Disable Per Table)
                </h3>
                <p className="text-xs text-emerald-300">
                  Configure 2P & 3P tables for Regular, Butasan, and With Joker with custom betting prices and instant per-table Enable/Disable.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleFilteredTables(true)}
                  className="rounded-xl bg-emerald-400 px-3 py-1.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 cursor-pointer whitespace-nowrap"
                >
                  Enable Filtered
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilteredTables(false)}
                  className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-red-500 cursor-pointer whitespace-nowrap"
                >
                  Disable Filtered
                </button>
              </div>
            </div>

            {/* Filters: Game · Mode (Regular/Butasan/Joker) · Seats (2P/3P) */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-800/80 bg-[#031c16] p-3">
              <select
                value={tableGameFilter}
                onChange={(e) => {
                  setTableGameFilter(e.target.value);
                  setTableVariantFilter('all');
                  setTableSeatsFilter('all');
                }}
                className="rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-1.5 text-xs font-bold text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="tongits">Tong-its (2P/3P Modes)</option>
                <option value="pusoy">Pusoy Tables</option>
                <option value="lucky9">Lucky 9 Tables</option>
                <option value="poker">Texas Poker Tables</option>
                <option value="betgame">Bet Game Tables</option>
                <option value="colorgame">Color Game Tables</option>
                <option value="tsekitsa">Tsekitsa Tables</option>
              </select>

              {tableGameFilter === 'tongits' && (
                <>
                  <div className="flex items-center gap-1 rounded-lg bg-[#052920] p-1 border border-emerald-800">
                    {(['all', 'Regular', 'Butasan', 'Joker'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setTableVariantFilter(v)}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold cursor-pointer whitespace-nowrap ${
                          tableVariantFilter === v
                            ? 'bg-amber-400 text-emerald-950'
                            : 'text-emerald-200 hover:text-white'
                        }`}
                      >
                        {v === 'all' ? 'All Modes' : v === 'Joker' ? 'With Joker' : v}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 rounded-lg bg-[#052920] p-1 border border-emerald-800">
                    {(['all', '2', '3'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setTableSeatsFilter(sz)}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold cursor-pointer whitespace-nowrap ${
                          tableSeatsFilter === sz
                            ? 'bg-emerald-400 text-emerald-950'
                            : 'text-emerald-200 hover:text-white'
                        }`}
                      >
                        {sz === 'all' ? '2P & 3P' : `${sz}P`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Per-Table Grid with Betting Price + Min Wallet + Enable/Disable Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              {data.tables
                .filter((t) => {
                  if (t.game_key !== tableGameFilter) return false;
                  if (tableGameFilter === 'tongits') {
                    if (tableVariantFilter !== 'all' && t.variant !== tableVariantFilter) return false;
                    if (tableSeatsFilter !== 'all' && String(t.max_players) !== tableSeatsFilter) return false;
                  }
                  return true;
                })
                .map((tbl) => {
                  const edit = tableEdits[tbl.id] || {
                    bet: String(tbl.bet_amount),
                    minWallet: String(tbl.min_wallet),
                  };
                  return (
                    <div
                      key={tbl.id}
                      className={`rounded-2xl border p-3 space-y-2.5 transition-colors ${
                        tbl.is_enabled
                          ? 'border-emerald-700/90 bg-[#031c16]'
                          : 'border-red-900/70 bg-[#190a0a]/60 opacity-85'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-display text-xs font-extrabold text-white block">
                            {tbl.game_key === 'tongits'
                              ? `${tbl.variant === 'Joker' ? 'With Joker' : tbl.variant} · ${tbl.max_players}P`
                              : `${tbl.game_key.toUpperCase()} · ${tbl.max_players}P`}
                          </span>
                          <span className="font-mono-num text-[11px] text-emerald-300">
                            Bet ₱{tbl.bet_amount} · Min ₱{tbl.min_wallet} · {tbl.active_players}/{tbl.max_players} Seated
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateTableRow(tbl, { is_enabled: !tbl.is_enabled })}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                            tbl.is_enabled
                              ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                              : 'bg-red-600 text-white hover:bg-red-500'
                          }`}
                        >
                          {tbl.is_enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 border-t border-emerald-800/60 pt-2">
                        <label className="text-[10px] text-emerald-300">Bet ₱</label>
                        <input
                          type="number"
                          min={0.5}
                          step="0.5"
                          value={edit.bet}
                          onChange={(e) =>
                            setTableEdits((prev) => ({
                              ...prev,
                              [tbl.id]: { ...edit, bet: e.target.value },
                            }))
                          }
                          className="w-16 rounded-lg border border-emerald-700 bg-[#052920] px-2 py-1 text-xs font-mono-num text-white focus:border-amber-400 focus:outline-none"
                        />
                        <label className="text-[10px] text-emerald-300">Min ₱</label>
                        <input
                          type="number"
                          min={1}
                          step="10"
                          value={edit.minWallet}
                          onChange={(e) =>
                            setTableEdits((prev) => ({
                              ...prev,
                              [tbl.id]: { ...edit, minWallet: e.target.value },
                            }))
                          }
                          className="w-20 rounded-lg border border-emerald-700 bg-[#052920] px-2 py-1 text-xs font-mono-num text-white focus:border-amber-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateTableRow(tbl, {
                              bet_amount: Number(edit.bet || tbl.bet_amount),
                              min_wallet: Number(edit.minWallet || tbl.min_wallet),
                            })
                          }
                          className="ml-auto rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Add Custom Table Row */}
            <form
              onSubmit={handleCreateCustomTable}
              className="flex flex-wrap items-end gap-2 rounded-2xl border border-amber-400/35 bg-[#031c16] p-3"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-amber-300">Add Custom Table Mode</label>
                <select
                  value={newTableVariant}
                  onChange={(e) => setNewTableVariant(e.target.value as TongitsVariant)}
                  className="rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="Regular">Regular</option>
                  <option value="Butasan">Butasan</option>
                  <option value="Joker">With Joker</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-emerald-300">Seats</label>
                <select
                  value={newTableSeats}
                  onChange={(e) => setNewTableSeats(Number(e.target.value) === 2 ? 2 : 3)}
                  className="rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-1.5 text-xs text-white"
                >
                  <option value={2}>2P Table</option>
                  <option value={3}>3P Table</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-emerald-300">Bet Price (₱)</label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  required
                  value={newTableBet}
                  onChange={(e) => setNewTableBet(e.target.value)}
                  className="w-24 rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-1.5 text-xs font-mono-num text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-emerald-300">Min Wallet (₱)</label>
                <input
                  type="number"
                  min={10}
                  step="10"
                  required
                  value={newTableMinWallet}
                  onChange={(e) => setNewTableMinWallet(e.target.value)}
                  className="w-28 rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-1.5 text-xs font-mono-num text-white"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Table
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ==================== SECTION 4: VIP PLAYERS, ADD COINS & CASHBACK SENDER ==================== */}
      {section === 'players' && (
        <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Players Wallet, Add Coins & Cashback Desk</h2>
              <p className="text-xs text-emerald-300">
                Built-in players start at ₱0. Add or deduct custom coins for any player, built-in player, or Admin account anytime.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#031c16] p-1 border border-emerald-800">
              {[
                { id: 'all' as const, label: 'All' },
                { id: '2' as const, label: 'VIP 2' },
                { id: '1' as const, label: 'VIP 1' },
                { id: 'agent' as const, label: 'Agents' },
                { id: 'bot' as const, label: 'Built-in' },
                { id: 'admin' as const, label: 'Admin' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setVipFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
                    vipFilter === f.id ? 'bg-amber-400 text-emerald-950' : 'text-emerald-300 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-emerald-800 text-xs text-emerald-300">
                  <th className="py-3 pr-3">Player</th>
                  <th className="py-3 px-3">VIP · Role</th>
                  <th className="py-3 px-3 text-right">Wallet</th>
                  <th className="py-3 px-3">Admin Add / Deduct Coins</th>
                  <th className="py-3 px-3 text-right">Wins / Losses (₱)</th>
                  <th className="py-3 pl-3 text-right">Cashback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-800/60">
                {filteredPlayers.map((p) => (
                  <tr key={p.id} className="hover:bg-emerald-900/20">
                    <td className="py-3 pr-3">
                      <span className="font-bold text-white block">{p.full_name}</span>
                      <span className="font-mono-num text-[11px] text-emerald-400">{p.phone} · {p.referral_code}</span>
                    </td>
                    <td className="py-3 px-3 text-xs font-bold text-amber-300 capitalize">
                      <div>VIP {p.vip_level} · {p.role}</div>
                      {p.role !== 'admin' && (
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              adjustPlayer(p.id, p.full_name, { vipLevel: p.vip_level === 2 ? 1 : 2 })
                            }
                            className="rounded border border-emerald-700 bg-[#031c16] px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 hover:border-amber-400 cursor-pointer"
                          >
                            Set VIP {p.vip_level === 2 ? '1' : '2'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num font-bold text-white whitespace-nowrap">
                      ₱{p.wallet_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          step="1"
                          value={coinInputs[p.id] ?? '500'}
                          onChange={(e) =>
                            setCoinInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="w-20 rounded-lg border border-emerald-700 bg-[#031c16] px-2 py-1 text-xs font-mono-num text-white focus:border-amber-400 focus:outline-none"
                          placeholder="₱"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const amt = Number(coinInputs[p.id] || 0);
                            if (amt > 0) adjustPlayer(p.id, p.full_name, { addCoins: amt });
                          }}
                          className="inline-flex items-center gap-0.5 rounded-lg bg-amber-400 px-2 py-1 text-[11px] font-extrabold text-emerald-950 hover:bg-amber-300 whitespace-nowrap cursor-pointer"
                          title="Add coins to player wallet"
                        >
                          <Plus className="h-3 w-3" />
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const amt = Number(coinInputs[p.id] || 0);
                            if (amt > 0) adjustPlayer(p.id, p.full_name, { deductCoins: amt });
                          }}
                          className="inline-flex items-center gap-0.5 rounded-lg border border-red-400/50 bg-red-950/60 px-2 py-1 text-[11px] font-bold text-red-200 hover:bg-red-900/70 whitespace-nowrap cursor-pointer"
                          title="Deduct coins from player wallet"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustPlayer(p.id, p.full_name, { resetWallet: true })}
                          className="rounded-lg border border-emerald-700 bg-[#031c16] px-1.5 py-1 text-[10px] font-bold text-emerald-300 hover:border-red-400 hover:text-red-200 whitespace-nowrap cursor-pointer"
                          title="Reset wallet to ₱0"
                        >
                          ₱0
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-xs whitespace-nowrap">
                      <span className="text-emerald-300">+{p.games_won}W (₱{p.total_wins.toLocaleString()})</span>
                      <span className="block text-red-300">-{p.games_lost}L (₱{p.total_losses.toLocaleString()})</span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          step="0.5"
                          value={cashbackInputs[p.id] ?? ''}
                          onChange={(e) =>
                            setCashbackInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="w-16 rounded-lg border border-emerald-700 bg-[#031c16] px-2 py-1 text-xs font-mono-num text-white focus:border-amber-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => sendCashback(p.id, p.full_name)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2 py-1 text-xs font-bold text-emerald-950 hover:bg-emerald-300 whitespace-nowrap cursor-pointer"
                        >
                          <Send className="h-3 w-3" />
                          Send
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ==================== SECTION 5: BUILT-IN PLAYERS & CREATE AGENT ==================== */}
      {section === 'bots' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Built-in Players Wallet & Win-Rate Monitor</h2>
              <p className="text-xs text-emerald-300">
                Built-in players start at ₱0.00. Only Admin can add, deduct, or reset their coins.
              </p>
            </div>

            <div className="space-y-3.5">
              {bots.map((bot) => {
                const totalGames = bot.games_won + bot.games_lost;
                const actualPct = totalGames > 0 ? Math.round((bot.games_won / totalGames) * 100) : bot.bot_win_rate;
                return (
                  <div key={bot.id} className="rounded-2xl border border-emerald-800 bg-[#031c16] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-bold text-amber-300">{bot.full_name}</h3>
                        <p className="text-xs font-mono-num text-emerald-300">
                          VIP {bot.vip_level} · {bot.phone} · Record: {bot.games_won}W / {bot.games_lost}L ({actualPct}% Win)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-emerald-400 block">Built-in Wallet</span>
                        <strong className="font-mono-num text-lg text-white">
                          ₱{bot.wallet_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-800/70 pt-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-emerald-300">Target Win Rate:</span>
                        <select
                          value={bot.bot_win_rate}
                          onChange={(e) => updateBotWinRate(bot.id, Number(e.target.value))}
                          className="rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-1 font-mono-num text-white"
                        >
                          <option value={65}>65%</option>
                          <option value={75}>75%</option>
                          <option value={80}>80% (Default)</option>
                          <option value={85}>85%</option>
                          <option value={90}>90%</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          step="1"
                          value={botCoinInputs[bot.id] ?? '1000'}
                          onChange={(e) =>
                            setBotCoinInputs((prev) => ({ ...prev, [bot.id]: e.target.value }))
                          }
                          className="w-24 rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-1.5 text-xs font-mono-num text-white focus:border-amber-400 focus:outline-none"
                          placeholder="Amount ₱"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const amt = Number(botCoinInputs[bot.id] || 0);
                            if (amt > 0) addBotWallet(bot.id, bot.full_name, amt);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Coins
                        </button>
                        <button
                          type="button"
                          onClick={() => addBotWallet(bot.id, bot.full_name, 0, true)}
                          className="rounded-lg border border-red-400/50 bg-red-950/60 px-2.5 py-1.5 text-xs font-bold text-red-200 hover:bg-red-900/70 cursor-pointer whitespace-nowrap"
                        >
                          Reset ₱0
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Create Agent Form */}
          <form
            onSubmit={handleCreateAgent}
            className="lg:col-span-5 rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-400" />
              <h2 className="font-display text-lg font-bold text-white">Create Agent Account</h2>
            </div>
            <p className="text-xs text-emerald-300">
              Agents start at ₱0 by default. Admin can optionally enter starting coins below or add them anytime.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-emerald-200 mb-1">Agent Full Name</label>
                <input
                  type="text"
                  required
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Enter agent full name"
                  className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-emerald-200 mb-1">Mobile Number</label>
                <input
                  type="text"
                  required
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                  placeholder="09XXXXXXXXX"
                  className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2.5 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-emerald-200 mb-1">Password</label>
                  <input
                    type="text"
                    required
                    value={agentPassword}
                    onChange={(e) => setAgentPassword(e.target.value)}
                    className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2.5 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-emerald-200 mb-1">Initial Wallet (₱)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={agentWallet}
                    onChange={(e) => setAgentWallet(e.target.value)}
                    className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2.5 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-400 py-3 text-sm font-extrabold text-emerald-950 hover:bg-amber-300 transition-colors cursor-pointer"
            >
              Create Agent Account
            </button>
          </form>
        </div>
      )}

      {/* ==================== SECTION 6: ASK CHOY AI BRAIN & WEEKLY REWARDS ==================== */}
      {section === 'ai_rewards' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Ask Choy AI Knowledge Box */}
          <div className="lg:col-span-7 rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-amber-400" />
              <h2 className="font-display text-lg font-bold text-white">Ask Choy AI Brain Knowledge Box</h2>
            </div>
            <p className="text-xs text-emerald-300 leading-relaxed">
              Ang bisan unsang nakasulat sulod aning box mao ray gamiton nga brain ni <strong>Ask Choy AI</strong> sa pre-login screen, player dashboard, ug sulod sa game table.
            </p>

            <textarea
              rows={8}
              value={aiKnowledge}
              onChange={(e) => setAiKnowledge(e.target.value)}
              className="w-full rounded-2xl border border-emerald-700 bg-[#031c16] p-4 text-sm text-white leading-relaxed focus:border-amber-400 focus:outline-none"
            />

            <button
              type="button"
              onClick={saveSystemConfig}
              className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-extrabold text-emerald-950 hover:bg-amber-300 transition-colors cursor-pointer"
            >
              Save Ask Choy AI Brain
            </button>
          </div>

          {/* Weekly Top 3 Rewards Prize Setup */}
          <div className="lg:col-span-5 rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-4 h-fit">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                <h2 className="font-display text-lg font-bold text-white">Weekly Top 3 Prizes</h2>
              </div>
              <button
                type="button"
                onClick={() => setWeeklyEnabled((v) => !v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  weeklyEnabled ? 'bg-emerald-400 text-emerald-950' : 'bg-red-900 text-red-200'
                }`}
              >
                {weeklyEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-emerald-200 mb-1">Top 1 Weekly Prize (₱)</label>
                <input
                  type="number"
                  value={top1}
                  onChange={(e) => setTop1(Number(e.target.value))}
                  className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-emerald-200 mb-1">Top 2 Weekly Prize (₱)</label>
                <input
                  type="number"
                  value={top2}
                  onChange={(e) => setTop2(Number(e.target.value))}
                  className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-emerald-200 mb-1">Top 3 Weekly Prize (₱)</label>
                <input
                  type="number"
                  value={top3}
                  onChange={(e) => setTop3(Number(e.target.value))}
                  className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={saveSystemConfig}
                className="rounded-xl bg-amber-400 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer"
              >
                Save Prizes
              </button>
              <button
                type="button"
                onClick={distributeWeekly}
                className="rounded-xl bg-emerald-500 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-400 cursor-pointer"
              >
                Distribute Top 3 Now
              </button>
            </div>
          </div>
        </div>
      )}
      {secretStudioOpen && (
        <AdminSecretStudio admin={admin} onClose={() => setSecretStudioOpen(false)} />
      )}
    </div>
  );
};
