import React, { useEffect, useMemo, useState } from 'react';
import { Coins, CreditCard, ExternalLink, Lock, MapPin, ShieldCheck, Users, Wallet, X } from 'lucide-react';
import type { BetTier, GameSetting, GameTableSummary, TongitsVariant, UserProfile } from '../types';
import { BET_TIERS, VIP_RULES } from '../types';
import { GAME_ART_MAP } from '../lib/gameImages';

interface CashInModalProps {
  user: UserProfile;
  onClose: () => void;
  onSubmitted: () => void;
}

export const CashInModal: React.FC<CashInModalProps> = ({ user, onClose, onSubmitted }) => {
  const [senderDetails, setSenderDetails] = useState(`${user.full_name} (${user.phone})`);
  const [paymentMethod, setPaymentMethod] = useState('GCash');
  const [amount, setAmount] = useState('500');
  const [referenceNo, setReferenceNo] = useState('');
  const [intuitStep, setIntuitStep] = useState<'idle' | 'processing' | 'ready'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleIntuitTerminal = () => {
    setPaymentMethod('Intuit Terminal');
    setIntuitStep('processing');
    setTimeout(() => {
      const ref = `INT-${Date.now().toString().slice(-7)}`;
      setReferenceNo(ref);
      setIntuitStep('ready');
    }, 850);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/player/cash-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          senderDetails,
          receiverDetails: 'ChoyJiez Official (09361223978)',
          paymentMethod,
          amount: Number(amount),
          referenceNo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit Cash-In request.');
      } else {
        setSuccess('Cash-In submitted! Waiting for Admin Choy verification & approval.');
        onSubmitted();
        setTimeout(onClose, 1400);
      }
    } catch {
      setError('Network error submitting Cash-In.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-emerald-700/80 bg-[#052920] p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-amber-400" />
            <h3 className="font-display text-lg font-bold text-white">Cash In Wallet</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Cash In modal"
            className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-900 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Direct GCash Launch + Intuit Payment Terminal */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <a
            href="gcash://com.globe.gcash.android"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#007dfe] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#006be0] transition-colors whitespace-nowrap"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open GCash App
          </a>
          <button
            type="button"
            onClick={handleIntuitTerminal}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-900/70 px-3 py-2.5 text-xs font-bold text-emerald-100 hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            {intuitStep === 'processing' ? 'Generating Terminal...' : 'Intuit Terminal'}
          </button>
        </div>

        {intuitStep === 'ready' && (
          <p className="mt-2.5 rounded-xl bg-emerald-950/90 border border-emerald-700 px-3 py-2 text-xs text-emerald-200">
            Intuit Payment Terminal session ready. Reference <strong className="font-mono-num text-amber-300">{referenceNo}</strong> auto-filled below.
          </p>
        )}

        <div className="my-4 flex items-center gap-3 text-[11px] text-emerald-400">
          <div className="h-px flex-1 bg-emerald-800" />
          <span>Payment Receipt Form (Admin Approval)</span>
          <div className="h-px flex-1 bg-emerald-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-emerald-200 mb-1">Sender Name & Number</label>
            <input
              type="text"
              required
              value={senderDetails}
              onChange={(e) => setSenderDetails(e.target.value)}
              placeholder="Sender Full Name (09XXXXXXXXX)"
              className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16] px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-emerald-200 mb-1">Official Receiver</label>
            <input
              type="text"
              readOnly
              value="ChoyJiez Official (09361223978)"
              className="w-full rounded-xl border border-emerald-800 bg-[#031c16]/70 px-3 py-2.5 text-sm text-amber-300 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-emerald-200 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16] px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="GCash">GCash E-Wallet</option>
                <option value="Intuit Terminal">Intuit Payment Terminal</option>
                <option value="Maya">Maya</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-emerald-200 mb-1">Amount (Min ₱100)</label>
              <input
                type="number"
                min={100}
                step="10"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16] px-3 py-2.5 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-emerald-200 mb-1">Reference Number</label>
            <input
              type="text"
              required
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Enter GCash / Maya / Intuit Ref No."
              className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16] px-3 py-2.5 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          {error && <p className="rounded-lg bg-red-950/90 border border-red-700/80 px-3 py-2 text-xs text-red-200">{error}</p>}
          {success && <p className="rounded-lg bg-emerald-900/90 border border-emerald-500/80 px-3 py-2 text-xs text-emerald-100">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-emerald-950 hover:bg-amber-300 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? 'Submitting Request...' : 'Submit for Admin Approval'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface CashOutModalProps {
  user: UserProfile;
  onClose: () => void;
  onSubmitted: () => void;
}

export const CashOutModal: React.FC<CashOutModalProps> = ({ user, onClose, onSubmitted }) => {
  const vip = user.vip_level >= 2 ? VIP_RULES[2] : VIP_RULES[1];
  const [amount, setAmount] = useState(String(Math.min(500, vip.maxCashoutAmount)));
  const [paymentMethod, setPaymentMethod] = useState('GCash');
  const [receiverDetails, setReceiverDetails] = useState(`${user.full_name} (${user.phone})`);
  const [withdrawalPin, setWithdrawalPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/player/cash-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: Number(amount),
          withdrawalPin,
          paymentMethod,
          receiverDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Cash-Out failed.');
      } else {
        setSuccess('Cash-Out request submitted! Funds reserved for e-wallet release.');
        onSubmitted();
        setTimeout(onClose, 1400);
      }
    } catch {
      setError('Network error submitting Cash-Out.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-emerald-700/80 bg-[#052920] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-400" />
            <h3 className="font-display text-lg font-bold text-white">E-Wallet Cash Out</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Cash Out modal"
            className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-900 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-y border-emerald-800/80 py-2.5 text-xs text-emerald-200">
          <span>
            {vip.name} Limit · Max <strong className="font-mono-num text-amber-300">₱{vip.maxCashoutAmount.toLocaleString()}</strong> · {vip.dailyCashoutLimit}x/day
          </span>
          <span className="font-mono-num text-white">
            Balance: ₱{user.wallet_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-emerald-200 mb-1">E-Wallet</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16] px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="GCash">GCash</option>
                <option value="Maya">Maya</option>
                <option value="Intuit Payout">Intuit Payout</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-emerald-200 mb-1">Amount (₱)</label>
              <input
                type="number"
                min={100}
                max={vip.maxCashoutAmount}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16] px-3 py-2.5 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-emerald-200 mb-1">Receiver E-Wallet Account</label>
            <input
              type="text"
              required
              value={receiverDetails}
              onChange={(e) => setReceiverDetails(e.target.value)}
              className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16] px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-emerald-200 mb-1">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              4-Digit Withdrawal PIN (Default: 1234)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              value={withdrawalPin}
              onChange={(e) => setWithdrawalPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16] px-3 py-2.5 text-sm font-mono-num tracking-[0.4em] text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          {error && <p className="rounded-lg bg-red-950/90 border border-red-700/80 px-3 py-2 text-xs text-red-200">{error}</p>}
          {success && <p className="rounded-lg bg-emerald-900/90 border border-emerald-500/80 px-3 py-2 text-xs text-emerald-100">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-emerald-400 py-3 text-sm font-bold text-emerald-950 hover:bg-emerald-300 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? 'Verifying PIN...' : 'Confirm Cash Out'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface TableBuyInModalProps {
  user: UserProfile;
  game: GameSetting;
  tables: GameTableSummary[];
  gpsLabel: string;
  onClose: () => void;
  onOpenCashIn: () => void;
  onConfirm: (
    tier: BetTier,
    variant: TongitsVariant,
    maxPlayers: number,
    bringInAmount: number,
    tableId?: string
  ) => Promise<string | null>;
}

const TONGITS_VARIANTS: Array<{ id: TongitsVariant; label: string; desc: string }> = [
  { id: 'Regular', label: 'Regular', desc: 'Classic 12/13-card Tong-its' },
  { id: 'Butasan', label: 'Butasan', desc: 'Bonus break & double pot' },
  { id: 'Joker', label: 'With Joker', desc: 'Wild Joker melds active' },
];

export const TableBuyInModal: React.FC<TableBuyInModalProps> = ({
  user,
  game,
  tables,
  gpsLabel,
  onClose,
  onOpenCashIn,
  onConfirm,
}) => {
  const isTongits = game.game_key === 'tongits';

  const [selectedVariant, setSelectedVariant] = useState<TongitsVariant>('Regular');
  const [selectedMaxPlayers, setSelectedMaxPlayers] = useState<2 | 3>(3);

  // Live tables for this game from Admin Dashboard setup
  const gameTables = useMemo(
    () => tables.filter((t) => t.game_key === game.game_key),
    [tables, game.game_key]
  );

  // Filtered Tong-its tables by Mode (Regular / Butasan / Joker) and Seats (2P / 3P)
  const visibleTables = useMemo(() => {
    if (isTongits) {
      return gameTables.filter(
        (t) => t.variant === selectedVariant && t.max_players === selectedMaxPlayers
      );
    }
    if (gameTables.length > 0) {
      return gameTables;
    }
    return BET_TIERS.map((tier) => ({
      id: `tbl-${game.game_key}-b${tier.bet}`,
      game_key: game.game_key,
      variant: 'Regular' as TongitsVariant,
      max_players: 3,
      bet_amount: tier.bet,
      min_wallet: tier.minWallet,
      rake_amount: tier.rake,
      is_enabled: true,
      status: 'waiting' as const,
      banker_id: null,
      hands_played: 0,
      total_pot_volume: 0,
      active_players: 0,
      milestone_log: [],
      created_at: '',
    }));
  }, [gameTables, isTongits, selectedVariant, selectedMaxPlayers, game.game_key]);

  const enabledVisibleTables = useMemo(
    () => visibleTables.filter((t) => t.is_enabled || user.role === 'admin'),
    [visibleTables, user.role]
  );

  const [selectedTableId, setSelectedTableId] = useState<string>('');

  // Auto-select first enabled table when mode/seat tab changes
  useEffect(() => {
    const stillValid = enabledVisibleTables.find((t) => t.id === selectedTableId);
    if (!stillValid) {
      setSelectedTableId(enabledVisibleTables[0]?.id || '');
    }
  }, [enabledVisibleTables, selectedTableId]);

  const activeTable = useMemo(
    () => visibleTables.find((t) => t.id === selectedTableId) || enabledVisibleTables[0] || null,
    [visibleTables, enabledVisibleTables, selectedTableId]
  );

  const effectiveBet = activeTable?.bet_amount ?? BET_TIERS[0].bet;
  const effectiveMinWallet = activeTable?.min_wallet ?? BET_TIERS[0].minWallet;
  const effectiveRake = activeTable?.rake_amount ?? BET_TIERS[0].rake;
  const tableIsSelectable = Boolean(activeTable && (activeTable.is_enabled || user.role === 'admin'));

  const maxBringIn = Math.max(effectiveMinWallet, Math.floor(user.wallet_balance));
  const [bringIn, setBringIn] = useState(
    Math.min(maxBringIn, Math.max(effectiveMinWallet, Math.floor(user.wallet_balance * 0.5)))
  );
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  // Keep bring-in synchronized whenever player selects a different table
  useEffect(() => {
    const nextMax = Math.max(effectiveMinWallet, Math.floor(user.wallet_balance));
    const defaultBring = Math.min(
      nextMax,
      Math.max(effectiveMinWallet, Math.floor(user.wallet_balance * 0.5))
    );
    setBringIn(defaultBring);
    setError('');
  }, [effectiveMinWallet, effectiveBet, user.wallet_balance]);

  const canAfford = user.wallet_balance >= effectiveMinWallet;

  const handleJoin = async () => {
    if (!activeTable || !tableIsSelectable) {
      setError('Please select an available table.');
      return;
    }
    setError('');
    setJoining(true);
    const tierPayload: BetTier = {
      bet: effectiveBet,
      minWallet: effectiveMinWallet,
      rake: effectiveRake,
      tierLabel: `Bet ₱${effectiveBet}`,
    };
    const err = await onConfirm(
      tierPayload,
      isTongits ? selectedVariant : activeTable.variant,
      isTongits ? selectedMaxPlayers : activeTable.max_players,
      bringIn,
      activeTable.id
    );
    if (err) {
      setError(err);
      setJoining(false);
    }
  };

  // Count enabled tables per variant & seat count for quick visual clarity
  const countEnabled = (variant: TongitsVariant, seats?: 2 | 3) =>
    gameTables.filter(
      (t) =>
        t.variant === variant &&
        (seats ? t.max_players === seats : true) &&
        t.is_enabled
    ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl border border-amber-400/45 bg-[#052920] p-5 sm:p-6 shadow-2xl my-auto space-y-4 max-h-[94vh] overflow-y-auto">
        {/* Header with Game Picture */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={GAME_ART_MAP[game.game_key]}
              alt={game.game_name}
              className="h-14 w-18 rounded-2xl object-cover border border-amber-400/60 shadow-lg shrink-0"
            />
            <div>
              <h3 className="font-display text-lg sm:text-xl font-extrabold text-amber-300 leading-tight">
                {isTongits ? 'Tong-its Table Dashboard' : game.short_label}
              </h3>
              <p className="mt-0.5 text-xs text-emerald-200">
                {isTongits
                  ? 'Select Regular, Butasan, or Joker · 2P or 3P · Available Betting Tables'
                  : 'Choose available table & betting amount'} · Timer:{' '}
                <strong className="font-mono-num text-white">
                  {game.turn_seconds >= 60 ? `${game.turn_seconds / 60} mins` : `${game.turn_seconds}s`}
                </strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close game setup"
            className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-900 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* TONG-ITS GAME MODE (Regular / Butasan / With Joker) + 2P / 3P TABLE FILTER */}
        {isTongits && (
          <div className="space-y-3 rounded-2xl border border-emerald-800/80 bg-[#031c16] p-3.5">
            <div>
              <span className="text-xs font-bold text-amber-300 block mb-2">
                1. Choose Tong-its Mode
              </span>
              <div className="grid grid-cols-3 gap-2">
                {TONGITS_VARIANTS.map((v) => {
                  const active = selectedVariant === v.id;
                  const openCount = countEnabled(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v.id)}
                      className={`rounded-xl p-2.5 text-left border transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-400 text-emerald-950 border-amber-200 shadow-md'
                          : 'bg-[#052920] text-emerald-100 border-emerald-800 hover:border-amber-400/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-display text-xs sm:text-sm font-black leading-tight">
                          {v.label}
                        </span>
                        <span
                          className={`font-mono-num text-[10px] font-bold ${
                            active ? 'text-emerald-950/80' : 'text-emerald-300'
                          }`}
                        >
                          {openCount} open
                        </span>
                      </div>
                      <span
                        className={`text-[10px] block mt-0.5 leading-tight ${
                          active ? 'text-emerald-950/85 font-semibold' : 'text-emerald-300/85'
                        }`}
                      >
                        {v.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-emerald-800/70">
              <span className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                2. Select Table Size
              </span>
              <div className="flex items-center gap-1.5">
                {([2, 3] as const).map((cnt) => {
                  const openCount = countEnabled(selectedVariant, cnt);
                  return (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSelectedMaxPlayers(cnt)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                        selectedMaxPlayers === cnt
                          ? 'bg-emerald-400 text-emerald-950'
                          : 'border border-emerald-700 bg-[#052920] text-emerald-200 hover:border-amber-400'
                      }`}
                    >
                      {cnt}P Table ({openCount})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* LIVE AVAILABLE TABLES & BETTING PRICES (CONTROLLED BY ADMIN SETUP) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-300">
              {isTongits
                ? `3. Available ${selectedVariant} ${selectedMaxPlayers}P Tables`
                : 'Available Tables & Betting Prices'}
            </span>
            <span className="font-mono-num text-[11px] text-emerald-300">
              Wallet:{' '}
              <strong className="text-white">
                ₱{user.wallet_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </strong>
            </span>
          </div>

          {visibleTables.length === 0 ? (
            <div className="rounded-2xl border border-emerald-800/80 bg-[#031c16] p-4 text-center text-xs text-emerald-300">
              No tables configured for this mode yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {visibleTables.map((tbl, idx) => {
                const isSelected = activeTable?.id === tbl.id;
                const disabled = !tbl.is_enabled && user.role !== 'admin';
                const affordable = user.wallet_balance >= tbl.min_wallet;

                // Rank tier mapping matching reference screenshot
                const tierMeta =
                  tbl.bet_amount <= 0.05
                    ? { name: 'PRACTICE', badgeBg: 'from-slate-600 to-slate-800 text-slate-100 border-slate-400/50', entry: '0.01-1' }
                    : tbl.bet_amount <= 0.5
                      ? { name: 'NEWBIE', badgeBg: 'from-emerald-600 to-teal-800 text-emerald-100 border-emerald-400/50', entry: '4-10' }
                      : tbl.bet_amount <= 1.0
                        ? { name: 'INTER', badgeBg: 'from-blue-600 to-cyan-800 text-blue-100 border-blue-400/50', entry: '10-20' }
                        : tbl.bet_amount <= 3.0
                          ? { name: 'SUPER', badgeBg: 'from-purple-600 to-fuchsia-800 text-purple-100 border-purple-400/50', entry: '45-100' }
                          : { name: 'EXPERT', badgeBg: 'from-amber-500 to-orange-700 text-amber-100 border-amber-300/60', entry: '75-150' };

                return (
                  <button
                    key={tbl.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedTableId(tbl.id)}
                    className={`relative overflow-hidden rounded-2xl p-3 text-left border transition-all flex flex-col justify-between gap-2 shadow-lg ${
                      disabled
                        ? 'bg-[#02140f]/80 border-red-900/50 text-emerald-400/50 opacity-55 cursor-not-allowed'
                        : isSelected
                          ? 'bg-gradient-to-br from-emerald-500/30 to-amber-500/30 border-amber-400 ring-2 ring-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.35)] cursor-pointer'
                          : affordable
                            ? 'bg-gradient-to-br from-[#04241c] to-[#02140f] text-white border-emerald-600/80 hover:border-amber-400 cursor-pointer'
                            : 'bg-[#031c16]/75 text-emerald-200 border-emerald-900 hover:border-amber-400/50 cursor-pointer'
                    }`}
                  >
                    {/* Hexagon Rank Badge Header */}
                    <div className="flex items-center justify-between gap-1">
                      <div className={`inline-flex items-center gap-1 rounded-lg bg-gradient-to-r ${tierMeta.badgeBg} px-2 py-0.5 font-mono-num text-[10px] font-black tracking-wider border shadow-sm`}>
                        <span>⬡</span>
                        <span>{tierMeta.name}</span>
                      </div>
                      <span className="font-mono-num text-[10px] font-bold text-emerald-300">
                        {disabled ? 'OFF' : `${tbl.active_players}/${tbl.max_players}P`}
                      </span>
                    </div>

                    {/* Bet Amount */}
                    <div className="py-1 text-center">
                      <span className="text-[10px] uppercase font-bold text-emerald-300 block">Bet Amount</span>
                      <strong className="font-mono-num text-lg font-black text-amber-300 tracking-tight">
                        ₱{tbl.bet_amount}
                      </strong>
                    </div>

                    {/* Entry Range Footer */}
                    <div className="rounded-xl border border-white/10 bg-black/35 px-2 py-1 text-center font-mono-num text-[10px] font-bold text-emerald-200">
                      Entry: {tierMeta.entry}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {enabledVisibleTables.length === 0 && visibleTables.length > 0 && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              All tables in {selectedVariant} {selectedMaxPlayers}P are currently disabled by Admin. Please choose another mode or seat size.
            </p>
          )}
        </div>

        {/* TABLE BRING-IN SLIDER + GPS CHECK */}
        <div className="rounded-2xl bg-[#031c16] border border-emerald-800/80 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-200 font-semibold">Table Bring-In Wallet</span>
            <span className="font-mono-num font-extrabold text-amber-300 text-base">
              ₱{bringIn.toLocaleString()}
            </span>
          </div>

          <input
            type="range"
            min={effectiveMinWallet}
            max={maxBringIn}
            step={10}
            disabled={!canAfford || !tableIsSelectable}
            value={bringIn}
            onChange={(e) => setBringIn(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />

          <div className="grid grid-cols-3 gap-2">
            {[effectiveMinWallet, Math.min(maxBringIn, effectiveMinWallet * 2), maxBringIn].map((preset, i) => (
              <button
                key={`${preset}-${i}`}
                type="button"
                disabled={!canAfford || !tableIsSelectable}
                onClick={() => setBringIn(preset)}
                className="rounded-lg border border-emerald-700/80 bg-[#052920] py-1.5 text-xs font-mono-num font-bold text-emerald-100 hover:border-amber-400 transition-colors cursor-pointer disabled:opacity-40"
              >
                {i === 2 ? 'Max' : `₱${preset}`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-300 border-t border-emerald-900">
            <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>2km Anti-Collusion GPS: <strong className="text-white">{gpsLabel}</strong></span>
          </div>
        </div>

        {!canAfford && tableIsSelectable && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-950/90 border border-red-700/80 px-3 py-2.5 text-xs text-red-200">
            <span>
              Insufficient coins. Minimum <strong>₱{effectiveMinWallet}</strong> needed for Bet ₱{effectiveBet}.
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCashIn();
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
            >
              <Coins className="h-3.5 w-3.5" />
              Cash In
            </button>
          </div>
        )}
        {error && (
          <p className="rounded-xl bg-red-950/90 border border-red-700/80 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-emerald-700 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canAfford || !tableIsSelectable || joining}
            onClick={handleJoin}
            className="flex-1 rounded-xl bg-amber-400 py-2.5 text-sm font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-40 transition-colors cursor-pointer"
          >
            {joining
              ? 'Seating...'
              : !tableIsSelectable
                ? 'Table Disabled'
                : isTongits
                  ? `Play ${selectedVariant} ${selectedMaxPlayers}P · ₱${effectiveBet}`
                  : `Play Bet ₱${effectiveBet}`}
          </button>
        </div>
      </div>
    </div>
  );
};
