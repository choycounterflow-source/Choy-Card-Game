import type { PlayingCardData, Rank, Suit } from '../types';

const SUITS: Array<{ suit: Suit; isRed: boolean }> = [
  { suit: '♠', isRed: false },
  { suit: '♥', isRed: true },
  { suit: '♣', isRed: false },
  { suit: '♦', isRed: true },
];

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createShuffledDeck(includeJokers = false): PlayingCardData[] {
  const deck: PlayingCardData[] = [];
  let seq = 0;

  for (const s of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      const rank = RANKS[i];
      deck.push({
        id: `c-${seq++}-${rank}-${s.suit}-${Math.random().toString(36).slice(2, 6)}`,
        rank,
        suit: s.suit,
        value: i + 1,
        isRed: s.isRed,
      });
    }
  }

  if (includeJokers) {
    deck.push({
      id: `c-joker-1-${Math.random().toString(36).slice(2, 6)}`,
      rank: 'JOKER',
      suit: '★',
      value: 0,
      isRed: true,
      isJoker: true,
    });
    deck.push({
      id: `c-joker-2-${Math.random().toString(36).slice(2, 6)}`,
      rank: 'JOKER',
      suit: '★',
      value: 0,
      isRed: false,
      isJoker: true,
    });
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function cardDeadwoodPoints(card: PlayingCardData): number {
  if (card.isJoker) return 0;
  if (card.value >= 10) return 10;
  return card.value;
}

export function calculateDeadwood(cards: PlayingCardData[]): number {
  return cards.reduce((sum, c) => sum + (c.meldGroup ? 0 : cardDeadwoodPoints(c)), 0);
}

/**
 * Tong-its / Tsekitsa Auto-Meld (Plastar) Engine:
 * Finds valid same-suit runs (3+ consecutive) and sets (3-4 of a kind),
 * tags them with meldGroup IDs, and arranges melds cleanly on the left
 * followed by sorted deadwood on the right.
 */
export function autoMeldHand(hand: PlayingCardData[]): {
  arranged: PlayingCardData[];
  melds: PlayingCardData[][];
  deadwood: PlayingCardData[];
} {
  const pool = hand.map((c) => ({ ...c, meldGroup: undefined as number | undefined }));
  const usedIds = new Set<string>();
  const melds: PlayingCardData[][] = [];
  let groupId = 1;

  // 1. Find Same-Suit Runs (3+ consecutive ranks)
  const bySuit = new Map<Suit, PlayingCardData[]>();
  for (const c of pool) {
    if (c.isJoker) continue;
    const list = bySuit.get(c.suit) || [];
    list.push(c);
    bySuit.set(c.suit, list);
  }

  for (const cards of bySuit.values()) {
    cards.sort((a, b) => a.value - b.value);
    let run: PlayingCardData[] = [];
    for (const card of cards) {
      if (run.length === 0) {
        run = [card];
      } else if (card.value === run[run.length - 1].value + 1) {
        run.push(card);
      } else if (card.value === run[run.length - 1].value) {
        continue;
      } else {
        if (run.length >= 3) {
          const g = groupId++;
          run.forEach((r) => {
            r.meldGroup = g;
            usedIds.add(r.id);
          });
          melds.push([...run]);
        }
        run = [card];
      }
    }
    if (run.length >= 3) {
      const g = groupId++;
      run.forEach((r) => {
        r.meldGroup = g;
        usedIds.add(r.id);
      });
      melds.push([...run]);
    }
  }

  // 2. Find Sets (3 or 4 of a kind) from remaining unused cards
  const byRank = new Map<Rank, PlayingCardData[]>();
  for (const c of pool) {
    if (usedIds.has(c.id) || c.isJoker) continue;
    const list = byRank.get(c.rank) || [];
    list.push(c);
    byRank.set(c.rank, list);
  }

  for (const cards of byRank.values()) {
    if (cards.length >= 3) {
      const g = groupId++;
      cards.forEach((r) => {
        r.meldGroup = g;
        usedIds.add(r.id);
      });
      melds.push([...cards]);
    }
  }

  // 3. Attach Jokers to pairs to complete sets if any jokers remain
  const jokers = pool.filter((c) => c.isJoker && !usedIds.has(c.id));
  if (jokers.length > 0) {
    for (const cards of byRank.values()) {
      if (cards.length === 2 && jokers.length > 0 && !usedIds.has(cards[0].id)) {
        const j = jokers.pop()!;
        const g = groupId++;
        const formed = [...cards, j];
        formed.forEach((r) => {
          r.meldGroup = g;
          usedIds.add(r.id);
        });
        melds.push(formed);
      }
    }
  }

  const deadwood = pool
    .filter((c) => !usedIds.has(c.id))
    .sort((a, b) => a.value - b.value || a.suit.localeCompare(b.suit));

  const arranged = [...melds.flat(), ...deadwood];
  return { arranged, melds, deadwood };
}

export function isValidMeldSelection(cards: PlayingCardData[]): boolean {
  if (cards.length < 3) return false;
  const nonJokers = cards.filter((c) => !c.isJoker);
  const jokersCount = cards.length - nonJokers.length;
  if (nonJokers.length === 0) return false;

  // Check Set (all same rank, max 4)
  if (cards.length <= 4 && nonJokers.every((c) => c.rank === nonJokers[0].rank)) {
    return true;
  }

  // Check Same-Suit Run (supports A-2-3 and Q-K-A wrap)
  if (nonJokers.every((c) => c.suit === nonJokers[0].suit)) {
    const checkRun = (values: number[]): boolean => {
      const sorted = [...values].sort((a, b) => a - b);
      let gaps = 0;
      for (let i = 1; i < sorted.length; i++) {
        const diff = sorted[i] - sorted[i - 1];
        if (diff === 0) return false;
        gaps += diff - 1;
      }
      return gaps <= jokersCount;
    };

    const lowAceVals = nonJokers.map((c) => c.value);
    if (checkRun(lowAceVals)) return true;

    // Also allow Ace-high straight (e.g. Q-K-A or 10-J-Q-K-A Royal)
    if (nonJokers.some((c) => c.value === 1)) {
      const highAceVals = nonJokers.map((c) => (c.value === 1 ? 14 : c.value));
      if (checkRun(highAceVals)) return true;
    }
  }
  return false;
}

export interface SpecialTongitsHandInfo {
  hasRoyal: boolean;
  hasQuadro: boolean;
  canFightAfterDraw: boolean;
  labels: string[];
  bonusMultiplier: number;
}

/**
 * Detects Tong-its Special Cards:
 * - ROYAL: 10-J-Q-K-A of the same suit (or 4+ Royal/High Straight Flush in hand/melds, Jokers allowed in Joker mode)
 * - QUADRO: Four of a Kind (4 cards of the same rank in hand or dropped melds)
 * Players holding Royal or Quadro are permitted to call FIGHT even after drawing a card!
 */
export function detectSpecialTongitsHands(
  hand: PlayingCardData[],
  myMelds: PlayingCardData[][] = []
): SpecialTongitsHandInfo {
  const allCards = [...hand, ...myMelds.flat()];
  const jokersCount = allCards.filter((c) => c.isJoker).length;

  // 1. Check Quadro (Four of a Kind — 4 cards of the same rank)
  const rankCounts = new Map<Rank, number>();
  for (const c of allCards) {
    if (c.isJoker) continue;
    rankCounts.set(c.rank, (rankCounts.get(c.rank) || 0) + 1);
  }
  let hasQuadro = false;
  for (const count of rankCounts.values()) {
    if (count >= 4) {
      hasQuadro = true;
      break;
    }
  }
  // Also allow Quadro inside a single dropped 4-card set (e.g. 3 same rank + Joker)
  if (!hasQuadro) {
    for (const meld of myMelds) {
      const nonJ = meld.filter((c) => !c.isJoker);
      if (meld.length === 4 && nonJ.length > 0 && nonJ.every((c) => c.rank === nonJ[0].rank)) {
        hasQuadro = true;
        break;
      }
    }
  }

  // 2. Check Royal (10-J-Q-K-A of the same suit, Jokers can fill missing slots in Joker variant)
  const royalRanks = new Set<Rank>(['10', 'J', 'Q', 'K', 'A']);
  let hasRoyal = false;
  for (const suit of ['♠', '♥', '♣', '♦'] as Suit[]) {
    const suitRoyal = new Set<Rank>();
    for (const c of allCards) {
      if (!c.isJoker && c.suit === suit && royalRanks.has(c.rank)) {
        suitRoyal.add(c.rank);
      }
    }
    if (suitRoyal.size + jokersCount >= 5 && suitRoyal.size >= 3) {
      hasRoyal = true;
      break;
    }
  }

  const labels: string[] = [];
  if (hasRoyal) labels.push('ROYAL');
  if (hasQuadro) labels.push('QUADRO');

  return {
    hasRoyal,
    hasQuadro,
    canFightAfterDraw: hasRoyal || hasQuadro,
    labels,
    bonusMultiplier: hasRoyal ? 3 : hasQuadro ? 2 : 1,
  };
}

/**
 * Finds the best valid meld in `hand` that includes `targetCardId`
 * so players can tap a card to instantly select or down its meld.
 */
export function findValidMeldContainingCard(
  hand: PlayingCardData[],
  targetCardId: string
): PlayingCardData[] | null {
  const target = hand.find((c) => c.id === targetCardId);
  if (!target) return null;

  // 1. If the card already has a valid meldGroup tag, check that group first
  if (target.meldGroup) {
    const grouped = hand.filter((c) => c.meldGroup === target.meldGroup);
    if (isValidMeldSelection(grouped)) return grouped;
  }

  // 2. Check autoMeldHand results
  const { melds } = autoMeldHand(hand);
  const autoMatch = melds.find((m) => m.some((c) => c.id === targetCardId));
  if (autoMatch && isValidMeldSelection(autoMatch)) return autoMatch;

  // 3. Direct set check (same rank, 3-4 cards)
  if (!target.isJoker) {
    const sameRank = hand.filter((c) => !c.isJoker && c.rank === target.rank);
    if (sameRank.length >= 3) return sameRank.slice(0, 4);

    // 4. Direct same-suit run check (including Ace-high Q-K-A)
    const sameSuit = hand.filter((c) => !c.isJoker && c.suit === target.suit);
    const byLow = [...sameSuit].sort((a, b) => a.value - b.value);
    let run: PlayingCardData[] = [];
    for (const c of byLow) {
      if (run.length === 0) run = [c];
      else if (c.value === run[run.length - 1].value + 1) run.push(c);
      else if (c.value === run[run.length - 1].value) continue;
      else {
        if (run.length >= 3 && run.some((r) => r.id === targetCardId)) return run;
        run = [c];
      }
    }
    if (run.length >= 3 && run.some((r) => r.id === targetCardId)) return run;

    // Ace-high check (10-J-Q-K-A / Q-K-A)
    if (sameSuit.some((c) => c.value === 1)) {
      const highVal = (c: PlayingCardData) => (c.value === 1 ? 14 : c.value);
      const byHigh = [...sameSuit].sort((a, b) => highVal(a) - highVal(b));
      let hRun: PlayingCardData[] = [];
      for (const c of byHigh) {
        if (hRun.length === 0) hRun = [c];
        else if (highVal(c) === highVal(hRun[hRun.length - 1]) + 1) hRun.push(c);
        else if (highVal(c) === highVal(hRun[hRun.length - 1])) continue;
        else {
          if (hRun.length >= 3 && hRun.some((r) => r.id === targetCardId)) return hRun;
          hRun = [c];
        }
      }
      if (hRun.length >= 3 && hRun.some((r) => r.id === targetCardId)) return hRun;
    }
  }

  return null;
}

// ==================== PUSOY & POKER EVALUATOR ====================

function pokerRankValue(v: number): number {
  return v === 1 ? 14 : v;
}

export function evaluateFiveCardHand(cards: PlayingCardData[]): { score: number; label: string } {
  if (cards.length < 3) return { score: 0, label: 'Incomplete' };
  const vals = cards.map((c) => pokerRankValue(c.value)).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (cards.length === 3) {
    if (groups[0][1] === 3) return { score: 300 + groups[0][0], label: 'Three of a Kind' };
    if (groups[0][1] === 2) return { score: 100 + groups[0][0], label: 'One Pair' };
    return { score: vals[0], label: 'High Card' };
  }

  const isFlush = cards.every((c) => c.suit === cards[0].suit);
  const uniqueVals = [...new Set(vals)];
  let isStraight = uniqueVals.length === 5 && uniqueVals[0] - uniqueVals[4] === 4;
  if (uniqueVals.length === 5 && uniqueVals[0] === 14 && uniqueVals[1] === 5 && uniqueVals[4] === 2) {
    isStraight = true;
  }

  if (isFlush && isStraight) return { score: 800 + vals[0], label: 'Straight Flush' };
  if (groups[0][1] === 4) return { score: 700 + groups[0][0], label: 'Four of a Kind' };
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return { score: 600 + groups[0][0], label: 'Full House' };
  if (isFlush) return { score: 500 + vals[0], label: 'Flush' };
  if (isStraight) return { score: 400 + vals[0], label: 'Straight' };
  if (groups[0][1] === 3) return { score: 300 + groups[0][0], label: 'Three of a Kind' };
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) return { score: 200 + groups[0][0], label: 'Two Pair' };
  if (groups[0][1] === 2) return { score: 100 + groups[0][0], label: 'One Pair' };
  return { score: vals[0], label: 'High Card' };
}

/**
 * Pusoy Auto-Meld / Auto-Arrange:
 * Arranges 13 cards into Back (5), Middle (5), Front (3) trying to build the
 * strongest legal hierarchy (Back >= Middle >= Front).
 */
export function autoArrangePusoy(cards: PlayingCardData[]): {
  front: PlayingCardData[];
  middle: PlayingCardData[];
  back: PlayingCardData[];
} {
  const pool = [...cards].sort((a, b) => pokerRankValue(b.value) - pokerRankValue(a.value));
  const used = new Set<string>();

  const pickFive = (): PlayingCardData[] => {
    const avail = pool.filter((c) => !used.has(c.id));
    // Check flush
    const suitGroups = new Map<Suit, PlayingCardData[]>();
    for (const c of avail) {
      const g = suitGroups.get(c.suit) || [];
      g.push(c);
      suitGroups.set(c.suit, g);
    }
    for (const g of suitGroups.values()) {
      if (g.length >= 5) {
        const chosen = g.slice(0, 5);
        chosen.forEach((c) => used.add(c.id));
        return chosen;
      }
    }
    // Check trips / pairs
    const rankGroups = new Map<number, PlayingCardData[]>();
    for (const c of avail) {
      const rv = pokerRankValue(c.value);
      const g = rankGroups.get(rv) || [];
      g.push(c);
      rankGroups.set(rv, g);
    }
    const sortedGroups = [...rankGroups.values()].sort(
      (a, b) => b.length - a.length || pokerRankValue(b[0].value) - pokerRankValue(a[0].value)
    );
    const chosen: PlayingCardData[] = [];
    for (const g of sortedGroups) {
      if (chosen.length + g.length <= 5) {
        chosen.push(...g);
      }
    }
    for (const c of avail) {
      if (chosen.length >= 5) break;
      if (!chosen.some((x) => x.id === c.id)) chosen.push(c);
    }
    chosen.forEach((c) => used.add(c.id));
    return chosen;
  };

  let back = pickFive();
  let middle = pickFive();
  const front = pool.filter((c) => !used.has(c.id)).slice(0, 3);

  // Guarantee Back >= Middle
  if (evaluateFiveCardHand(middle).score > evaluateFiveCardHand(back).score) {
    [back, middle] = [middle, back];
  }

  return { front, middle, back };
}

// ==================== LUCKY 9 SCORER ====================

export function scoreLucky9(cards: PlayingCardData[]): number {
  const total = cards.reduce((sum, c) => {
    if (c.value >= 10) return sum + 0;
    return sum + c.value;
  }, 0);
  return total % 10;
}

// ==================== COLOR GAME (3 DICE SQUARE) ====================

export interface ColorSquareDef {
  id: string;
  label: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  dotColor: string;
}

export const COLOR_GAME_SQUARES: ColorSquareDef[] = [
  { id: 'red', label: 'Red', bgClass: 'bg-red-600', borderClass: 'border-red-300', textClass: 'text-white', dotColor: '#dc2626' },
  { id: 'blue', label: 'Blue', bgClass: 'bg-blue-600', borderClass: 'border-blue-300', textClass: 'text-white', dotColor: '#2563eb' },
  { id: 'yellow', label: 'Yellow', bgClass: 'bg-amber-400', borderClass: 'border-amber-100', textClass: 'text-slate-950', dotColor: '#facc15' },
  { id: 'green', label: 'Green', bgClass: 'bg-emerald-600', borderClass: 'border-emerald-300', textClass: 'text-white', dotColor: '#059669' },
  { id: 'white', label: 'White', bgClass: 'bg-slate-100', borderClass: 'border-white', textClass: 'text-slate-950', dotColor: '#f8fafc' },
  { id: 'pink', label: 'Pink', bgClass: 'bg-pink-500', borderClass: 'border-pink-200', textClass: 'text-white', dotColor: '#ec4899' },
];
