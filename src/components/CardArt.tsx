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
