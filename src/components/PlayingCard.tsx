import React from 'react';
import { motion } from 'motion/react';
import type { PlayingCardData, Rank } from '../types';
import { BoldSuitIcon, CourtPortrait, isCourtRank, SUIT_PALETTES } from './CardArt';

interface PlayingCardProps {
  card?: PlayingCardData;
  layoutId?: string;
  faceDown?: boolean;
  selected?: boolean;
  compact?: boolean;
  fanMode?: boolean;
  draggable?: boolean;
  backLabel?: string;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLButtonElement>) => void;
}

interface PipCoord {
  x: number; // % inside inner pip field
  y: number; // % inside inner pip field
  flip?: boolean;
}

/**
 * Authentic casino playing card pip coordinates for number cards 2 through 10.
 * Lower pips invert 180° just like a real Bicycle / Bee physical playing card deck.
 */
const PIP_LAYOUTS: Partial<Record<Rank, PipCoord[]>> = {
  '2': [
    { x: 50, y: 18 },
    { x: 50, y: 82, flip: true },
  ],
  '3': [
    { x: 50, y: 16 },
    { x: 50, y: 50 },
    { x: 50, y: 84, flip: true },
  ],
  '4': [
    { x: 28, y: 18 },
    { x: 72, y: 18 },
    { x: 28, y: 82, flip: true },
    { x: 72, y: 82, flip: true },
  ],
  '5': [
    { x: 28, y: 18 },
    { x: 72, y: 18 },
    { x: 50, y: 50 },
    { x: 28, y: 82, flip: true },
    { x: 72, y: 82, flip: true },
  ],
  '6': [
    { x: 28, y: 16 },
    { x: 72, y: 16 },
    { x: 28, y: 50 },
    { x: 72, y: 50 },
    { x: 28, y: 84, flip: true },
    { x: 72, y: 84, flip: true },
  ],
  '7': [
    { x: 28, y: 16 },
    { x: 72, y: 16 },
    { x: 50, y: 33 },
    { x: 28, y: 50 },
    { x: 72, y: 50 },
    { x: 28, y: 84, flip: true },
    { x: 72, y: 84, flip: true },
  ],
  '8': [
    { x: 28, y: 16 },
    { x: 72, y: 16 },
    { x: 50, y: 33 },
    { x: 28, y: 50 },
    { x: 72, y: 50 },
    { x: 50, y: 67, flip: true },
    { x: 28, y: 84, flip: true },
    { x: 72, y: 84, flip: true },
  ],
  '9': [
    { x: 28, y: 14 },
    { x: 72, y: 14 },
    { x: 28, y: 38 },
    { x: 72, y: 38 },
    { x: 50, y: 50 },
    { x: 28, y: 62, flip: true },
    { x: 72, y: 62, flip: true },
    { x: 28, y: 86, flip: true },
    { x: 72, y: 86, flip: true },
  ],
  '10': [
    { x: 28, y: 14 },
    { x: 72, y: 14 },
    { x: 50, y: 26 },
    { x: 28, y: 38 },
    { x: 72, y: 38 },
    { x: 28, y: 62, flip: true },
    { x: 72, y: 62, flip: true },
    { x: 50, y: 74, flip: true },
    { x: 28, y: 86, flip: true },
    { x: 72, y: 86, flip: true },
  ],
};

const MELD_RING_COLORS = [
  '',
  'ring-2 ring-emerald-400',
  'ring-2 ring-sky-400',
  'ring-2 ring-amber-400',
  'ring-2 ring-pink-400',
];

const LAYOUT_SPRING = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 32,
  mass: 0.8,
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  layoutId,
  faceDown = false,
  selected = false,
  compact = false,
  fanMode = false,
  draggable = false,
  backLabel,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const sizeClass = fanMode
    ? 'w-[58px] h-[84px] sm:w-[70px] sm:h-[102px] md:w-[78px] md:h-[112px]'
    : compact
      ? 'w-[52px] h-[74px] sm:w-[62px] sm:h-[90px]'
      : 'w-[66px] h-[96px] sm:w-[78px] sm:h-[114px]';

  if (faceDown || !card) {
    return (
      <motion.div
        layout={Boolean(layoutId)}
        layoutId={layoutId}
        transition={{ layout: LAYOUT_SPRING }}
        className="inline-flex"
      >
        <button
          type="button"
          onClick={onClick}
          className={`${sizeClass} rounded-xl bg-[#fffef9] p-[3px] shadow-[0_6px_14px_rgba(0,0,0,0.5)] border border-stone-300/90 flex items-center justify-center relative cursor-pointer transition-transform duration-150 hover:-translate-y-1 active:scale-95 focus-visible:outline-2 focus-visible:outline-amber-400`}
        >
          <div className="card-back-pattern w-full h-full rounded-[8px] p-1 flex items-center justify-center relative overflow-hidden">
            <div className="w-full h-full rounded-[5px] border border-amber-300/70 flex flex-col items-center justify-center bg-red-950/20">
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full border border-amber-300/80 bg-red-950/75 flex items-center justify-center shadow-inner">
                <span className="text-amber-300 text-xs sm:text-sm leading-none font-black">♠</span>
              </div>
              {backLabel && (
                <span className="mt-1 rounded bg-black/75 px-1 py-0.5 text-[7px] sm:text-[8px] font-extrabold tracking-wider text-amber-200 leading-tight text-center uppercase border border-amber-400/40">
                  {backLabel}
                </span>
              )}
            </div>
          </div>
        </button>
      </motion.div>
    );
  }

  const palette = SUIT_PALETTES[card.suit] ?? SUIT_PALETTES['♠'];
  const courtCard = card.isJoker || isCourtRank(card.rank);
  const portraitRank = card.isJoker ? 'JOKER' : (card.rank as 'J' | 'Q' | 'K');
  const isAce = card.rank === 'A';
  const pips = !courtCard && !isAce ? PIP_LAYOUTS[card.rank] : undefined;

  const meldRing = card.meldGroup && !fanMode
    ? MELD_RING_COLORS[((card.meldGroup - 1) % (MELD_RING_COLORS.length - 1)) + 1]
    : '';

  // Pip icon size scales cleanly so 9 and 10 pips stay crisp and non-overlapping
  const pipCount = pips?.length ?? 0;
  const pipSizeClass = compact
    ? pipCount >= 8
      ? 'w-[10px] h-[10px] sm:w-[12px] sm:h-[12px]'
      : pipCount >= 5
        ? 'w-[11px] h-[11px] sm:w-[13px] sm:h-[13px]'
        : 'w-[13px] h-[13px] sm:w-[16px] sm:h-[16px]'
    : pipCount >= 8
      ? 'w-[12px] h-[12px] sm:w-[14px] sm:h-[14px]'
      : pipCount >= 5
        ? 'w-[13px] h-[13px] sm:w-[16px] sm:h-[16px]'
        : 'w-[16px] h-[16px] sm:w-[19px] sm:h-[19px]';

  const rankLabel = card.isJoker ? 'JK' : card.rank;

  return (
    <motion.div
      layout={Boolean(layoutId)}
      layoutId={layoutId}
      transition={{ layout: LAYOUT_SPRING }}
      className="inline-flex"
    >
      <button
        type="button"
        draggable={draggable}
        onClick={onClick}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        aria-label={card.isJoker ? 'Joker card' : `${card.rank} of ${palette.name}`}
        className={`playing-card-face ${sizeClass} rounded-xl relative cursor-pointer overflow-hidden border border-stone-300/95 focus-visible:outline-2 focus-visible:outline-amber-400 ${palette.textClass} ${selected ? 'playing-card-selected z-20' : meldRing}`}
      >
        {/* Subtle real-card inner ivory hairline */}
        <div
          className="pointer-events-none absolute inset-[2px] rounded-[9px] border border-stone-200/80"
          aria-hidden="true"
        />

        {/* TOP-LEFT TRADITIONAL STACKED INDEX (Oversized & bold in fanMode so overlapping cards stay 100% legible) */}
        <div
          className={`absolute z-10 flex flex-col items-center leading-none ${
            fanMode
              ? 'top-[4px] left-[4px] sm:top-[5px] sm:left-[5px]'
              : compact
                ? 'top-[3px] left-[3px]'
                : 'top-[4px] left-[4px]'
          }`}
        >
          <span
            className={`font-display font-black tracking-tighter leading-[0.9] ${
              fanMode
                ? card.rank === '10'
                  ? 'text-[14px] sm:text-[17px] md:text-[19px]'
                  : 'text-[17px] sm:text-[21px] md:text-[23px]'
                : compact
                  ? card.rank === '10'
                    ? 'text-[10px] sm:text-[11px]'
                    : 'text-[11px] sm:text-[13px]'
                  : card.rank === '10'
                    ? 'text-[11px] sm:text-[13px]'
                    : 'text-[13px] sm:text-[15px]'
            }`}
          >
            {rankLabel}
          </span>
          <BoldSuitIcon
            suit={card.suit}
            className={
              fanMode
                ? 'w-[12px] h-[12px] sm:w-[15px] sm:h-[15px] md:w-[16px] md:h-[16px] mt-[2px]'
                : compact
                  ? 'w-[9px] h-[9px] sm:w-[11px] sm:h-[11px] mt-[1px]'
                  : 'w-[11px] h-[11px] sm:w-[13px] sm:h-[13px] mt-[1px]'
            }
          />
        </div>

        {/* BOTTOM-RIGHT INVERTED STACKED INDEX (Hidden in fanMode for cleaner classic mobile card face) */}
        {!fanMode && (
          <div
            className={`absolute z-10 flex flex-col items-center leading-none rotate-180 ${
              compact ? 'bottom-[3px] right-[3px]' : 'bottom-[4px] right-[4px]'
            }`}
          >
            <span
              className={`font-display font-black tracking-tighter leading-[0.95] ${
                compact
                  ? card.rank === '10'
                    ? 'text-[10px] sm:text-[11px]'
                    : 'text-[11px] sm:text-[13px]'
                  : card.rank === '10'
                    ? 'text-[11px] sm:text-[13px]'
                    : 'text-[13px] sm:text-[15px]'
              }`}
            >
              {rankLabel}
            </span>
            <BoldSuitIcon
              suit={card.suit}
              className={compact ? 'w-[9px] h-[9px] sm:w-[11px] sm:h-[11px] mt-[1px]' : 'w-[11px] h-[11px] sm:w-[13px] sm:h-[13px] mt-[1px]'}
            />
          </div>
        )}

        {/* Meld Group Badge (bottom-left when not in fanMode) */}
        {card.meldGroup && !fanMode ? (
          <span className="absolute bottom-[3px] left-[3px] z-20 rounded bg-emerald-700 px-1 py-[1px] text-[7px] sm:text-[8px] font-black text-white leading-none shadow">
            M{card.meldGroup}
          </span>
        ) : null}

        {/* REAL CARD CENTER FACE: Court Portrait / Ornate Ace / Big Center Pip in fanMode / Authentic 2–10 Pip Grid */}
        <div
          className={`absolute inset-0 flex items-center justify-center ${
            fanMode
              ? 'pl-[18px] pr-[4px] pt-[20px] pb-[6px] sm:pl-[22px] sm:pr-[5px] sm:pt-[24px] sm:pb-[8px]'
              : compact
                ? 'px-[11px] py-[7px] sm:px-[13px] sm:py-[8px]'
                : 'px-[13px] py-[8px] sm:px-[15px] sm:py-[10px]'
          }`}
        >
          {fanMode && !courtCard ? (
            <div className="w-full h-full flex items-end justify-end pr-[2px] pb-[2px]">
              <BoldSuitIcon
                suit={card.suit}
                className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11"
              />
            </div>
          ) : courtCard ? (
            <div
              className={`w-full h-full rounded-[6px] border ${palette.frameBorder} ring-1 ring-inset ring-amber-400/50 bg-gradient-to-b ${palette.frameBg} flex items-center justify-center overflow-hidden shadow-inner relative`}
            >
              {/* Tiny authentic court inner-frame corner suits */}
              <BoldSuitIcon
                suit={card.suit}
                className="absolute top-[2px] right-[2px] w-[8px] h-[8px] sm:w-[10px] sm:h-[10px] opacity-85"
              />
              <BoldSuitIcon
                suit={card.suit}
                className="absolute bottom-[2px] left-[2px] w-[8px] h-[8px] sm:w-[10px] sm:h-[10px] rotate-180 opacity-85"
              />
              <CourtPortrait rank={portraitRank} suit={card.suit} className="w-[92%] h-[92%]" />
            </div>
          ) : isAce ? (
            <div className="w-full h-full flex items-center justify-center">
              <div
                className={`rounded-full border border-amber-400/75 bg-gradient-to-b ${palette.frameBg} flex items-center justify-center shadow-inner ${
                  compact ? 'p-1.5 sm:p-2' : 'p-2 sm:p-2.5'
                }`}
              >
                <BoldSuitIcon
                  suit={card.suit}
                  className={compact ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-9 h-9 sm:w-11 sm:h-11'}
                />
              </div>
            </div>
          ) : pips ? (
            <div className="relative w-full h-full">
              {pips.map((pip, idx) => (
                <div
                  key={idx}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center ${
                    pip.flip ? 'rotate-180' : ''
                  }`}
                  style={{ left: `${pip.x}%`, top: `${pip.y}%` }}
                >
                  <BoldSuitIcon suit={card.suit} className={pipSizeClass} />
                </div>
              ))}
            </div>
          ) : (
            <BoldSuitIcon
              suit={card.suit}
              className={compact ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-9 h-9 sm:w-10 sm:h-10'}
            />
          )}
        </div>
      </button>
    </motion.div>
  );
};
