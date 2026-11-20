import React, { useState } from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import appIconImg from '../assets/images/choy_app_icon_1795198096662.jpg';

interface AgeVerificationSplashProps {
  onVerified: () => void;
}

export const AgeVerificationSplash: React.FC<AgeVerificationSplashProps> = ({ onVerified }) => {
  const [checked18, setChecked18] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checked18) {
      setErrorMsg('You must confirm that you are 18 years of age or older to play Choy Card Game.');
      return;
    }
    setErrorMsg('');
    onVerified();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#010d0a] p-4 sm:p-8 overflow-y-auto">
      {/* Highlighted Full-Screen Background Image of App Icon with Balanced Gradient Overlay */}
      <img
        src={appIconImg}
        alt="Choy Card Game 3D App Icon - Person holding card with Joker face"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center brightness-115 contrast-105 saturate-110 opacity-60"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#010d0a] via-[#010d0a]/65 to-transparent" />

      {/* Floating Header Card Branding (Choy Card Game + Joker Face) */}
      <div className="absolute top-6 inset-x-4 z-20 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/80 bg-emerald-950/90 px-4 py-2 shadow-[0_0_25px_rgba(251,191,36,0.5)] backdrop-blur-md">
          <span className="text-xl">🃏</span>
          <div className="text-left">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 block leading-none">
              Joker Face · Card Table
            </span>
            <span className="font-display text-sm sm:text-base font-black text-white tracking-wide">
              Choy Card Game
            </span>
          </div>
        </div>
      </div>

      {/* Lowered Age Confirmation Box & Continue Button */}
      <div className="relative z-20 mx-auto w-full max-w-lg rounded-3xl border border-amber-400/60 bg-[#031c16]/85 backdrop-blur-md p-5 sm:p-6 shadow-2xl space-y-4 mb-4">
        <form onSubmit={handleContinue} className="space-y-4">
          <label className="flex items-start gap-3 rounded-2xl border border-emerald-600/80 bg-[#010d0a]/90 p-3.5 sm:p-4 cursor-pointer hover:border-amber-400 transition shadow-inner">
            <input
              type="checkbox"
              checked={checked18}
              onChange={(e) => {
                setChecked18(e.target.checked);
                setErrorMsg('');
              }}
              className="mt-0.5 h-5 w-5 rounded border-emerald-500 accent-amber-400 shrink-0 cursor-pointer"
            />
            <span className="text-xs sm:text-sm font-bold text-white leading-snug">
              Check if you are 18 up of ages (if below 18 cant play this game). By checking this box, you confirm your legal eligibility.
            </span>
          </label>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/60 bg-red-950/80 p-3 text-xs text-red-200">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-sm font-extrabold text-emerald-950 shadow-xl hover:bg-amber-300 transition active:scale-95 cursor-pointer"
          >
            <span>Continue to Login</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="text-center text-[11px] text-emerald-300 font-mono-num">
          Secure 2km GPS Protected Arena · Choy Card Game 2026
        </p>
      </div>

      {/* Official PAGCOR Compliance & Restriction Notice */}
      <div className="relative z-25 mx-auto w-full max-w-lg rounded-3xl border border-amber-400/40 bg-[#02140f]/92 backdrop-blur-md p-4 sm:p-5 shadow-2xl text-[11px] text-emerald-200/90 space-y-2 mb-4">
        <div className="flex items-center justify-between border-b border-emerald-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-600 px-2 py-0.5 font-display font-black text-white text-xs tracking-wider">PAGCOR</span>
            <span className="font-bold text-white text-xs">Regulated Gaming Compliance</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-red-500/60 bg-red-950/80 px-2.5 py-0.5 text-[10px] font-extrabold text-red-200">
            <span>21+</span>
            <span>KNOW WHEN TO STOP</span>
          </div>
        </div>
        <p className="text-[10px] text-emerald-300/90 leading-tight font-semibold">
          The following personalities are NOT ALLOWED to register and/or play:
        </p>
        <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-emerald-300/85">
          <li>Government officials or employees connected directly with government operations.</li>
          <li>Members of the Armed Forces of the Philippines (Army, Navy, Air Force) and PNP.</li>
          <li>Persons under legal age eligibility and persons in PAGCOR&apos;s NDRP list.</li>
          <li>Gaming Employment License (GEL) holders.</li>
        </ul>
        <div className="pt-1 flex items-center justify-between text-[10px] text-amber-300">
          <span>Keep online gaming private</span>
          <span className="underline cursor-pointer hover:text-white">Terms of use and Privacy Policy</span>
        </div>
      </div>
    </div>
  );
};
