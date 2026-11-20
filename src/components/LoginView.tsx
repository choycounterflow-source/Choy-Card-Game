import React, { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, MapPin, UserPlus } from 'lucide-react';
import type { UserProfile } from '../types';
import { PWAInstallButton } from './PWAControls';
import lobbyHeroImg from '../assets/images/choyjiez_lobby_hero_1795073315513.jpg';
import choyAppIconImg from '../assets/images/choy_app_icon_1795198096662.jpg';
import { AgeVerificationSplash } from './AgeVerificationSplash';

interface LoginViewProps {
  gpsStatus: string;
  onAuthSuccess: (user: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ gpsStatus, onAuthSuccess }) => {
  const [ageVerified, setAgeVerified] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('choy_age_verified') === 'true';
    } catch {
      return false;
    }
  });

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [withdrawalPin, setWithdrawalPin] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferredBy(ref.trim().toUpperCase());
      setMode('register');
      setPhone('');
      setPassword('');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login'
          ? { phone, password }
          : { phone, password, fullName, withdrawalPin, referredBy };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
      } else if (data.user) {
        onAuthSuccess(data.user);
      }
    } catch {
      setError('Unable to reach server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!ageVerified) {
    return (
      <AgeVerificationSplash
        onVerified={() => {
          try {
            sessionStorage.setItem('choy_age_verified', 'true');
          } catch {}
          setAgeVerified(true);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Hero Editorial Showcase Column */}
        <div className="lg:col-span-7 relative overflow-hidden rounded-3xl border border-emerald-800/80 bg-[#052920] min-h-[320px] lg:min-h-[540px] flex flex-col justify-end">
          <img
            src={lobbyHeroImg}
            alt="Choy Card Game VIP emerald felt card table with fanned playing cards, gold chips, and wooden color dice"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#02140f] via-[#02140f]/75 to-transparent" />

          <div className="relative z-10 p-6 sm:p-8 space-y-4">
            <p className="text-xs font-medium text-amber-300 tracking-wide">
              Tong-its · Pusoy · Lucky 9 · Poker · Color Game · Bet Game · Tsekitsa
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white leading-tight max-w-xl">
              Filipino Card & Dice Tables, Built for Fair Real-Time Play
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/90 max-w-xl leading-relaxed">
              Installable mobile PWA with Pro Tong-its melds, Pusoy card swap, highest-wallet Lucky 9 banker rotation, 6×5 slots, and strict 2km GPS protection.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-white/15 text-xs">
              <div>
                <span className="text-emerald-300 block">VIP 1 Access</span>
                <strong className="font-mono-num text-white text-sm">Max ₱1,000/day</strong>
              </div>
              <div>
                <span className="text-emerald-300 block">VIP 2 Priority</span>
                <strong className="font-mono-num text-amber-300 text-sm">3x ₱5,000/day</strong>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-emerald-300 block">GPS Proximity Lock</span>
                <strong className="text-white text-sm inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-amber-400" />
                  {gpsStatus}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Card Column (Matched with 3D App Icon Background Image & Choy Game Card Branding) */}
        <div className="lg:col-span-5 relative overflow-hidden rounded-3xl border border-emerald-400/40 bg-[#031c16]/70 backdrop-blur-md p-6 sm:p-8 flex flex-col justify-between shadow-2xl">
          <img
            src={choyAppIconImg}
            alt="Choy Card Game 3D player holding Choy Game playing card"
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top brightness-110 contrast-105 saturate-105 opacity-90"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#02140f] via-[#02140f]/75 to-[#02140f]/35" />

          <div className="relative z-10">
            <PWAInstallButton variant="banner" />
            <div className="flex items-center justify-between gap-2 border-b border-white/20 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-0.5 text-[11px] font-extrabold text-emerald-950 shadow mb-1.5">
                  <span>🃏 Choy Game Card Table</span>
                </div>
                <h2 className="font-display text-2xl font-extrabold text-white drop-shadow-md">
                  {mode === 'login' ? 'Enter Arena' : 'Create Player Account'}
                </h2>
                <p className="text-xs text-emerald-200/90 mt-0.5 drop-shadow-xs">
                  {mode === 'login'
                    ? 'Sign in with your mobile number or Admin credentials'
                    : 'Create your player account to join live tables & slots'}
                </p>
              </div>
            </div>

            {/* Segmented Mode Switch */}
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-[#031c16]/85 backdrop-blur-xs p-1 border border-emerald-700/80">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'login'
                    ? 'bg-amber-400 text-emerald-950'
                    : 'text-emerald-300 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setPhone('');
                  setPassword('');
                  setError('');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'register'
                    ? 'bg-amber-400 text-emerald-950'
                    : 'text-emerald-300 hover:text-white'
                }`}
              >
                Register Player
              </button>
            </div>

            {mode === 'register' && referredBy && (
              <div className="mt-4 rounded-xl border border-amber-400/60 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-100">
                <strong className="text-amber-300">Invited to Choy Card Game!</strong> Referral code{' '}
                <span className="font-mono-num font-extrabold text-white">{referredBy}</span> is automatically applied. Create your account below to play.
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-emerald-200 mb-1">Display Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your display name"
                    className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16]/85 backdrop-blur-xs px-3.5 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-emerald-100 mb-1">Mobile Number</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09XXXXXXXXX"
                  className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16]/85 backdrop-blur-xs px-3.5 py-2.5 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-emerald-100 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16]/85 backdrop-blur-xs px-3.5 py-2.5 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-emerald-100 mb-1">4-Digit Cashout PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={withdrawalPin}
                      onChange={(e) => setWithdrawalPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="4-digit PIN"
                      className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16]/85 backdrop-blur-xs px-3.5 py-2.5 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-emerald-100 mb-1">Referral Code (Optional)</label>
                    <input
                      type="text"
                      value={referredBy}
                      onChange={(e) => setReferredBy(e.target.value)}
                      placeholder="Enter code"
                      className="w-full rounded-xl border border-emerald-700/80 bg-[#031c16]/85 backdrop-blur-xs px-3.5 py-2.5 text-sm font-mono-num text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-xl border border-red-700/80 bg-red-950/90 px-3.5 py-2.5 text-xs text-red-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-extrabold text-emerald-950 shadow-lg hover:bg-amber-300 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {mode === 'login' ? (
                  <>
                    <KeyRound className="h-4 w-4" />
                    {loading ? 'Signing In...' : 'Enter Game Lobby'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    {loading ? 'Creating Account...' : 'Register & Play'}
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="relative z-10 mt-6 border-t border-white/15 pt-4 text-xs text-emerald-200 leading-relaxed space-y-3">
            <p>
              New players can switch to <strong className="text-amber-300">Register Player</strong> above to create an account with a 4-digit withdrawal PIN and join live tables immediately.
            </p>

            {/* PAGCOR Compliance Notice Co-located in Vacant Space */}
            <div className="rounded-2xl border border-amber-400/40 bg-[#02140f]/90 p-3 text-[10px] text-emerald-200/90 space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-blue-600 px-1.5 py-0.5 font-display font-black text-white text-[9px]">PAGCOR</span>
                  <span className="font-bold text-white">Regulated Gaming</span>
                </div>
                <span className="rounded-full bg-red-950 border border-red-500/60 px-2 py-0.5 text-[9px] font-extrabold text-red-200">
                  21+ · Know When To Stop
                </span>
              </div>
              <p className="text-[9px] text-emerald-300/85">
                Not allowed for Government Officials, AFP/PNP personnel, persons under 21, NDRP list, and GEL holders.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
