import React from 'react';
import type { Rank, Suit } from '../types';

export interface SuitPalette {
  name: string;
  primary: string;
  secondary: string;
  highlight: string;
  stroke: string;
  textClass: string;
  frameBg: string;
  frameBorder: string;
  cloakPrimary: string;
  cloakAccent: string;
}

export const SUIT_PALETTES: Record<Suit, SuitPalette> = {
  '♠': {
    name: 'Spade',
    primary: '#1E1B4B',
    secondary: '#3730A3',
    highlight: '#818CF8',
    stroke: '#0F172A',
    textClass: 'text-indigo-950',
    frameBg: 'from-indigo-100/90 via-slate-50 to-indigo-50/90',
    frameBorder: 'border-indigo-400/75',
    cloakPrimary: '#312E81',
    cloakAccent: '#F59E0B',
  },
  '♥': {
    name: 'Heart',
    primary: '#DC2626',
    secondary: '#F43F5E',
    highlight: '#FDA4AF',
    stroke: '#991B1B',
    textClass: 'text-red-600',
    frameBg: 'from-rose-100/90 via-white to-red-50/90',
    frameBorder: 'border-rose-400/75',
    cloakPrimary: '#DC2626',
    cloakAccent: '#FBBF24',
  },
  '♦': {
    name: 'Diamond',
    primary: '#2563EB',
    secondary: '#0EA5E9',
    highlight: '#BAE6FD',
    stroke: '#1D4ED8',
    textClass: 'text-blue-600',
    frameBg: 'from-sky-100/90 via-white to-blue-50/90',
    frameBorder: 'border-sky-400/80',
    cloakPrimary: '#2563EB',
    cloakAccent: '#FBBF24',
  },
  '♣': {
    name: 'Flower',
    primary: '#059669',
    secondary: '#10B981',
    highlight: '#A7F3D0',
    stroke: '#065F46',
    textClass: 'text-emerald-700',
    frameBg: 'from-emerald-100/90 via-white to-teal-50/90',
    frameBorder: 'border-emerald-400/80',
    cloakPrimary: '#059669',
    cloakAccent: '#FBBF24',
  },
  '★': {
    name: 'Joker',
    primary: '#9333EA',
    secondary: '#F59E0B',
    highlight: '#FEF08A',
    stroke: '#6B21A8',
    textClass: 'text-purple-700',
    frameBg: 'from-amber-100/90 via-white to-purple-100/90',
    frameBorder: 'border-amber-400/90',
    cloakPrimary: '#7E22CE',
    cloakAccent: '#F59E0B',
  },
};

interface BoldSuitIconProps {
  suit: Suit;
  className?: string;
}

/**
 * Bold, chunky, colorful vector suit icons (Spade, Heart, Diamond, Flower/Club, Star)
 * with glossy highlights and crisp outlines for instant readability on mobile and desktop.
 */
export const BoldSuitIcon: React.FC<BoldSuitIconProps> = ({ suit, className = 'w-6 h-6' }) => {
  const pal = SUIT_PALETTES[suit] ?? SUIT_PALETTES['♠'];

  if (suit === '♥') {
    return (
      <svg viewBox="0 0 64 64" className={`${className} shrink-0 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.22)]`} aria-hidden="true">
        <path
          d="M32 58 C29 55 7 39 7 22 C7 11.5 15 5 23.5 5 C28.5 5 30.8 7.8 32 10.6 C33.2 7.8 35.5 5 40.5 5 C49 5 57 11.5 57 22 C57 39 35 55 32 58 Z"
          fill={pal.primary}
          stroke={pal.stroke}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        <path
          d="M15 21 C15 14.5 19.5 11.5 23.5 11.5 C25 11.5 26 12.6 25 14.2 C22 15.8 19.5 19 19 23.2 C18.8 25 15 24.4 15 21 Z"
          fill={pal.highlight}
          opacity="0.85"
        />
      </svg>
    );
  }

  if (suit === '♦') {
    return (
      <svg viewBox="0 0 64 64" className={`${className} shrink-0 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.22)]`} aria-hidden="true">
        <polygon
          points="32,4 57,32 32,60 7,32"
          fill={pal.primary}
          stroke={pal.stroke}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        {/* Sparkling faceted gem planes */}
        <polygon points="32,8 51,32 32,32" fill={pal.secondary} opacity="0.9" />
        <polygon points="32,8 13,32 32,32" fill={pal.highlight} opacity="0.65" />
        <polygon points="32,16 41,32 32,48 23,32" fill="#FFFFFF" opacity="0.28" />
      </svg>
    );
  }

  if (suit === '♣') {
    // Bold lush emerald "Flower" (Club / Clover)
    return (
      <svg viewBox="0 0 64 64" className={`${className} shrink-0 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.22)]`} aria-hidden="true">
        {/* Stem */}
        <path
          d="M28 40 L21 59 L43 59 L36 40 Z"
          fill={pal.stroke}
          stroke={pal.stroke}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* Three big rounded flower petals */}
        <circle cx="32" cy="18" r="13.5" fill={pal.primary} stroke={pal.stroke} strokeWidth="3" />
        <circle cx="17.5" cy="34.5" r="13" fill={pal.primary} stroke={pal.stroke} strokeWidth="3" />
        <circle cx="46.5" cy="34.5" r="13" fill={pal.primary} stroke={pal.stroke} strokeWidth="3" />
        {/* Inner lush petal fill */}
        <circle cx="32" cy="29" r="9" fill={pal.secondary} />
        {/* Bright leaf highlights */}
        <circle cx="28" cy="14" r="4.2" fill={pal.highlight} opacity="0.8" />
        <circle cx="14" cy="31" r="3.8" fill={pal.highlight} opacity="0.72" />
        <circle cx="43" cy="31" r="3.8" fill={pal.highlight} opacity="0.72" />
        <circle cx="32" cy="30" r="3.2" fill="#FEF08A" opacity="0.85" />
      </svg>
    );
  }

  if (suit === '♠') {
    return (
      <svg viewBox="0 0 64 64" className={`${className} shrink-0 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.25)]`} aria-hidden="true">
        {/* Base stem */}
        <path
          d="M28 43 L20 59 L44 59 L36 43 Z"
          fill={pal.primary}
          stroke={pal.stroke}
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        {/* Oversized sharp royal spade body */}
        <path
          d="M32 4 C35 8 57 24 57 38 C57 47 49.5 52 42 52 C37.2 52 34 49.6 32 46.8 C30 49.6 26.8 52 22 52 C14.5 52 7 47 7 38 C7 24 29 8 32 4 Z"
          fill={pal.primary}
          stroke={pal.stroke}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        {/* Metallic sapphire inner gleam */}
        <path
          d="M32 12 C27 18 16 28 16 37 C16 41 19 43.5 22.5 43.5 C24.8 43.5 26 41.5 25 39 C23 36 24 28 32 19 Z"
          fill={pal.highlight}
          opacity="0.58"
        />
      </svg>
    );
  }

  // ★ Joker Star
  return (
    <svg viewBox="0 0 64 64" className={`${className} shrink-0 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.25)]`} aria-hidden="true">
      <polygon
        points="32,4 40,22 60,24 45,38 49,58 32,48 15,58 19,38 4,24 24,22"
        fill={pal.secondary}
        stroke={pal.primary}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <polygon
        points="32,12 37,25 50,26 40,35 43,48 32,41 21,48 24,35 14,26 27,25"
        fill={pal.highlight}
        opacity="0.7"
      />
    </svg>
  );
};

interface CourtPortraitProps {
  rank: 'J' | 'Q' | 'K' | 'JOKER';
  suit: Suit;
  className?: string;
}

/**
 * Illustrated royal person portraits for Jack (Prince/Knight), Queen, King, and Joker.
 * Designed with bold outlines and bright royal attire tinted by each card's suit color.
 */
export const CourtPortrait: React.FC<CourtPortraitProps> = ({ rank, suit, className = 'w-full h-full' }) => {
  const pal = SUIT_PALETTES[suit] ?? SUIT_PALETTES['♠'];

  if (rank === 'K') {
    // ROYAL KING — Grand jeweled golden crown, noble bearded face, ermine cape, golden sword
    return (
      <svg viewBox="0 0 80 92" className={className} aria-hidden="true">
        {/* Background halo */}
        <circle cx="40" cy="46" r="34" fill={pal.highlight} opacity="0.22" />
        {/* Royal Sword behind right shoulder */}
        <path d="M64 16 L68 12 L70 52 L64 52 Z" fill="#E2E8F0" stroke="#475569" strokeWidth="1.6" />
        <rect x="60" y="48" width="14" height="4.5" rx="2" fill="#F59E0B" stroke="#92400E" strokeWidth="1.3" />
        <rect x="65" y="52" width="4" height="10" rx="1.5" fill="#B45309" />

        {/* Royal Cloak & Shoulders */}
        <path
          d="M12 88 C13 67 24 60 40 60 C56 60 67 67 68 88 Z"
          fill={pal.cloakPrimary}
          stroke="#1E293B"
          strokeWidth="2.4"
        />
        {/* Golden royal sash & center emblem */}
        <path d="M27 62 L53 88 L43 88 L22 66 Z" fill="#FBBF24" opacity="0.92" />
        {/* White ermine fur collar */}
        <path
          d="M20 64 Q40 73 60 64 Q58 58 40 59 Q22 58 20 64 Z"
          fill="#FFFBEB"
          stroke="#CBD5E1"
          strokeWidth="1.6"
        />
        <circle cx="30" cy="64" r="1.4" fill="#334155" />
        <circle cx="40" cy="66" r="1.4" fill="#334155" />
        <circle cx="50" cy="64" r="1.4" fill="#334155" />

        {/* Hair behind ears */}
        <path d="M21 38 C19 46 21 55 26 57 L54 57 C59 55 61 46 59 38 Z" fill="#78350F" />

        {/* Neck */}
        <rect x="34" y="52" width="12" height="10" rx="4" fill="#F6C39A" />

        {/* Head / Face */}
        <ellipse cx="40" cy="40" rx="16.5" ry="17.5" fill="#FCD5B5" stroke="#78350F" strokeWidth="1.8" />
        {/* Ears */}
        <circle cx="23.5" cy="41" r="3.2" fill="#F6C39A" stroke="#78350F" strokeWidth="1.4" />
        <circle cx="56.5" cy="41" r="3.2" fill="#F6C39A" stroke="#78350F" strokeWidth="1.4" />

        {/* Distinguished eyebrows & eyes */}
        <path d="M29 34 Q33 32 36.5 34" stroke="#5C2D0C" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M43.5 34 Q47 32 51 34" stroke="#5C2D0C" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <circle cx="33" cy="38.5" r="2.3" fill="#1E293B" />
        <circle cx="47" cy="38.5" r="2.3" fill="#1E293B" />
        <circle cx="33.8" cy="37.8" r="0.8" fill="#FFFFFF" />
        <circle cx="47.8" cy="37.8" r="0.8" fill="#FFFFFF" />

        {/* Rosy cheeks & nose */}
        <ellipse cx="28.5" cy="43" rx="2.6" ry="1.5" fill="#FB7185" opacity="0.45" />
        <ellipse cx="51.5" cy="43" rx="2.6" ry="1.5" fill="#FB7185" opacity="0.45" />
        <path d="M40 39 L39 43.5 L41.5 43.5" stroke="#C2845A" strokeWidth="1.4" strokeLinecap="round" fill="none" />

        {/* Royal Full Beard & Mustache */}
        <path
          d="M24 44 C24 55 31 61 40 61 C49 61 56 55 56 44 C53 47 48 48 40 48 C32 48 27 47 24 44 Z"
          fill="#92400E"
          stroke="#5C2D0C"
          strokeWidth="1.6"
        />
        <path
          d="M31 47 Q36 44 40 46.5 Q44 44 49 47 Q45 50 40 49 Q35 50 31 47 Z"
          fill="#78350F"
        />
        {/* Confident smile */}
        <path d="M36 51 Q40 53.5 44 51" stroke="#FFFBEB" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        {/* Grand 5-Point Golden King Crown */}
        <path
          d="M21 29 L19 13 L30 21 L40 8 L50 21 L61 13 L59 29 Z"
          fill="#FBBF24"
          stroke="#92400E"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <rect x="21" y="25" width="38" height="6" rx="2" fill="#F59E0B" stroke="#92400E" strokeWidth="1.8" />
        {/* Crown Jewels */}
        <circle cx="40" cy="28" r="2.6" fill={pal.primary} stroke="#FEF08A" strokeWidth="1" />
        <circle cx="29" cy="28" r="2" fill="#38BDF8" />
        <circle cx="51" cy="28" r="2" fill="#10B981" />
        <circle cx="40" cy="8" r="2.4" fill="#FEF08A" stroke="#92400E" strokeWidth="1" />
        <circle cx="19" cy="13" r="2" fill="#FEF08A" stroke="#92400E" strokeWidth="1" />
        <circle cx="61" cy="13" r="2" fill="#FEF08A" stroke="#92400E" strokeWidth="1" />
      </svg>
    );
  }

  if (rank === 'Q') {
    // ROYAL QUEEN — Jeweled tiara crown, flowing styled hair, pearl necklace, royal gown, blooming rose
    return (
      <svg viewBox="0 0 80 92" className={className} aria-hidden="true">
        <circle cx="40" cy="46" r="34" fill={pal.highlight} opacity="0.24" />

        {/* Flowing styled royal hair behind face */}
        <path
          d="M20 34 C15 48 16 64 23 70 L57 70 C64 64 65 48 60 34 C56 23 48 20 40 20 C32 20 24 23 20 34 Z"
          fill="#5B210B"
          stroke="#3B1406"
          strokeWidth="1.8"
        />

        {/* Royal Velvet Gown */}
        <path
          d="M14 88 C16 68 26 61 40 61 C54 61 64 68 66 88 Z"
          fill={pal.cloakPrimary}
          stroke="#1E293B"
          strokeWidth="2.3"
        />
        {/* Golden sweetheart bodice trim */}
        <path
          d="M27 64 Q34 72 40 67 Q46 72 53 64 L56 88 L24 88 Z"
          fill={pal.secondary}
          opacity="0.88"
        />
        <path d="M27 64 Q34 72 40 67 Q46 72 53 64" stroke="#FDE047" strokeWidth="2.2" fill="none" />

        {/* Neck & Pearl Necklace */}
        <rect x="35" y="53" width="10" height="10" rx="4" fill="#FDE1C9" />
        <circle cx="33" cy="61" r="2.1" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.9" />
        <circle cx="36.5" cy="63" r="2.1" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.9" />
        <circle cx="40" cy="63.8" r="2.4" fill="#FBBF24" stroke="#92400E" strokeWidth="0.9" />
        <circle cx="43.5" cy="63" r="2.1" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.9" />
        <circle cx="47" cy="61" r="2.1" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.9" />

        {/* Face */}
        <ellipse cx="40" cy="41" rx="15" ry="16.5" fill="#FFE0C8" stroke="#9A5B36" strokeWidth="1.6" />
        {/* Hair bangs framing forehead */}
        <path d="M25 36 Q33 27 40 31 Q47 27 55 36 Q52 24 40 24 Q28 24 25 36 Z" fill="#6D280E" />

        {/* Expressive eyes with lashes */}
        <circle cx="33.5" cy="40" r="2.3" fill="#1E293B" />
        <circle cx="46.5" cy="40" r="2.3" fill="#1E293B" />
        <circle cx="34.2" cy="39.2" r="0.85" fill="#FFFFFF" />
        <circle cx="47.2" cy="39.2" r="0.85" fill="#FFFFFF" />
        <path d="M30 37.5 Q33.5 35.5 36.5 37.5" stroke="#3B1406" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M43.5 37.5 Q46.5 35.5 50 37.5" stroke="#3B1406" strokeWidth="1.6" strokeLinecap="round" fill="none" />

        {/* Rosy cheeks & smiling ruby lips */}
        <ellipse cx="29" cy="44.5" rx="2.8" ry="1.6" fill="#FB7185" opacity="0.58" />
        <ellipse cx="51" cy="44.5" rx="2.8" ry="1.6" fill="#FB7185" opacity="0.58" />
        <path d="M36 49 Q40 53 44 49" stroke="#E11D48" strokeWidth="2.2" strokeLinecap="round" fill="none" />

        {/* Golden Earrings */}
        <circle cx="24" cy="45" r="2.2" fill="#FBBF24" stroke="#92400E" strokeWidth="1" />
        <circle cx="56" cy="45" r="2.2" fill="#FBBF24" stroke="#92400E" strokeWidth="1" />

        {/* Queen's Jeweled Golden Tiara / Crown */}
        <path
          d="M23 28 L25 16 L33 22 L40 10 L47 22 L55 16 L57 28 Z"
          fill="#FDE047"
          stroke="#B45309"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect x="23" y="25" width="34" height="5" rx="2" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" />
        <circle cx="40" cy="27.5" r="2.4" fill={pal.primary} stroke="#FFFFFF" strokeWidth="0.9" />
        <circle cx="40" cy="10" r="2.4" fill="#F43F5E" stroke="#B45309" strokeWidth="1" />
        <circle cx="25" cy="16" r="1.9" fill="#FEF08A" stroke="#B45309" strokeWidth="1" />
        <circle cx="55" cy="16" r="1.9" fill="#FEF08A" stroke="#B45309" strokeWidth="1" />

        {/* Blooming Royal Rose held on right */}
        <line x1="63" y1="62" x2="58" y2="83" stroke="#15803D" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="64" cy="59" r="5.2" fill="#E11D48" stroke="#9F1239" strokeWidth="1.5" />
        <circle cx="64" cy="59" r="2.3" fill="#FDA4AF" />
      </svg>
    );
  }

  if (rank === 'J') {
    // ROYAL JACK — Handsome young prince/knight person with plumed royal cap, tunic, golden lance/halberd
    return (
      <svg viewBox="0 0 80 92" className={className} aria-hidden="true">
        <circle cx="40" cy="46" r="34" fill={pal.highlight} opacity="0.22" />

        {/* Golden Halberd / Lance behind left shoulder */}
        <line x1="15" y1="12" x2="17" y2="84" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
        <path d="M15 8 L22 21 L15 27 L9 21 Z" fill="#FBBF24" stroke="#92400E" strokeWidth="1.6" strokeLinejoin="round" />

        {/* Prince / Knight Royal Tunic */}
        <path
          d="M14 88 C16 67 25 60 40 60 C55 60 64 67 66 88 Z"
          fill={pal.cloakPrimary}
          stroke="#1E293B"
          strokeWidth="2.3"
        />
        {/* Golden V-collar & Knight Shield Stripe */}
        <path d="M29 61 L40 76 L51 61" fill="#FBBF24" stroke="#92400E" strokeWidth="1.6" strokeLinejoin="round" />
        <line x1="40" y1="75" x2="40" y2="88" stroke="#FDE047" strokeWidth="3" />
        {/* Crisp white ruffled collar */}
        <path d="M28 60 Q40 66 52 60 L50 56 Q40 61 30 56 Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.3" />

        {/* Neck */}
        <rect x="35" y="52" width="10" height="9" rx="3.5" fill="#F6C39A" />

        {/* Youthful Hair */}
        <path d="M22 36 C20 45 23 52 27 53 L53 53 C57 52 60 45 58 36 Z" fill="#92400E" />

        {/* Face */}
        <ellipse cx="40" cy="41" rx="15.5" ry="16" fill="#FCD5B5" stroke="#854D0E" strokeWidth="1.7" />
        <circle cx="24.5" cy="42" r="2.8" fill="#F6C39A" stroke="#854D0E" strokeWidth="1.2" />
        <circle cx="55.5" cy="42" r="2.8" fill="#F6C39A" stroke="#854D0E" strokeWidth="1.2" />

        {/* Hair bangs */}
        <path d="M25 34 Q34 27 42 32 Q50 28 55 35 L54 27 L26 27 Z" fill="#B45309" />

        {/* Bright confident eyes & smile */}
        <path d="M30 35.5 Q33.5 33.8 36.5 35.5" stroke="#5C2D0C" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M43.5 35.5 Q46.5 33.8 50 35.5" stroke="#5C2D0C" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <circle cx="33.5" cy="39.5" r="2.3" fill="#1E293B" />
        <circle cx="46.5" cy="39.5" r="2.3" fill="#1E293B" />
        <circle cx="34.2" cy="38.8" r="0.85" fill="#FFFFFF" />
        <circle cx="47.2" cy="38.8" r="0.85" fill="#FFFFFF" />
        <ellipse cx="29" cy="44" rx="2.5" ry="1.4" fill="#FB7185" opacity="0.45" />
        <ellipse cx="51" cy="44" rx="2.5" ry="1.4" fill="#FB7185" opacity="0.45" />
        <path d="M35 48.5 Q40 52.5 45 48.5" stroke="#9A3412" strokeWidth="2.1" strokeLinecap="round" fill="none" />

        {/* Plumed Royal Beret Cap with Feather */}
        <path
          d="M52 19 C60 8 70 11 66 23 C62 24 57 24 53 23 Z"
          fill="#FDE047"
          stroke="#B45309"
          strokeWidth="1.6"
        />
        <path
          d="M21 29 C19 18 32 12 45 14 C56 16 61 23 58 30 Z"
          fill={pal.cloakPrimary}
          stroke="#1E293B"
          strokeWidth="2"
        />
        {/* Gold cap band & jewel pin */}
        <path d="M22 27 Q40 31 58 28 L57 32 Q40 35 23 31 Z" fill="#FBBF24" stroke="#92400E" strokeWidth="1.4" />
        <circle cx="51" cy="24" r="3" fill="#FBBF24" stroke="#92400E" strokeWidth="1.3" />
      </svg>
    );
  }

  // JOKER — Colorful Royal Jester Person with 3-point bell hat
  return (
    <svg viewBox="0 0 80 92" className={className} aria-hidden="true">
      <circle cx="40" cy="48" r="34" fill="#FDE047" opacity="0.22" />
      {/* Jester Outfit */}
      <path d="M15 88 C17 69 27 62 40 62 C53 62 63 69 65 88 Z" fill="#7E22CE" stroke="#1E293B" strokeWidth="2.2" />
      <path d="M21 66 L30 75 L40 65 L50 75 L59 66 L54 60 L26 60 Z" fill="#FBBF24" stroke="#92400E" strokeWidth="1.5" />
      {/* Face */}
      <ellipse cx="40" cy="45" rx="14.5" ry="15" fill="#FFF7ED" stroke="#7E22CE" strokeWidth="1.8" />
      <circle cx="34" cy="43" r="2.3" fill="#1E293B" />
      <circle cx="46" cy="43" r="2.3" fill="#1E293B" />
      <circle cx="40" cy="46.5" r="2.2" fill="#EF4444" />
      <path d="M33 51 Q40 57 47 51" stroke="#DC2626" strokeWidth="2.3" strokeLinecap="round" fill="none" />
      {/* 3-Prong Colorful Jester Hat */}
      <path d="M26 35 C15 24 14 14 24 17 C29 19 32 25 34 31 Z" fill="#DC2626" stroke="#1E293B" strokeWidth="1.8" />
      <path d="M54 35 C65 24 66 14 56 17 C51 19 48 25 46 31 Z" fill="#10B981" stroke="#1E293B" strokeWidth="1.8" />
      <path d="M32 32 C34 15 46 15 48 32 Z" fill="#F59E0B" stroke="#1E293B" strokeWidth="1.8" />
      {/* Golden Bells */}
      <circle cx="19" cy="17" r="3.2" fill="#FDE047" stroke="#92400E" strokeWidth="1.3" />
      <circle cx="61" cy="17" r="3.2" fill="#FDE047" stroke="#92400E" strokeWidth="1.3" />
      <circle cx="40" cy="15" r="3.4" fill="#FDE047" stroke="#92400E" strokeWidth="1.3" />
    </svg>
  );
};

export function isCourtRank(rank: Rank): rank is 'J' | 'Q' | 'K' | 'JOKER' {
  return rank === 'J' || rank === 'Q' || rank === 'K' || rank === 'JOKER';
}

/* ============================================================================
 * SUPER ACE CLASSIC ILLUSTRATED CARD ARTWORK (Reference-Matched Vector SVG)
 * ========================================================================== */

/** Black Spade with gleaming metallic gold outline & bold golden "ACE" center */
export const SuperAceSpadeEmblem: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 80 86" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="saGoldRim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFF4B0" />
        <stop offset="45%" stopColor="#F5B82E" />
        <stop offset="100%" stopColor="#B8730B" />
      </linearGradient>
      <linearGradient id="saSpadeFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#262A36" />
        <stop offset="45%" stopColor="#0D1018" />
        <stop offset="100%" stopColor="#05070B" />
      </linearGradient>
    </defs>
    {/* Spade stem */}
    <path
      d="M35 58 L25 79 L55 79 L45 58 Z"
      fill="url(#saSpadeFill)"
      stroke="url(#saGoldRim)"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    {/* Spade body */}
    <path
      d="M40 7 C44 13 73 34 73 50 C73 61.5 63.5 68 53 68 C46.8 68 42.6 64.8 40 61.2 C37.4 64.8 33.2 68 27 68 C16.5 68 7 61.5 7 50 C7 34 36 13 40 7 Z"
      fill="url(#saSpadeFill)"
      stroke="url(#saGoldRim)"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
    {/* Glossy top highlight */}
    <path
      d="M40 15 C34 23 19 36 18 47 C18 52 21 55 25 55 C23 47 28 34 40 22 Z"
      fill="#FFFFFF"
      opacity="0.16"
    />
    {/* Gold ACE Typography */}
    <text
      x="40"
      y="52"
      textAnchor="middle"
      fill="url(#saGoldRim)"
      fontFamily="Georgia, serif"
      fontWeight="900"
      fontSize="16.5"
      letterSpacing="0.8"
    >
      ACE
    </text>
  </svg>
);

/** Classic Illustrated Super Ace King (5-point jeweled gold crown, full beard, blue-and-red royal robe) */
export const SuperAceKingPortrait: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 88 96" className={className} aria-hidden="true">
    {/* Royal Blue & Red Diamond-Pattern Mantle */}
    <path
      d="M8 94 C11 72 23 66 44 66 C65 66 77 72 80 94 Z"
      fill="#1D4ED8"
      stroke="#111827"
      strokeWidth="2.4"
    />
    {/* Red collar / robe inlays */}
    <path d="M20 71 L44 94 L68 71 L58 67 L44 82 L30 67 Z" fill="#DC2626" stroke="#111827" strokeWidth="1.8" />
    <path d="M29 68 L44 85 L59 68 L44 74 Z" fill="#FFFFFF" stroke="#111827" strokeWidth="1.6" />
    {/* Decorative diamond checks on shoulders */}
    <polygon points="18,83 24,78 30,83 24,88" fill="#FBBF24" stroke="#111827" strokeWidth="1.2" />
    <polygon points="58,83 64,78 70,83 64,88" fill="#FBBF24" stroke="#111827" strokeWidth="1.2" />
    <circle cx="44" cy="87" r="3" fill="#FBBF24" stroke="#111827" strokeWidth="1.2" />

    {/* Curly Golden-Brown Hair Sides */}
    <path
      d="M21 36 C17 44 17 58 23 64 L65 64 C71 58 71 44 67 36 Z"
      fill="#B47B2B"
      stroke="#111827"
      strokeWidth="2.2"
    />
    {/* Curly hair ridges */}
    <path d="M22 44 Q18 48 22 52 Q18 56 23 60" stroke="#111827" strokeWidth="1.5" fill="none" />
    <path d="M66 44 Q70 48 66 52 Q70 56 65 60" stroke="#111827" strokeWidth="1.5" fill="none" />

    {/* Face */}
    <path
      d="M28 36 L60 36 L60 58 C60 66 52 72 44 72 C36 72 28 66 28 58 Z"
      fill="#FBF5EE"
      stroke="#111827"
      strokeWidth="2.2"
    />
    {/* Eyebrows & Regal Eyes */}
    <path d="M32 43 Q36.5 40.5 41 43" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <path d="M47 43 Q51.5 40.5 56 43" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <ellipse cx="36.5" cy="46.5" rx="2.6" ry="1.8" fill="#FFFFFF" stroke="#111827" strokeWidth="1.4" />
    <ellipse cx="51.5" cy="46.5" rx="2.6" ry="1.8" fill="#FFFFFF" stroke="#111827" strokeWidth="1.4" />
    <circle cx="36.8" cy="46.5" r="1.4" fill="#111827" />
    <circle cx="51.2" cy="46.5" r="1.4" fill="#111827" />
    {/* Nose */}
    <path d="M44 44 L43 52 L46 53" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" fill="none" />

    {/* Stylized White-Silver Playing-Card Beard & Mustache */}
    <path
      d="M27 56 C27 68 35 75 44 75 C53 75 61 68 61 56 C57 58 52 57 44 56 C36 57 31 58 27 56 Z"
      fill="#F3F4F6"
      stroke="#111827"
      strokeWidth="2"
    />
    <path d="M32 61 Q38 68 35 72" stroke="#6B7280" strokeWidth="1.3" fill="none" />
    <path d="M44 62 L44 74" stroke="#6B7280" strokeWidth="1.3" fill="none" />
    <path d="M56 61 Q50 68 53 72" stroke="#6B7280" strokeWidth="1.3" fill="none" />
    <path
      d="M32 58 Q38 54 44 57 Q50 54 56 58 Q51 62 44 60 Q37 62 32 58 Z"
      fill="#E5E7EB"
      stroke="#111827"
      strokeWidth="1.6"
    />
    <path d="M40 62 Q44 64 48 62" stroke="#111827" strokeWidth="1.6" fill="none" />

    {/* Classic 4-Peak Golden King Crown with Blue Band */}
    <path
      d="M22 36 L22 14 L31 24 L40 12 L48 24 L57 12 L66 24 L66 36 Z"
      fill="#FBBF24"
      stroke="#111827"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <rect x="22" y="31" width="44" height="6" fill="#1D4ED8" stroke="#111827" strokeWidth="1.8" />
    {/* Crown Diamonds */}
    <polygon points="31,27 33.5,24.5 36,27 33.5,29.5" fill="#111827" />
    <polygon points="41.5,27 44,24.5 46.5,27 44,29.5" fill="#DC2626" />
    <polygon points="52,27 54.5,24.5 57,27 54.5,29.5" fill="#111827" />
  </svg>
);

/** Classic Illustrated Super Ace Queen (crimson beaded crown/veil, noble face, crimson-white royal gown) */
export const SuperAceQueenPortrait: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 88 96" className={className} aria-hidden="true">
    {/* Flowing Red Veil & Mantle Behind */}
    <path
      d="M12 94 C13 70 21 52 24 30 L64 30 C67 52 75 70 76 94 Z"
      fill="#B91C1C"
      stroke="#111827"
      strokeWidth="2.3"
    />
    {/* Gray-Silver Wavy Hair under Veil */}
    <path
      d="M24 34 C20 50 22 68 27 74 L61 74 C66 68 68 50 64 34 Z"
      fill="#9CA3AF"
      stroke="#111827"
      strokeWidth="1.8"
    />
    {/* Royal Red Gown & Decorative White Collar */}
    <path
      d="M14 94 C17 75 28 69 44 69 C60 69 71 75 74 94 Z"
      fill="#DC2626"
      stroke="#111827"
      strokeWidth="2.2"
    />
    <path
      d="M25 71 Q44 85 63 71 L58 65 Q44 76 30 65 Z"
      fill="#FFFFFF"
      stroke="#111827"
      strokeWidth="1.8"
    />
    {/* Collar studs */}
    <circle cx="34" cy="72" r="1.4" fill="#111827" />
    <circle cx="44" cy="76" r="1.6" fill="#DC2626" />
    <circle cx="54" cy="72" r="1.4" fill="#111827" />
    {/* Golden chest trim */}
    <path d="M29 82 L44 94 L59 82" stroke="#FBBF24" strokeWidth="2.4" fill="none" />

    {/* Face */}
    <ellipse cx="44" cy="49" rx="15" ry="18" fill="#FBF5EE" stroke="#111827" strokeWidth="2.1" />
    {/* Parted dark-silver hair bangs */}
    <path d="M29 44 Q37 35 44 38 Q51 35 59 44 Q56 32 44 32 Q32 32 29 44 Z" fill="#4B5563" stroke="#111827" strokeWidth="1.5" />

    {/* Expressive Queen Eyes */}
    <path d="M33 45 Q37 43 40.5 45" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    <path d="M47.5 45 Q51 43 55 45" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    <ellipse cx="37" cy="48.5" rx="2.5" ry="1.8" fill="#FFFFFF" stroke="#111827" strokeWidth="1.4" />
    <ellipse cx="51" cy="48.5" rx="2.5" ry="1.8" fill="#FFFFFF" stroke="#111827" strokeWidth="1.4" />
    <circle cx="37" cy="48.5" r="1.4" fill="#111827" />
    <circle cx="51" cy="48.5" r="1.4" fill="#111827" />
    {/* Nose & Ruby Lips */}
    <path d="M44 47 L43.2 54 L45.2 54.5" stroke="#111827" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    <path d="M39.5 59 Q44 62 48.5 59 Q44 57.5 39.5 59 Z" fill="#DC2626" stroke="#111827" strokeWidth="1.2" />

    {/* Classic Crimson & Dark-Maroon Royal Queen Crown */}
    <path
      d="M24 33 L24 19 L44 13 L64 19 L64 33 Z"
      fill="#7F1D1D"
      stroke="#111827"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <rect x="24" y="25" width="40" height="8" fill="#DC2626" stroke="#111827" strokeWidth="1.8" />
    {/* Crown Crosses / Studs */}
    <path d="M31 27 V31 M29 29 H33" stroke="#111827" strokeWidth="1.6" />
    <path d="M40 27 V31 M38 29 H42" stroke="#111827" strokeWidth="1.6" />
    <path d="M48 27 V31 M46 29 H50" stroke="#111827" strokeWidth="1.6" />
    <path d="M57 27 V31 M55 29 H59" stroke="#111827" strokeWidth="1.6" />
  </svg>
);

/** Classic Illustrated Super Ace Jack (profile prince with navy royal cap, blonde curls, white/navy tunic) */
export const SuperAceJackPortrait: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 88 96" className={className} aria-hidden="true">
    {/* Royal White & Navy Shoulders/Tunic */}
    <path
      d="M12 94 C16 74 27 67 48 67 C65 67 74 73 78 94 Z"
      fill="#FFFFFF"
      stroke="#111827"
      strokeWidth="2.3"
    />
    <path d="M22 73 L46 94 L72 70 L64 67 L46 84 L28 69 Z" fill="#1E3A8A" stroke="#111827" strokeWidth="1.8" />
    <path d="M16 86 L28 94 L35 88 L22 78 Z" fill="#1E3A8A" stroke="#111827" strokeWidth="1.6" />
    <path d="M62 78 L75 94 L60 94 Z" fill="#B91C1C" stroke="#111827" strokeWidth="1.6" />

    {/* Neck */}
    <path d="M42 58 L42 74 L58 70 L56 54 Z" fill="#FBF5EE" stroke="#111827" strokeWidth="1.8" />

    {/* Profile Head facing left (matching reference screenshot!) */}
    <path
      d="M32 34 L62 34 L62 56 C62 65 54 69 44 69 C36 69 32 65 32 58 L27 54 L31 48 Z"
      fill="#FBF5EE"
      stroke="#111827"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    {/* Profile Eye, Brow & Mouth */}
    <path d="M34 43 Q38 41 42 43" stroke="#111827" strokeWidth="1.9" strokeLinecap="round" fill="none" />
    <ellipse cx="38" cy="46.5" rx="2.6" ry="1.8" fill="#FFFFFF" stroke="#111827" strokeWidth="1.4" />
    <circle cx="37.2" cy="46.5" r="1.4" fill="#111827" />
    <path d="M32 59 Q36 60 39 58.5" stroke="#111827" strokeWidth="1.7" strokeLinecap="round" fill="none" />

    {/* Flowing Blonde Curls at Back of Head */}
    <path
      d="M50 34 C56 34 69 36 72 44 C75 52 72 62 64 64 C56 66 50 61 52 54 C48 50 50 42 50 34 Z"
      fill="#FDE68A"
      stroke="#111827"
      strokeWidth="2"
    />
    <path d="M56 42 Q64 44 62 50 Q57 52 56 47" stroke="#92400E" strokeWidth="1.4" fill="none" />
    <path d="M60 52 Q68 54 65 60 Q58 61 58 56" stroke="#92400E" strokeWidth="1.4" fill="none" />

    {/* Classic Navy-Blue Jack Cap with White Band */}
    <path
      d="M27 22 L72 22 L70 34 L29 34 Z"
      fill="#1E3A8A"
      stroke="#111827"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <rect x="29" y="30" width="41" height="5.5" fill="#F9FAFB" stroke="#111827" strokeWidth="1.8" />
  </svg>
);

/** Classic Solid Super Ace Suit Pip (matches reference screenshot's clean dark spade / crimson heart / diamond / club) */
export const SuperAceSuitPip: React.FC<{ suit: '♠' | '♥' | '♦' | '♣'; className?: string }> = ({
  suit,
  className = 'w-full h-full',
}) => {
  if (suit === '♠') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <path
          d="M28 43 L21 57 L43 57 L36 43 Z"
          fill="#111827"
        />
        <path
          d="M32 6 C35 11 55 26 55 38 C55 46.5 48 51 41 51 C36.5 51 33.8 48.8 32 46.2 C30.2 48.8 27.5 51 23 51 C16 51 9 46.5 9 38 C9 26 29 11 32 6 Z"
          fill="#111827"
        />
      </svg>
    );
  }
  if (suit === '♥') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <path
          d="M32 56 C29 53 9 38 9 23 C9 13 16.5 7 24 7 C28.6 7 30.8 9.6 32 12.2 C33.2 9.6 35.4 7 40 7 C47.5 7 55 13 55 23 C55 38 35 53 32 56 Z"
          fill="#991B1B"
        />
      </svg>
    );
  }
  if (suit === '♦') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <polygon points="32,6 54,32 32,58 10,32" fill="#B91C1C" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M28 39 L22 57 L42 57 L36 39 Z" fill="#111827" />
      <circle cx="32" cy="19" r="12.5" fill="#111827" />
      <circle cx="18.5" cy="34.5" r="12" fill="#111827" />
      <circle cx="45.5" cy="34.5" r="12" fill="#111827" />
      <circle cx="32" cy="30" r="8" fill="#111827" />
    </svg>
  );
};

/** Radiant Golden-Red Jester Crown WILD Emblem (matching Screenshot_20261121-025009) */
export const SuperAceWildCrown: React.FC<{ isMulti?: boolean; className?: string }> = ({
  isMulti = false,
  className = 'w-full h-full',
}) => (
  <svg viewBox="0 0 92 92" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="wildGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFF8B8" />
        <stop offset="48%" stopColor="#FACC15" />
        <stop offset="100%" stopColor="#C27803" />
      </linearGradient>
      <linearGradient id="wildRed" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#991B1B" />
      </linearGradient>
    </defs>
    {/* Inner sunburst halo */}
    <circle cx="46" cy="40" r="34" fill="#FEF08A" opacity="0.32" />
    {/* Back Red Jester Prongs */}
    <path
      d="M22 54 C14 36 12 22 22 24 C29 26 33 36 37 46 Z"
      fill="url(#wildRed)"
      stroke="#7C2D12"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    <path
      d="M70 54 C78 36 80 22 70 24 C63 26 59 36 55 46 Z"
      fill="url(#wildRed)"
      stroke="#7C2D12"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    {/* Center Tall Golden Crown Prong */}
    <path
      d="M27 56 L14 28 L35 42 L46 14 L57 42 L78 28 L65 56 Z"
      fill="url(#wildGold)"
      stroke="#7C2D12"
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
    {/* Crown Base Band */}
    <rect x="25" y="50" width="42" height="10" rx="4" fill="url(#wildGold)" stroke="#7C2D12" strokeWidth="2.2" />
    {/* Crown Tip Golden Orbs */}
    <circle cx="14" cy="26" r="4.5" fill="#FEF08A" stroke="#92400E" strokeWidth="1.8" />
    <circle cx="46" cy="13" r="5.5" fill="#FEF08A" stroke="#92400E" strokeWidth="1.8" />
    <circle cx="78" cy="26" r="4.5" fill="#FEF08A" stroke="#92400E" strokeWidth="1.8" />
    {/* Bold WILD Banner */}
    <rect x="8" y="62" width="76" height="24" rx="5" fill="#7F1D1D" stroke="#FDE047" strokeWidth="2" />
    <text
      x="46"
      y="79.5"
      textAnchor="middle"
      fill="#FEF08A"
      fontFamily="Impact, system-ui, sans-serif"
      fontWeight="900"
      fontSize={isMulti ? '15.5' : '19'}
      letterSpacing="0.8"
    >
      {isMulti ? 'WILD ×2' : 'WILD'}
    </text>
  </svg>
);

/** Radiant Golden Star SCATTER Emblem */
export const SuperAceScatterEmblem: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 92 92" className={className} aria-hidden="true">
    <defs>
      <radialGradient id="scatCoin" cx="50%" cy="40%" r="55%">
        <stop offset="0%" stopColor="#FFFDE0" />
        <stop offset="55%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#B45309" />
      </radialGradient>
    </defs>
    <circle cx="46" cy="40" r="31" fill="url(#scatCoin)" stroke="#FEF08A" strokeWidth="3" />
    <circle cx="46" cy="40" r="24" fill="none" stroke="#92400E" strokeWidth="1.8" strokeDasharray="4 3" />
    <polygon
      points="46,18 52,32 67,34 56,44 59,58 46,51 33,58 36,44 25,34 40,32"
      fill="#DC2626"
      stroke="#FEF08A"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <rect x="7" y="64" width="78" height="22" rx="5" fill="#7C2D12" stroke="#FEF08A" strokeWidth="2" />
    <text
      x="46"
      y="79.5"
      textAnchor="middle"
      fill="#FEF08A"
      fontFamily="Impact, system-ui, sans-serif"
      fontWeight="900"
      fontSize="14.5"
      letterSpacing="0.8"
    >
      SCATTER
    </text>
  </svg>
);

