import React from 'react';
import { motion } from 'motion/react';
import { Crown, Sparkles, Star, Trophy, Zap } from 'lucide-react';

export type WinBadgeLevel = 'legendary' | 'epic' | 'mega' | 'big' | 'standard';

interface WinBadgeProps {
  winAmount: number;
  betAmount: number;
  className?: string;
}

export function calculateWinBadgeLevel(winAmount: number, betAmount: number): WinBadgeLevel {
  if (!Number.isFinite(winAmount) || !Number.isFinite(betAmount) || winAmount <= 0 || betAmount <= 0) {
    return 'standard';
  }
  const ratio = winAmount / betAmount;
  if (ratio >= 100) return 'legendary';
  if (ratio >= 50) return 'epic';
  if (ratio >= 30) return 'mega';
  if (ratio >= 10) return 'big';
  return 'standard';
}

export const WinBadge: React.FC<WinBadgeProps> = ({ winAmount, betAmount, className = '' }) => {
  const level = calculateWinBadgeLevel(winAmount, betAmount);

  const config = (() => {
    switch (level) {
      case 'legendary':
        return {
          label: 'LEGENDARY',
          gradient: 'from-amber-200 via-yellow-400 to-rose-500 text-slate-950 border-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.85)]',
          icon: Crown,
          pulse: true,
        };
      case 'epic':
        return {
          label: 'EPIC WIN',
          gradient: 'from-fuchsia-400 via-purple-500 to-indigo-600 text-white border-fuchsia-300 shadow-[0_0_24px_rgba(217,70,239,0.7)]',
          icon: Trophy,
          pulse: true,
        };
      case 'mega':
        return {
          label: 'MEGA WIN',
          gradient: 'from-orange-400 via-amber-500 to-yellow-400 text-slate-950 border-amber-300 shadow-[0_0_20px_rgba(249,115,22,0.65)]',
          icon: Star,
          pulse: false,
        };
      case 'big':
        return {
          label: 'BIG WIN',
          gradient: 'from-emerald-400 via-teal-500 to-cyan-500 text-emerald-950 border-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.55)]',
          icon: Sparkles,
          pulse: false,
        };
      default:
        return {
          label: 'WIN',
          gradient: 'from-amber-400 to-yellow-500 text-emerald-950 border-amber-200 shadow-md',
          icon: Zap,
          pulse: false,
        };
    }
  })();

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: [0.8, 1.12, 1], opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r ${config.gradient} px-4 py-1.5 font-display text-sm sm:text-base font-black tracking-wider border-2 ${config.pulse ? 'animate-pulse' : ''} ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0 fill-current" />
      <span>{config.label}</span>
      <span className="font-mono-num text-xs opacity-85">({(winAmount / (betAmount || 1)).toFixed(1)}×)</span>
    </motion.div>
  );
};
