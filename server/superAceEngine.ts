import crypto from 'crypto';
import type {
  SuperAceCascadeStep,
  SuperAceCell,
  SuperAcePlayerState,
  SuperAceSymbol,
} from '../src/types.ts';

export const SUPER_ACE_ROWS = 5;
export const SUPER_ACE_COLS = 6;

// Regular spin win/loss split: 15% win / 85% loss
export const REGULAR_WIN_RATE = 0.15;

// Scatter Free Spin schedule:
// 1st regular spin -> guaranteed 10 Free Scatter Spins
// 20th regular spin -> guaranteed 10 Free Scatter Spins
// After 20th spin -> default 20% chance per regular spin
export const DEFAULT_SCATTER_RATE = 0.20;
export const FREE_SPINS_AWARDED = 10;

// Two Wild Card Types:
// 1) Regular Wild (WILD_SMALL) -> 35% appearance rate
// 2) Multiple Wild (WILD_BIG, clones & multiplies win ×2) -> 25% appearance rate
export const REGULAR_WILD_RATE = 0.35;
export const MULTI_WILD_RATE = 0.25;

// Buy Free Spin Scatter cost multiplier (Bet ₱1 -> Buy Cost ₱100)
export const BUY_SPIN_COST_MULTIPLIER = 100;

// Exact Buy Spin Winning Rate vs Result Rate Distribution (Scatter Bonus result rate 5% for winning rate 20%):
// Winning Rate: 10% + 15% + 20% + 25% + 30% = 100%
// Result Rate:  45% + 20% +  5% + 15% + 15% = 100%
export const BUY_SPIN_RESULT_TABLE = [
  { winningRatePct: 10, resultRatePct: 45 },
  { winningRatePct: 15, resultRatePct: 20 },
  { winningRatePct: 20, resultRatePct: 5 },
  { winningRatePct: 25, resultRatePct: 15 },
  { winningRatePct: 30, resultRatePct: 15 },
] as const;

export function rollBuySpinWinningRatePct(): number {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const tier of BUY_SPIN_RESULT_TABLE) {
    cumulative += tier.resultRatePct;
    if (roll < cumulative) {
      return tier.winningRatePct;
    }
  }
  return BUY_SPIN_RESULT_TABLE[BUY_SPIN_RESULT_TABLE.length - 1].winningRatePct;
}

const REGULAR_SYMBOLS: SuperAceSymbol[] = [
  'ACE',
  'KING',
  'QUEEN',
  'JACK',
  'SPADE',
  'HEART',
  'CLUB',
  'DIAMOND',
];

const REGULAR_MULTIPLIERS = [1, 2, 3, 4, 5];
const FREE_SPIN_MULTIPLIERS = [2, 4, 6, 8, 10];

// Symbol payout bonus multipliers:
// Suits (Spade, Heart, Club/Flower, Diamond) => base (1.00)
// JACK  => +10% (×1.10)
// QUEEN => +15% (×1.15)
// KING  => +20% (×1.20)
// ACE   => +25% (×1.25)
export function getSymbolPayoutMultiplier(symbol: SuperAceSymbol): number {
  switch (symbol) {
    case 'JACK':
      return 1.1;
    case 'QUEEN':
      return 1.15;
    case 'KING':
      return 1.2;
    case 'ACE':
      return 1.25;
    default:
      return 1.0;
  }
}

// Exact paytable at ₱1 bet (scaled linearly by betAmount and symbol payout bonus)
export function getBasePayoutForBoxes(boxCount: number, symbol?: SuperAceSymbol): number {
  let base = 0;
  if (boxCount <= 2) return 0;
  else if (boxCount === 3) base = 0.2;
  else if (boxCount === 4) base = 0.5;
  else if (boxCount === 5) base = 1.5;
  else if (boxCount === 6) base = 3.0;
  else if (boxCount === 7) base = 5.0;
  else if (boxCount === 8) base = 10.0;
  else base = 12.0; // 9+ boxes

  const symbolMult = symbol ? getSymbolPayoutMultiplier(symbol) : 1.0;
  return Number((base * symbolMult).toFixed(4));
}

function makeCell(
  symbol: SuperAceSymbol,
  opts?: { isGolden?: boolean; isNew?: boolean }
): SuperAceCell {
  const isWild = symbol === 'WILD_SMALL' || symbol === 'WILD_BIG';
  const isScatter = symbol === 'SCATTER';
  return {
    id: `c-${crypto.randomBytes(4).toString('hex')}`,
    symbol,
    isGolden: Boolean(opts?.isGolden && !isWild && !isScatter),
    isWild,
    isScatter,
    isNew: opts?.isNew ?? false,
  };
}

function cloneGrid(grid: SuperAceCell[][]): SuperAceCell[][] {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a 6×5 grid guaranteed to have NO left-to-right 3+ consecutive reel match
 * starting from Reel 1 (Col 0 -> Col 1 -> Col 2).
 */
function generateNonWinningGrid(scatterCount: number): SuperAceCell[][] {
  const grid: (SuperAceCell | null)[][] = Array.from({ length: SUPER_ACE_ROWS }, () =>
    Array.from({ length: SUPER_ACE_COLS }, () => null)
  );

  // Place scatters first on distinct columns so they look dramatic across reels
  const scatterCols = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, scatterCount);
  for (const col of scatterCols) {
    const row = Math.floor(Math.random() * SUPER_ACE_ROWS);
    grid[row][col] = makeCell('SCATTER');
  }

  // Track which symbols appear in Reel 1 (Col 0) and Reel 2 (Col 1)
  const col0Symbols = new Set<SuperAceSymbol>();
  const col1Symbols = new Set<SuperAceSymbol>();

  // Fill Reel 1 (Col 0)
  for (let r = 0; r < SUPER_ACE_ROWS; r++) {
    if (grid[r][0]) continue;
    const sym = pickRandom(REGULAR_SYMBOLS);
    col0Symbols.add(sym);
    grid[r][0] = makeCell(sym, { isGolden: false });
  }

  // Fill Reel 2 (Col 1)
  for (let r = 0; r < SUPER_ACE_ROWS; r++) {
    if (grid[r][1]) continue;
    const sym = pickRandom(REGULAR_SYMBOLS);
    col1Symbols.add(sym);
    grid[r][1] = makeCell(sym, { isGolden: Math.random() < 0.14 });
  }

  // Any symbol present in BOTH Reel 1 and Reel 2 is strictly forbidden in Reel 3 (Col 2)
  // so no symbol can complete a consecutive 1st -> 2nd -> 3rd reel break.
  const shared01 = new Set<SuperAceSymbol>();
  for (const s of col0Symbols) {
    if (col1Symbols.has(s)) shared01.add(s);
  }
  const allowedCol2 = REGULAR_SYMBOLS.filter((s) => !shared01.has(s));

  // Fill Reel 3 (Col 2)
  for (let r = 0; r < SUPER_ACE_ROWS; r++) {
    if (grid[r][2]) continue;
    const sym = allowedCol2.length > 0 ? pickRandom(allowedCol2) : pickRandom(REGULAR_SYMBOLS);
    grid[r][2] = makeCell(sym, { isGolden: Math.random() < 0.14 });
  }

  // Fill Reels 4, 5, 6 (Cols 3, 4, 5) freely — Reel 3 already broke every Col 0+1 pair
  for (let c = 3; c < SUPER_ACE_COLS; c++) {
    for (let r = 0; r < SUPER_ACE_ROWS; r++) {
      if (grid[r][c]) continue;
      const sym = pickRandom(REGULAR_SYMBOLS);
      const isGolden = c <= 4 && Math.random() < 0.14;
      grid[r][c] = makeCell(sym, { isGolden });
    }
  }

  return grid as SuperAceCell[][];
}

function pickWinningClusterSize(wasFreeSpin: boolean): number {
  const roll = Math.random();
  if (wasFreeSpin) {
    if (roll < 0.30) return 3;
    if (roll < 0.58) return 4;
    if (roll < 0.78) return 5;
    if (roll < 0.90) return 6;
    if (roll < 0.95) return 7;
    if (roll < 0.985) return 8;
    return 9;
  }
  if (roll < 0.42) return 3;
  if (roll < 0.70) return 4;
  if (roll < 0.85) return 5;
  if (roll < 0.93) return 6;
  if (roll < 0.965) return 7;
  if (roll < 0.988) return 8;
  return 9;
}

/**
 * Generates a 6×5 grid seeded with a genuine left-to-right consecutive reel win
 * starting from Reel 1 (Col 0 -> Col 1 -> Col 2 [-> Col 3 -> Col 4 -> Col 5])
 * totaling `targetSize` matching boxes, plus:
 * - Regular Wild Card (WILD_SMALL) at 35% appearance rate
 * - Multiple Wild Card (WILD_BIG, clones & multiplies win ×2) at 25% appearance rate
 * - Optional Golden Cards on inner reels
 */
function generateWinningGrid(scatterCount: number, wasFreeSpin: boolean): SuperAceCell[][] {
  const grid = generateNonWinningGrid(scatterCount);
  const targetSize = pickWinningClusterSize(wasFreeSpin);
  const targetSymbol = pickRandom(REGULAR_SYMBOLS);

  let numReels = 3;
  if (targetSize === 3) {
    numReels = 3;
  } else if (targetSize === 4) {
    numReels = Math.random() < 0.7 ? 4 : 3;
  } else if (targetSize === 5) {
    numReels = pickRandom([3, 4, 5]);
  } else {
    numReels = pickRandom([4, 5, 6]);
  }

  const pickSafeAlternative = (col: number): SuperAceSymbol => {
    const col0 = new Set<SuperAceSymbol>();
    const col1 = new Set<SuperAceSymbol>();
    for (let r = 0; r < SUPER_ACE_ROWS; r++) {
      if (!grid[r][0].isScatter) col0.add(grid[r][0].symbol);
      if (!grid[r][1].isScatter) col1.add(grid[r][1].symbol);
    }
    const candidates = REGULAR_SYMBOLS.filter((s) => {
      if (s === targetSymbol) return false;
      if (col === 2 && col0.has(s) && col1.has(s)) return false;
      if (col === 0 && col1.has(s)) {
        for (let r = 0; r < SUPER_ACE_ROWS; r++) {
          if (grid[r][2].symbol === s) return false;
        }
      }
      if (col === 1 && col0.has(s)) {
        for (let r = 0; r < SUPER_ACE_ROWS; r++) {
          if (grid[r][2].symbol === s) return false;
        }
      }
      return true;
    });
    return candidates.length > 0
      ? pickRandom(candidates)
      : pickRandom(REGULAR_SYMBOLS.filter((s) => s !== targetSymbol));
  };

  // Clear pre-existing targetSymbol inside columns 0..numReels so boxCount stays accurate
  for (let c = 0; c <= Math.min(numReels, SUPER_ACE_COLS - 1); c++) {
    for (let r = 0; r < SUPER_ACE_ROWS; r++) {
      if (!grid[r][c].isScatter && grid[r][c].symbol === targetSymbol) {
        grid[r][c] = makeCell(pickSafeAlternative(c), { isGolden: grid[r][c].isGolden });
      }
    }
  }

  // Step 1: Place 1 guaranteed slot in EVERY consecutive reel from Col 0 to numReels - 1
  const placedPositions: Array<{ row: number; col: number }> = [];
  const placedSet = new Set<string>();

  for (let c = 0; c < numReels; c++) {
    const openRows: number[] = [];
    for (let r = 0; r < SUPER_ACE_ROWS; r++) {
      if (!grid[r][c].isScatter) openRows.push(r);
    }
    if (openRows.length > 0) {
      const chosenRow = pickRandom(openRows);
      placedPositions.push({ row: chosenRow, col: c });
      placedSet.add(`${chosenRow},${c}`);
    }
  }

  // Step 2: Distribute extra matching boxes across Col 0..numReels - 1
  const extraSlots: Array<{ row: number; col: number }> = [];
  for (let c = 0; c < numReels; c++) {
    for (let r = 0; r < SUPER_ACE_ROWS; r++) {
      if (!grid[r][c].isScatter && !placedSet.has(`${r},${c}`)) {
        extraSlots.push({ row: r, col: c });
      }
    }
  }
  const extrasNeeded = Math.max(0, targetSize - placedPositions.length);
  for (let i = 0; i < extrasNeeded && extraSlots.length > 0; i++) {
    const idx = Math.floor(Math.random() * extraSlots.length);
    const slot = extraSlots.splice(idx, 1)[0];
    placedPositions.push(slot);
    placedSet.add(`${slot.row},${slot.col}`);
  }

  // Roll the 2 Wild Card types on inner winning positions (Col >= 1 so Reel 1 always anchors targetSymbol):
  // - Regular Wild Card (WILD_SMALL): 35% chance
  // - Multiple Wild Card (WILD_BIG): 25% chance
  const innerPositions = placedPositions.filter((p) => p.col >= 1);
  const spawnRegularWild = innerPositions.length > 0 && Math.random() < REGULAR_WILD_RATE;
  const spawnMultiWild = innerPositions.length > 0 && Math.random() < MULTI_WILD_RATE;

  let regularWildKey = '';
  let multiWildKey = '';
  if (innerPositions.length > 0) {
    const shuffledInner = [...innerPositions].sort(() => Math.random() - 0.5);
    if (spawnMultiWild && shuffledInner.length > 0) {
      const p = shuffledInner.shift()!;
      multiWildKey = `${p.row},${p.col}`;
    }
    if (spawnRegularWild && shuffledInner.length > 0) {
      const p = shuffledInner.shift()!;
      regularWildKey = `${p.row},${p.col}`;
    }
  }

  // Paint the consecutive winning boxes
  let goldenPlaced = 0;
  for (const pos of placedPositions) {
    const key = `${pos.row},${pos.col}`;
    if (key === multiWildKey) {
      grid[pos.row][pos.col] = makeCell('WILD_BIG');
      continue;
    }
    if (key === regularWildKey) {
      grid[pos.row][pos.col] = makeCell('WILD_SMALL');
      continue;
    }
    const canBeGolden = pos.col >= 1 && pos.col <= 4 && goldenPlaced < 2 && Math.random() < 0.42;
    if (canBeGolden) goldenPlaced++;
    grid[pos.row][pos.col] = makeCell(targetSymbol, { isGolden: canBeGolden });
  }

  return grid;
}

/**
 * Finds the best left-to-right consecutive reel win starting strictly from Reel 1 (Col 0).
 * A symbol (with Wild Jokers substituting) MUST appear on Reel 1 (Col 0), Reel 2 (Col 1),
 * AND Reel 3 (Col 2) consecutively (minimum 3 consecutive reels) before boxes break.
 */
export function findBestWinningWays(
  grid: SuperAceCell[][]
): {
  symbol: SuperAceSymbol;
  cells: Array<{ row: number; col: number }>;
  consecutiveReels: number;
  multiWildPositions: Array<{ row: number; col: number }>;
} | null {
  let best: {
    symbol: SuperAceSymbol;
    cells: Array<{ row: number; col: number }>;
    consecutiveReels: number;
    multiWildPositions: Array<{ row: number; col: number }>;
  } | null = null;

  for (const sym of REGULAR_SYMBOLS) {
    const matchedCells: Array<{ row: number; col: number }> = [];
    const multiWildPositions: Array<{ row: number; col: number }> = [];
    let consecutiveReels = 0;
    let hasPureSym = false;

    for (let c = 0; c < SUPER_ACE_COLS; c++) {
      const colMatches: Array<{ row: number; col: number }> = [];
      const colMultiWilds: Array<{ row: number; col: number }> = [];
      for (let r = 0; r < SUPER_ACE_ROWS; r++) {
        const cell = grid[r][c];
        if (cell.symbol === sym || cell.isWild) {
          colMatches.push({ row: r, col: c });
          if (cell.symbol === sym) hasPureSym = true;
          if (cell.symbol === 'WILD_BIG') colMultiWilds.push({ row: r, col: c });
        }
      }

      if (colMatches.length === 0) break;

      matchedCells.push(...colMatches);
      multiWildPositions.push(...colMultiWilds);
      consecutiveReels++;
    }

    if (consecutiveReels >= 3 && hasPureSym) {
      const candidateVal = getBasePayoutForBoxes(matchedCells.length, sym);
      const bestVal = best ? getBasePayoutForBoxes(best.cells.length, best.symbol) : 0;
      if (
        !best ||
        candidateVal > bestVal ||
        (candidateVal === bestVal && consecutiveReels > best.consecutiveReels)
      ) {
        best = { symbol: sym, cells: matchedCells, consecutiveReels, multiWildPositions };
      }
    }
  }

  return best;
}

function getScatterPositions(grid: SuperAceCell[][]): Array<{ row: number; col: number }> {
  const out: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < SUPER_ACE_ROWS; r++) {
    for (let c = 0; c < SUPER_ACE_COLS; c++) {
      if (grid[r][c].isScatter) out.push({ row: r, col: c });
    }
  }
  return out;
}

export interface EngineSpinInput {
  betAmount: number;
  preSpinWallet: number;
  state: SuperAcePlayerState;
  welcomeScatterEligible?: boolean;
}

export interface EngineBuySpinInput {
  betAmount: number;
  preSpinWallet: number;
  state: SuperAcePlayerState;
}

export interface EngineSpinOutput {
  initialGrid: SuperAceCell[][];
  cascades: SuperAceCascadeStep[];
  finalGrid: SuperAceCell[][];
  wasFreeSpin: boolean;
  wasBuySpin?: boolean;
  buyCost?: number;
  buyBonusRatePct?: number;
  effectiveBet: number;
  scatterCount: number;
  scatterPositions: Array<{ row: number; col: number }>;
  triggeredFreeSpins: number;
  totalWin: number;
  highBetBoostActive: boolean;
  betWalletRatio: number;
  nextState: SuperAcePlayerState;
}

/**
 * Executes cascades on an initial grid, handling:
 * - Golden Card -> Regular Wild (35:25 ratio -> 58.3% Regular Wild / 41.7% Multi Wild)
 * - Multiple Wild (WILD_BIG) cloning onto 2 extra cells + ×2 Wild Multiplier boost
 * - Optional exact Buy Bonus payout budget scaling
 */
function resolveCascades(
  initialGrid: SuperAceCell[][],
  effectiveBet: number,
  wasFreeSpin: boolean,
  buySpinCapOrTarget?: { cap?: number; exactTarget?: number }
): { cascades: SuperAceCascadeStep[]; finalGrid: SuperAceCell[][]; totalWin: number } {
  const multipliers = wasFreeSpin ? FREE_SPIN_MULTIPLIERS : REGULAR_MULTIPLIERS;
  let workingGrid = cloneGrid(initialGrid);
  const cascades: SuperAceCascadeStep[] = [];
  let totalWin = 0;
  const MAX_CASCADES = 5;

  for (let step = 0; step < MAX_CASCADES; step++) {
    const match = findBestWinningWays(workingGrid);
    if (!match) break;

    const mult = multipliers[Math.min(step, multipliers.length - 1)];
    const boxCount = match.cells.length;
    const basePayoutAt1Peso = getBasePayoutForBoxes(boxCount, match.symbol);
    // Multiple Wild Card (WILD_BIG) multiplies this cascade step win by ×2!
    const wildMultiplier = match.multiWildPositions.length > 0 ? 2 : 1;
    let stepWin = Number((basePayoutAt1Peso * effectiveBet * mult * wildMultiplier).toFixed(2));
    totalWin = Number((totalWin + stepWin).toFixed(2));

    const winSet = new Set(match.cells.map((p) => `${p.row},${p.col}`));
    const goldenTransformed: Array<{ row: number; col: number; wildType: 'WILD_SMALL' | 'WILD_BIG' }> = [];
    const bigJokerClones: Array<{ row: number; col: number }> = [];

    // Mark broken cells; Golden Cards transform into Regular Wild (35w) or Multi Wild (25w)!
    const multiWildRatio = MULTI_WILD_RATE / (REGULAR_WILD_RATE + MULTI_WILD_RATE);
    const nextGrid: (SuperAceCell | null)[][] = workingGrid.map((row, r) =>
      row.map((cell, c) => {
        if (!winSet.has(`${r},${c}`)) return { ...cell, isNew: false };
        if (cell.isGolden) {
          const wildType: 'WILD_SMALL' | 'WILD_BIG' =
            Math.random() < multiWildRatio ? 'WILD_BIG' : 'WILD_SMALL';
          goldenTransformed.push({ row: r, col: c, wildType });
          return makeCell(wildType, { isNew: true });
        }
        return null;
      })
    );

    // Multiple Wild feature: BOTH newly transformed WILD_BIG and broken WILD_BIG replicate onto 2 extra cells!
    const multiWildTriggers =
      goldenTransformed.filter((gt) => gt.wildType === 'WILD_BIG').length +
      match.multiWildPositions.length;

    if (multiWildTriggers > 0) {
      const candidates: Array<{ row: number; col: number }> = [];
      for (let r = 0; r < SUPER_ACE_ROWS; r++) {
        for (let c = 0; c < SUPER_ACE_COLS; c++) {
          const cell = nextGrid[r][c];
          if (cell && !cell.isWild && !cell.isScatter) {
            candidates.push({ row: r, col: c });
          }
        }
      }
      const cloneCount = Math.min(2, candidates.length);
      for (let k = 0; k < cloneCount; k++) {
        const pickIdx = Math.floor(Math.random() * candidates.length);
        const target = candidates.splice(pickIdx, 1)[0];
        nextGrid[target.row][target.col] = makeCell('WILD_SMALL', { isNew: true });
        bigJokerClones.push(target);
      }
    }

    // Gravity drop per column & refill top empty boxes
    for (let c = 0; c < SUPER_ACE_COLS; c++) {
      const survivors: SuperAceCell[] = [];
      for (let r = SUPER_ACE_ROWS - 1; r >= 0; r--) {
        const cell = nextGrid[r][c];
        if (cell) survivors.push(cell);
      }
      const missing = SUPER_ACE_ROWS - survivors.length;
      const newCells: SuperAceCell[] = [];
      for (let m = 0; m < missing; m++) {
        const sym = pickRandom(REGULAR_SYMBOLS);
        const isGolden = c >= 1 && c <= 4 && Math.random() < 0.12;
        newCells.push(makeCell(sym, { isGolden, isNew: true }));
      }
      let writeRow = SUPER_ACE_ROWS - 1;
      for (const s of survivors) {
        nextGrid[writeRow][c] = s;
        writeRow--;
      }
      for (const nc of newCells) {
        nextGrid[writeRow][c] = nc;
        writeRow--;
      }
    }

    workingGrid = nextGrid as SuperAceCell[][];

    cascades.push({
      stepIndex: step,
      multiplier: mult,
      wildMultiplier,
      winningCells: match.cells,
      matchedSymbol: match.symbol,
      boxCount,
      basePayoutAt1Peso,
      stepWin,
      goldenTransformed,
      bigJokerClones,
      gridAfterDrop: cloneGrid(workingGrid),
    });
  }

  // If this spin is part of a Buy Spin Bonus with a target payout budget, calibrate step wins cleanly
  if (cascades.length > 0 && buySpinCapOrTarget) {
    const desiredTotal =
      buySpinCapOrTarget.exactTarget !== undefined
        ? buySpinCapOrTarget.exactTarget
        : buySpinCapOrTarget.cap !== undefined && totalWin > buySpinCapOrTarget.cap
          ? buySpinCapOrTarget.cap
          : null;

    if (desiredTotal !== null && totalWin > 0) {
      const ratio = desiredTotal / totalWin;
      let running = 0;
      for (let i = 0; i < cascades.length; i++) {
        if (i === cascades.length - 1) {
          cascades[i].stepWin = Math.max(0.01, Number((desiredTotal - running).toFixed(2)));
        } else {
          const scaled = Math.max(0.01, Number((cascades[i].stepWin * ratio).toFixed(2)));
          cascades[i].stepWin = scaled;
          running = Number((running + scaled).toFixed(2));
        }
      }
      totalWin = Number(cascades.reduce((sum, c) => sum + c.stepWin, 0).toFixed(2));
    }
  }

  return { cascades, finalGrid: workingGrid, totalWin };
}

/**
 * Buy Free Spin Scatter:
 * - Costs 100 × betAmount (e.g. ₱1 bet -> ₱100 Buy Free Spin Scatter)
 * - Rolls exact Winning Rate vs Result Rate table:
 *     10% win -> 40% result rate
 *     15% win -> 20% result rate
 *     20% win -> 15% result rate
 *     25% win -> 15% result rate
 *     30% win -> 10% result rate
 * - Drops 3 Scatters and awards 10 Free Scatter Spins targeting that exact total return.
 */
export function runSuperAceBuySpin(input: EngineBuySpinInput): EngineSpinOutput {
  const { betAmount, preSpinWallet, state } = input;
  const buyCost = Number((betAmount * BUY_SPIN_COST_MULTIPLIER).toFixed(2));
  const winningRatePct = rollBuySpinWinningRatePct();
  const targetTotalWin = Number(((buyCost * winningRatePct) / 100).toFixed(2));

  // Entry trigger grid with 3 Scatters (cleanly opens the 10 Free Scatter Spins bonus!)
  const initialGrid = generateNonWinningGrid(3);
  const scatterPositions = getScatterPositions(initialGrid);

  const nextState: SuperAcePlayerState = {
    totalRegularSpins: state.totalRegularSpins,
    scattersTriggered: state.scattersTriggered + 1,
    spinsSinceLastScatter: 0,
    freeSpinsRemaining: FREE_SPINS_AWARDED,
    freeSpinsTotal: FREE_SPINS_AWARDED,
    freeSpinBet: betAmount,
    freeSpinTotalWin: 0,
    buyBonusTargetWin: targetTotalWin,
    buyBonusRatePct: winningRatePct,
  };

  return {
    initialGrid,
    cascades: [],
    finalGrid: cloneGrid(initialGrid),
    wasFreeSpin: false,
    wasBuySpin: true,
    buyCost,
    buyBonusRatePct: winningRatePct,
    effectiveBet: betAmount,
    scatterCount: scatterPositions.length,
    scatterPositions,
    triggeredFreeSpins: FREE_SPINS_AWARDED,
    totalWin: 0,
    highBetBoostActive: false,
    betWalletRatio: preSpinWallet > 0 ? Number((buyCost / preSpinWallet).toFixed(4)) : 0,
    nextState,
  };
}

export function runSuperAceSpin(input: EngineSpinInput): EngineSpinOutput {
  const { state, preSpinWallet } = input;
  const wasFreeSpin = state.freeSpinsRemaining > 0;
  const effectiveBet = wasFreeSpin ? state.freeSpinBet : input.betAmount;
  const betWalletRatio = preSpinWallet > 0 ? Number((effectiveBet / preSpinWallet).toFixed(4)) : 0;

  const isBuyBonusFreeSpin = wasFreeSpin && Number(state.buyBonusTargetWin || 0) > 0;

  // Determine Scatter trigger according to exact schedule:
  // 1) 1st regular spin (spin #1) -> guaranteed 3 Scatters (10 Free Scatter Spins)
  // 2) 2nd..19th regular spins -> teaser only (0-2 scatters), saving next trigger for 20th spin
  // 3) 20th regular spin (spin #20) -> guaranteed 3 Scatters (10 Free Scatter Spins)
  // 4) After 20th spin (spin #21+) -> default 20% probability to drop 3 Scatters!
  let dropThreeScatters = false;
  const nextRegularSpinNum = state.totalRegularSpins + 1;

  if (!wasFreeSpin) {
    if (nextRegularSpinNum === 1) {
      dropThreeScatters = true;
    } else if (nextRegularSpinNum === 20) {
      dropThreeScatters = true;
    } else if (nextRegularSpinNum > 20) {
      dropThreeScatters = Math.random() < DEFAULT_SCATTER_RATE;
    } else {
      dropThreeScatters = false;
    }
  } else if (!isBuyBonusFreeSpin) {
    // Organic Free Spin retrigger (rare 8% chance during natural Free Spins)
    dropThreeScatters = Math.random() < 0.08;
  }

  let scatterCount = 0;
  if (dropThreeScatters) {
    scatterCount = 3;
  } else if (Math.random() < 0.22) {
    scatterCount = Math.random() < 0.65 ? 1 : 2;
  }

  // Determine win/loss outcome:
  // - Regular Paid Spin: strictly 30% win / 70% loss!
  // - Buy Bonus Free Spin: paced across the 10 Free Spins so total Free Spin win lands cleanly on buyBonusTargetWin
  // - Natural Free Spin: 38% win rate with ×2..×10 multipliers
  let shouldWin = false;
  let buyBudgetRule: { cap?: number; exactTarget?: number } | undefined;

  if (!wasFreeSpin) {
    shouldWin = Math.random() < REGULAR_WIN_RATE;
  } else if (isBuyBonusFreeSpin) {
    const targetWin = Number(state.buyBonusTargetWin || 0);
    const remainingBudget = Math.max(0, Number((targetWin - state.freeSpinTotalWin).toFixed(2)));
    const spinsLeftAfterThis = state.freeSpinsRemaining - 1;

    if (spinsLeftAfterThis === 0) {
      // Final spin of Buy Bonus: deliver exact remaining target win if any remains
      if (remainingBudget >= 0.05) {
        shouldWin = true;
        buyBudgetRule = { exactTarget: remainingBudget };
      } else {
        shouldWin = false;
      }
    } else if (remainingBudget >= 0.1) {
      // Spread wins naturally across the 10 Buy Free Spins (~45% win spins)
      shouldWin = Math.random() < 0.45;
      if (shouldWin) {
        const share = Number((remainingBudget * (0.22 + Math.random() * 0.28)).toFixed(2));
        buyBudgetRule = { cap: Math.max(0.1, Math.min(remainingBudget, share)) };
      }
    } else {
      shouldWin = false;
    }
  } else {
    // Natural Free Spin (triggered on 1st spin, 20th spin, or 20% default scatter)
    shouldWin = Math.random() < 0.38;
  }

  const initialGrid = shouldWin
    ? generateWinningGrid(scatterCount, wasFreeSpin)
    : generateNonWinningGrid(scatterCount);

  const scatterPositions = getScatterPositions(initialGrid);
  const actualScatterCount = scatterPositions.length;

  const { cascades, finalGrid, totalWin } = resolveCascades(
    initialGrid,
    effectiveBet,
    wasFreeSpin,
    buyBudgetRule
  );

  // Free Spins triggered by 3+ Scatters
  const triggeredFreeSpins =
    actualScatterCount >= 3 ? (wasFreeSpin ? 5 : FREE_SPINS_AWARDED) : 0;

  let nextState: SuperAcePlayerState;
  if (wasFreeSpin) {
    const remainingAfter = Math.max(0, state.freeSpinsRemaining - 1) + triggeredFreeSpins;
    const accumulatedWin = Number((state.freeSpinTotalWin + totalWin).toFixed(2));
    nextState = {
      totalRegularSpins: state.totalRegularSpins,
      scattersTriggered:
        actualScatterCount >= 3 ? state.scattersTriggered + 1 : state.scattersTriggered,
      spinsSinceLastScatter: state.spinsSinceLastScatter,
      freeSpinsRemaining: remainingAfter,
      freeSpinsTotal: state.freeSpinsTotal + triggeredFreeSpins,
      freeSpinBet: effectiveBet,
      freeSpinTotalWin: accumulatedWin,
      buyBonusTargetWin: remainingAfter > 0 ? Number(state.buyBonusTargetWin || 0) : 0,
      buyBonusRatePct: remainingAfter > 0 ? Number(state.buyBonusRatePct || 0) : 0,
    };
  } else {
    nextState = {
      totalRegularSpins: nextRegularSpinNum,
      scattersTriggered:
        actualScatterCount >= 3 ? state.scattersTriggered + 1 : state.scattersTriggered,
      spinsSinceLastScatter: actualScatterCount >= 3 ? 0 : state.spinsSinceLastScatter + 1,
      freeSpinsRemaining: triggeredFreeSpins,
      freeSpinsTotal: triggeredFreeSpins,
      freeSpinBet: effectiveBet,
      freeSpinTotalWin: 0,
      buyBonusTargetWin: 0,
      buyBonusRatePct: 0,
    };
  }

  return {
    initialGrid,
    cascades,
    finalGrid,
    wasFreeSpin,
    effectiveBet,
    scatterCount: actualScatterCount,
    scatterPositions,
    triggeredFreeSpins,
    totalWin,
    highBetBoostActive: false,
    betWalletRatio,
    nextState,
  };
}
