import crypto from 'crypto';
import type {
  SuperAceCascadeStep,
  SuperAceCell,
  SuperAcePlayerState,
  SuperAceSymbol,
} from '../src/types.ts';

export const SUPER_ACE_ROWS = 5;
export const SUPER_ACE_COLS = 6;

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
    if (roll < 0.28) return 3;
    if (roll < 0.56) return 4;
    if (roll < 0.76) return 5;
    if (roll < 0.88) return 6;
    if (roll < 0.94) return 7;
    if (roll < 0.98) return 8;
    return 9;
  }
  if (roll < 0.40) return 3;
  if (roll < 0.68) return 4;
  if (roll < 0.84) return 5;
  if (roll < 0.92) return 6;
  if (roll < 0.96) return 7;
  if (roll < 0.985) return 8;
  return 9;
}

/**
 * Generates a 6×5 grid seeded with a genuine left-to-right consecutive reel win
 * starting from Reel 1 (Col 0 -> Col 1 -> Col 2 [-> Col 3 -> Col 4 -> Col 5])
 * totaling `targetSize` matching boxes, plus optional Golden Cards on inner reels.
 */
function generateWinningGrid(scatterCount: number, wasFreeSpin: boolean): SuperAceCell[][] {
  const grid = generateNonWinningGrid(scatterCount);
  const targetSize = pickWinningClusterSize(wasFreeSpin);
  const targetSymbol = pickRandom(REGULAR_SYMBOLS);

  // Pick consecutive reel span (minimum 3 reels starting at Col 0, up to 6 reels)
  let numReels = 3;
  if (targetSize === 3) {
    numReels = 3;
  } else if (targetSize === 4) {
    numReels = Math.random() < 0.7 ? 4 : 3;
  } else if (targetSize === 5) {
    numReels = pickRandom([3, 4, 5]);
  } else if (targetSize === 6) {
    numReels = pickRandom([4, 5, 6]);
  } else {
    numReels = pickRandom([4, 5, 6]);
  }

  // Helper to get a safe replacement symbol for Col 2 that won't create another unintended 3-reel match
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
        // Avoid matching existing Col 2
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

  // Clear any pre-existing targetSymbol inside columns 0..numReels so our exact boxCount is preserved
  for (let c = 0; c <= Math.min(numReels, SUPER_ACE_COLS - 1); c++) {
    for (let r = 0; r < SUPER_ACE_ROWS; r++) {
      if (!grid[r][c].isScatter && grid[r][c].symbol === targetSymbol) {
        grid[r][c] = makeCell(pickSafeAlternative(c), { isGolden: grid[r][c].isGolden });
      }
    }
  }

  // Step 1: Place 1 guaranteed targetSymbol in EVERY consecutive reel from Col 0 to numReels - 1
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

  // Step 2: Distribute any extra matching boxes (targetSize - numReels) across Col 0..numReels - 1
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

  // Paint the consecutive winning boxes (with 1-2 Golden Cards on inner reels Col 1..4)
  let goldenPlaced = 0;
  for (const pos of placedPositions) {
    const canBeGolden = pos.col >= 1 && pos.col <= 4 && goldenPlaced < 2 && Math.random() < 0.45;
    if (canBeGolden) goldenPlaced++;
    grid[pos.row][pos.col] = makeCell(targetSymbol, { isGolden: canBeGolden });
  }

  return grid;
}

/**
 * Finds the best left-to-right consecutive reel win starting strictly from Reel 1 (Col 0).
 * A symbol (with Wild Jokers substituting) MUST appear on Reel 1 (Col 0), Reel 2 (Col 1),
 * AND Reel 3 (Col 2) consecutively (minimum 3 consecutive reels) before boxes break.
 * If Reel 2 (Col 1) has no matching symbol or Wild, the chain stops immediately and does NOT break.
 * If Reels 1..4 (or up to 1..6) all contain the matching symbol/Wild, ALL matching boxes across
 * those consecutive reels break together.
 */
export function findBestWinningWays(
  grid: SuperAceCell[][]
): { symbol: SuperAceSymbol; cells: Array<{ row: number; col: number }>; consecutiveReels: number } | null {
  let best: {
    symbol: SuperAceSymbol;
    cells: Array<{ row: number; col: number }>;
    consecutiveReels: number;
  } | null = null;

  for (const sym of REGULAR_SYMBOLS) {
    const matchedCells: Array<{ row: number; col: number }> = [];
    let consecutiveReels = 0;
    let hasPureSym = false;

    for (let c = 0; c < SUPER_ACE_COLS; c++) {
      const colMatches: Array<{ row: number; col: number }> = [];
      for (let r = 0; r < SUPER_ACE_ROWS; r++) {
        const cell = grid[r][c];
        if (cell.symbol === sym || cell.isWild) {
          colMatches.push({ row: r, col: c });
          if (cell.symbol === sym) hasPureSym = true;
        }
      }

      // Strict consecutive rule: if this reel has NO matching symbol (or Wild), chain stops!
      if (colMatches.length === 0) break;

      matchedCells.push(...colMatches);
      consecutiveReels++;
    }

    // Must span at least 1st, 2nd, and 3rd reels consecutively (Col 0, Col 1, Col 2)
    if (consecutiveReels >= 3 && hasPureSym) {
      const candidateVal = getBasePayoutForBoxes(matchedCells.length, sym);
      const bestVal = best ? getBasePayoutForBoxes(best.cells.length, best.symbol) : 0;
      if (
        !best ||
        candidateVal > bestVal ||
        (candidateVal === bestVal && consecutiveReels > best.consecutiveReels)
      ) {
        best = { symbol: sym, cells: matchedCells, consecutiveReels };
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

export interface EngineSpinOutput {
  initialGrid: SuperAceCell[][];
  cascades: SuperAceCascadeStep[];
  finalGrid: SuperAceCell[][];
  wasFreeSpin: boolean;
  effectiveBet: number;
  scatterCount: number;
  scatterPositions: Array<{ row: number; col: number }>;
  triggeredFreeSpins: number;
  totalWin: number;
  highBetBoostActive: boolean;
  betWalletRatio: number;
  nextState: SuperAcePlayerState;
}

export function runSuperAceSpin(input: EngineSpinInput): EngineSpinOutput {
  const { state, preSpinWallet } = input;
  // Real Paid Spin Mode only (Free Spin Mode removed)
  const wasFreeSpin = false;
  const effectiveBet = input.betAmount;

  const betWalletRatio = preSpinWallet > 0 ? Number((effectiveBet / preSpinWallet).toFixed(4)) : 0;

  let dropThreeScatters = false;
  let highBetBoostActive = false;

  if (betWalletRatio >= 0.395 && betWalletRatio <= 0.55) {
    highBetBoostActive = true;
    dropThreeScatters = Math.random() < 0.12;
  } else {
    dropThreeScatters = Math.random() < 0.03;
  }

  let scatterCount = 0;
  if (dropThreeScatters) {
    scatterCount = 3;
  } else if (Math.random() < 0.22) {
    scatterCount = Math.random() < 0.65 ? 1 : 2;
  }

  // Real Spin Winning Rate (30% win chance per real paid spin)
  const shouldWin = Math.random() < 0.30;

  const initialGrid = shouldWin
    ? generateWinningGrid(scatterCount, false)
    : generateNonWinningGrid(scatterCount);

  const scatterPositions = getScatterPositions(initialGrid);
  const actualScatterCount = scatterPositions.length;
  // No Free Spin Mode: 3+ Scatters pay an instant real cash bonus directly into totalWin
  const triggeredFreeSpins = 0;
  const scatterInstantBonus =
    actualScatterCount >= 4
      ? Number((effectiveBet * 20).toFixed(2))
      : actualScatterCount >= 3
        ? Number((effectiveBet * 10).toFixed(2))
        : 0;

  // Execute Cascading Box Breaks + Golden Card -> Joker Wild transformations
  const multipliers = REGULAR_MULTIPLIERS;
  let workingGrid = cloneGrid(initialGrid);
  const cascades: SuperAceCascadeStep[] = [];
  let totalWin = scatterInstantBonus;
  const MAX_CASCADES = 5;

  for (let step = 0; step < MAX_CASCADES; step++) {
    const match = findBestWinningWays(workingGrid);
    if (!match) break;

    const mult = multipliers[Math.min(step, multipliers.length - 1)];
    const boxCount = match.cells.length;
    const basePayoutAt1Peso = getBasePayoutForBoxes(boxCount, match.symbol);
    const stepWin = Number((basePayoutAt1Peso * effectiveBet * mult).toFixed(2));
    totalWin = Number((totalWin + stepWin).toFixed(2));

    const winSet = new Set(match.cells.map((p) => `${p.row},${p.col}`));
    const goldenTransformed: Array<{ row: number; col: number; wildType: 'WILD_SMALL' | 'WILD_BIG' }> = [];
    const bigJokerClones: Array<{ row: number; col: number }> = [];

    // Mark broken cells; Golden Cards stay and transform into Small/Big Wild Joker!
    const nextGrid: (SuperAceCell | null)[][] = workingGrid.map((row, r) =>
      row.map((cell, c) => {
        if (!winSet.has(`${r},${c}`)) return { ...cell, isNew: false };
        if (cell.isGolden) {
          const wildType: 'WILD_SMALL' | 'WILD_BIG' = Math.random() < 0.35 ? 'WILD_BIG' : 'WILD_SMALL';
          goldenTransformed.push({ row: r, col: c, wildType });
          return makeCell(wildType, { isNew: true });
        }
        return null; // broken box
      })
    );

    // Big Joker feature: replicates onto 1-2 extra regular cells
    for (const gt of goldenTransformed) {
      if (gt.wildType === 'WILD_BIG') {
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
    }

    // Gravity drop per column & refill top empty boxes with fresh cards
    // Keep cascade probability controlled so chain reactions feel exciting without exploding infinitely
    for (let c = 0; c < SUPER_ACE_COLS; c++) {
      const survivors: SuperAceCell[] = [];
      for (let r = SUPER_ACE_ROWS - 1; r >= 0; r--) {
        const cell = nextGrid[r][c];
        if (cell) survivors.push(cell);
      }
      const missing = SUPER_ACE_ROWS - survivors.length;
      const newCells: SuperAceCell[] = [];
      for (let m = 0; m < missing; m++) {
        // Choose symbols with slight diversity to keep cascades realistic
        const sym = pickRandom(REGULAR_SYMBOLS);
        const isGolden = c >= 1 && c <= 4 && Math.random() < 0.12;
        newCells.push(makeCell(sym, { isGolden, isNew: true }));
      }
      // survivors[0] is bottom row (SUPER_ACE_ROWS - 1)
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

  // Advance persistent Super Ace player state (Real Paid Mode — zero Free Spins)
  const nextState: SuperAcePlayerState = {
    totalRegularSpins: state.totalRegularSpins + 1,
    scattersTriggered:
      actualScatterCount >= 3 ? state.scattersTriggered + 1 : state.scattersTriggered,
    spinsSinceLastScatter: actualScatterCount >= 3 ? 0 : state.spinsSinceLastScatter + 1,
    freeSpinsRemaining: 0,
    freeSpinsTotal: 0,
    freeSpinBet: effectiveBet,
    freeSpinTotalWin: 0,
  };

  return {
    initialGrid,
    cascades,
    finalGrid: workingGrid,
    wasFreeSpin,
    effectiveBet,
    scatterCount: actualScatterCount,
    scatterPositions,
    triggeredFreeSpins,
    totalWin,
    highBetBoostActive,
    betWalletRatio,
    nextState,
  };
}
