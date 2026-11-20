import React from 'react';
import { X } from 'lucide-react';

export type FooterModalType = 'contact' | 'about' | 'blog' | null;

interface InfoModalProps {
  type: FooterModalType;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-700/80 bg-[#052920] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-emerald-800/80 pb-3">
          <h3 className="font-display text-lg font-bold text-amber-300">
            {type === 'contact' && 'Contact Us'}
            {type === 'about' && 'About Choy Card Game'}
            {type === 'blog' && 'Choy Card Game 2026 Tournament Blog'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-900 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-emerald-100 leading-relaxed">
          {type === 'contact' && (
            <>
              <p>
                Need help with GCash / Intuit Terminal cash-in approvals, VIP 2 cashback upgrades, or Agent registration? Reach Super Admin Choy directly:
              </p>
              <div className="rounded-xl bg-[#031c16] border border-emerald-800/80 p-4 space-y-1.5 font-mono-num text-xs text-emerald-200">
                <p>Hotline / GCash Official: <strong className="text-amber-300">09361223978</strong></p>
                <p>Support Email: <strong className="text-white">support@choyjiez.ph</strong></p>
                <p>Operating Hours: <strong className="text-white">24/7 Live Desk & Ask Choy AI</strong></p>
              </div>
            </>
          )}

          {type === 'about' && (
            <>
              <p>
                <strong>Choy Card Game</strong> is a real-time multiplayer Filipino card, dice, and slot arena engineered for crisp mobile and desktop PWA play. Every table enforces strict 2km GPS anti-collusion verification, live countdown timers, and VIP rewards.
              </p>
              <p className="text-emerald-300 text-xs">
                Featured Games: Pro Tong-its (Regular, Butasan, Joker) · Pusoy · Lucky 9 · Texas Poker · Bet Game · Color Game (3 Dice Square) · Tsekitsa · Super Ace.
              </p>
            </>
          )}

          {type === 'blog' && (
            <div className="space-y-3">
              <article className="border-b border-emerald-800/70 pb-3">
                <p className="text-xs text-amber-300">November 2026 · Tournament Desk</p>
                <h4 className="font-display font-bold text-white mt-0.5">Weekly Top 3 Rewards Pool Open</h4>
                <p className="text-xs text-emerald-200 mt-1">
                  Climb the weekly wins leaderboard across Tong-its, Pusoy, Lucky 9, and Color Game. Top 3 finishers automatically qualify for weekly cash pool distributions configured by Admin Choy.
                </p>
              </article>
              <article>
                <p className="text-xs text-amber-300">October 2026 · Pro Table Update</p>
                <h4 className="font-display font-bold text-white mt-0.5">2km GPS Proximity Lock & Pro Tong-its Melds</h4>
                <p className="text-xs text-emerald-200 mt-1">
                  All active tables enforce strict 2km radius checks between human players, with Pro Tong-its Group Melds, Drop Melds, Show Melds, Fight/Fold, and 3-row full-hand visibility.
                </p>
              </article>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-emerald-950 hover:bg-amber-300 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
