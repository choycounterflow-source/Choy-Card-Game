import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  playChipClink,
  setMusicSettings,
  setSfxSettings,
  unlockAudioEngine,
} from '../lib/audio';

const STORAGE_KEY = 'choy_audio_preferences_v1';
const LEGACY_SFX_KEY = 'choy_sound_enabled';

export interface AudioPreferences {
  musicEnabled: boolean;
  musicVolume: number; // 0 to 100
  sfxEnabled: boolean;
  sfxVolume: number; // 0 to 100
}

const DEFAULT_PREFS: AudioPreferences = {
  musicEnabled: true,
  musicVolume: 35,
  sfxEnabled: true,
  sfxVolume: 80,
};

function clampVolume(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function loadAudioPreferences(): AudioPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
      return {
        musicEnabled:
          typeof parsed.musicEnabled === 'boolean'
            ? parsed.musicEnabled
            : DEFAULT_PREFS.musicEnabled,
        musicVolume: clampVolume(parsed.musicVolume, DEFAULT_PREFS.musicVolume),
        sfxEnabled:
          typeof parsed.sfxEnabled === 'boolean'
            ? parsed.sfxEnabled
            : DEFAULT_PREFS.sfxEnabled,
        sfxVolume: clampVolume(parsed.sfxVolume, DEFAULT_PREFS.sfxVolume),
      };
    }

    // Migrate legacy single toggle if present
    const legacy = window.localStorage.getItem(LEGACY_SFX_KEY);
    if (legacy !== null) {
      const enabled = legacy === 'true';
      return {
        ...DEFAULT_PREFS,
        musicEnabled: enabled,
        sfxEnabled: enabled,
      };
    }
  } catch {
    // Ignore storage read issues
  }
  return DEFAULT_PREFS;
}

interface AudioContextValue extends AudioPreferences {
  isAllMuted: boolean;
  toastMessage: string | null;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  toggleMusic: () => void;
  setSfxEnabled: (enabled: boolean) => void;
  setSfxVolume: (volume: number) => void;
  toggleSfx: () => void;
  toggleAllMute: () => void;
  previewSfx: () => void;
}

const AudioManagementContext = createContext<AudioContextValue | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<AudioPreferences>(() => loadAudioPreferences());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  // Sync audio engine & persist to localStorage whenever preferences change
  useEffect(() => {
    setMusicSettings(prefs.musicEnabled, prefs.musicVolume / 100);
    setSfxSettings(prefs.sfxEnabled, prefs.sfxVolume / 100);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      window.localStorage.setItem(LEGACY_SFX_KEY, String(prefs.sfxEnabled));
    } catch {
      // Ignore storage quota errors
    }
  }, [prefs]);

  // Unlock Web Audio context on first user gesture so lounge music & SFX play smoothly
  useEffect(() => {
    const handleFirstGesture = () => {
      unlockAudioEngine();
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true, passive: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const setMusicEnabled = useCallback(
    (enabled: boolean) => {
      unlockAudioEngine();
      setPrefs((prev) => ({
        ...prev,
        musicEnabled: enabled,
        musicVolume: enabled && prev.musicVolume === 0 ? DEFAULT_PREFS.musicVolume : prev.musicVolume,
      }));
      showToast(enabled ? 'Music Enabled' : 'Music Muted');
    },
    [showToast]
  );

  const setMusicVolume = useCallback((volume: number) => {
    unlockAudioEngine();
    const clamped = clampVolume(volume, DEFAULT_PREFS.musicVolume);
    setPrefs((prev) => ({
      ...prev,
      musicVolume: clamped,
      musicEnabled: clamped > 0 ? true : false,
    }));
  }, []);

  const toggleMusic = useCallback(() => {
    unlockAudioEngine();
    setPrefs((prev) => {
      const next = !prev.musicEnabled;
      showToast(next ? 'Music Enabled' : 'Music Muted');
      return {
        ...prev,
        musicEnabled: next,
        musicVolume: next && prev.musicVolume === 0 ? DEFAULT_PREFS.musicVolume : prev.musicVolume,
      };
    });
  }, [showToast]);

  const setSfxEnabled = useCallback(
    (enabled: boolean) => {
      unlockAudioEngine();
      setPrefs((prev) => ({
        ...prev,
        sfxEnabled: enabled,
        sfxVolume: enabled && prev.sfxVolume === 0 ? DEFAULT_PREFS.sfxVolume : prev.sfxVolume,
      }));
      showToast(enabled ? 'Sound Effects Enabled' : 'Sound Effects Muted');
    },
    [showToast]
  );

  const setSfxVolume = useCallback((volume: number) => {
    unlockAudioEngine();
    const clamped = clampVolume(volume, DEFAULT_PREFS.sfxVolume);
    setPrefs((prev) => ({
      ...prev,
      sfxVolume: clamped,
      sfxEnabled: clamped > 0 ? true : false,
    }));
  }, []);

  const toggleSfx = useCallback(() => {
    unlockAudioEngine();
    setPrefs((prev) => {
      const next = !prev.sfxEnabled;
      showToast(next ? 'Sound Effects Enabled' : 'Sound Effects Muted');
      return {
        ...prev,
        sfxEnabled: next,
        sfxVolume: next && prev.sfxVolume === 0 ? DEFAULT_PREFS.sfxVolume : prev.sfxVolume,
      };
    });
  }, [showToast]);

  const toggleAllMute = useCallback(() => {
    unlockAudioEngine();
    setPrefs((prev) => {
      const currentlyAllMuted =
        (!prev.musicEnabled || prev.musicVolume === 0) &&
        (!prev.sfxEnabled || prev.sfxVolume === 0);
      const nextOn = currentlyAllMuted;
      showToast(nextOn ? 'All Audio Unmuted' : 'All Audio Muted');
      return {
        musicEnabled: nextOn,
        musicVolume: nextOn && prev.musicVolume === 0 ? DEFAULT_PREFS.musicVolume : prev.musicVolume,
        sfxEnabled: nextOn,
        sfxVolume: nextOn && prev.sfxVolume === 0 ? DEFAULT_PREFS.sfxVolume : prev.sfxVolume,
      };
    });
  }, [showToast]);

  const previewSfx = useCallback(() => {
    unlockAudioEngine();
    playChipClink();
  }, []);

  const isAllMuted =
    (!prefs.musicEnabled || prefs.musicVolume === 0) &&
    (!prefs.sfxEnabled || prefs.sfxVolume === 0);

  return (
    <AudioManagementContext.Provider
      value={{
        ...prefs,
        isAllMuted,
        toastMessage,
        setMusicEnabled,
        setMusicVolume,
        toggleMusic,
        setSfxEnabled,
        setSfxVolume,
        toggleSfx,
        toggleAllMute,
        previewSfx,
      }}
    >
      {children}
    </AudioManagementContext.Provider>
  );
};

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioManagementContext);
  if (!ctx) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return ctx;
}
