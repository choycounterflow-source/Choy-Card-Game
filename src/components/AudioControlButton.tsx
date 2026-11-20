import React, { useEffect, useRef, useState } from 'react';
import { Music, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';

interface AudioControlButtonProps {
  variant?: 'header' | 'compact';
  align?: 'right' | 'left';
}

export const AudioControlButton: React.FC<AudioControlButtonProps> = ({
  variant = 'header',
  align = 'right',
}) => {
  const {
    musicEnabled,
    musicVolume,
    sfxEnabled,
    sfxVolume,
    isAllMuted,
    toggleMusic,
    setMusicVolume,
    toggleSfx,
    setSfxVolume,
    toggleAllMute,
    previewSfx,
  } = useAudio();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const effectiveMusicActive = musicEnabled && musicVolume > 0;
  const effectiveSfxActive = sfxEnabled && sfxVolume > 0;

  return (
    <div ref={containerRef} className="relative inline-block">
      {variant === 'header' ? (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Audio & Volume Controls (Music & Sound Effects)"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer active:scale-95 ${
            !isAllMuted
              ? 'border-amber-400/80 bg-amber-400/20 text-amber-200 hover:bg-amber-400/35 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
              : 'border-zinc-700 bg-zinc-900/85 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {isAllMuted ? (
            <VolumeX className="h-3.5 w-3.5 text-zinc-400" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 text-amber-300" />
          )}
          <span className="hidden sm:inline">
            {isAllMuted ? 'Sound: OFF' : 'Audio'}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Audio and volume settings"
          title="Audio & Volume Controls"
          className={`rounded-xl border p-1.5 sm:p-2 transition-colors cursor-pointer ${
            !isAllMuted
              ? 'border-emerald-700/90 bg-[#031c16] text-amber-300 hover:border-amber-400'
              : 'border-red-800/70 bg-[#031c16] text-red-400 hover:border-red-500'
          }`}
        >
          {isAllMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Audio volume settings"
          className={`absolute top-full mt-2 z-50 w-72 rounded-2xl border border-amber-400/50 bg-[#04231b]/98 p-4 shadow-2xl backdrop-blur-md space-y-4 text-left ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between gap-2 border-b border-emerald-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-amber-400" />
              <span className="font-display text-sm font-extrabold text-white">
                Audio Mixer
              </span>
            </div>
            <button
              type="button"
              onClick={toggleAllMute}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                isAllMuted
                  ? 'border-amber-400/70 bg-amber-400/20 text-amber-200 hover:bg-amber-400/35'
                  : 'border-emerald-700 bg-[#031812] text-emerald-200 hover:border-red-400 hover:text-red-200'
              }`}
            >
              {isAllMuted ? 'Unmute All' : 'Mute All'}
            </button>
          </div>

          {/* Background Music Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={toggleMusic}
                className="inline-flex items-center gap-2 text-xs font-bold text-white hover:text-amber-300 transition-colors cursor-pointer"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                    effectiveMusicActive
                      ? 'border-amber-400/70 bg-amber-400/20 text-amber-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                  }`}
                >
                  <Music className="h-3.5 w-3.5" />
                </span>
                <span>Lobby Music</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="font-mono-num text-xs font-bold text-amber-300 w-9 text-right">
                  {effectiveMusicActive ? `${musicVolume}%` : 'OFF'}
                </span>
                <button
                  type="button"
                  onClick={toggleMusic}
                  aria-label={effectiveMusicActive ? 'Mute music' : 'Enable music'}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    effectiveMusicActive ? 'bg-amber-400' : 'bg-emerald-950 border border-emerald-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
                      effectiveMusicActive
                        ? 'translate-x-4.5 bg-emerald-950'
                        : 'translate-x-1 bg-emerald-400'
                    }`}
                  />
                </button>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={effectiveMusicActive ? musicVolume : 0}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              aria-label="Music volume"
              className="w-full h-1.5 rounded-lg appearance-none bg-emerald-950 accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Sound Effects Control */}
          <div className="space-y-2 border-t border-emerald-800/60 pt-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={toggleSfx}
                className="inline-flex items-center gap-2 text-xs font-bold text-white hover:text-amber-300 transition-colors cursor-pointer"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                    effectiveSfxActive
                      ? 'border-emerald-400/70 bg-emerald-400/20 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                  }`}
                >
                  {effectiveSfxActive ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                </span>
                <span>Sound Effects</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="font-mono-num text-xs font-bold text-emerald-300 w-9 text-right">
                  {effectiveSfxActive ? `${sfxVolume}%` : 'OFF'}
                </span>
                <button
                  type="button"
                  onClick={toggleSfx}
                  aria-label={effectiveSfxActive ? 'Mute sound effects' : 'Enable sound effects'}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    effectiveSfxActive ? 'bg-emerald-400' : 'bg-emerald-950 border border-emerald-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
                      effectiveSfxActive
                        ? 'translate-x-4.5 bg-emerald-950'
                        : 'translate-x-1 bg-emerald-400'
                    }`}
                  />
                </button>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={effectiveSfxActive ? sfxVolume : 0}
              onChange={(e) => setSfxVolume(Number(e.target.value))}
              onMouseUp={previewSfx}
              onTouchEnd={previewSfx}
              aria-label="Sound effects volume"
              className="w-full h-1.5 rounded-lg appearance-none bg-emerald-950 accent-emerald-400 cursor-pointer"
            />
          </div>

          <p className="text-[10px] text-emerald-300/80 leading-snug pt-1 border-t border-emerald-800/60">
            Music & SFX levels save automatically to your device.
          </p>
        </div>
      )}
    </div>
  );
};
