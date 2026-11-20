import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Coins,
  Crown,
  Dices,
  Eye,
  EyeOff,
  Flag,
  FolderKanban,
  Hand,
  Layers,
  LogOut,
  Maximize2,
  MessageSquare,
  Minimize2,
  PlusCircle,
  RefreshCw,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  BET_TIERS,
  type ActiveTableSession,
  type GameTableSummary,
  type MilestoneEntry,
  type PlayingCardData,
  type SeatedPlayer,
  type TableChatMessage,
  type TongitsVariant,
  type UserProfile,
} from '../types';
import {
  COLOR_GAME_SQUARES,
  autoArrangePusoy,
  autoMeldHand,
  calculateDeadwood,
  createShuffledDeck,
  detectSpecialTongitsHands,
  evaluateFiveCardHand,
  findValidMeldContainingCard,
  isValidMeldSelection,
  scoreLucky9,
} from '../lib/cards';
import {
  isAudioMuted,
  playCardDealBurst,
  playCardDraw,
  playCardDrop,
  playCardSelect,
  playChipClink,
  playDiceRoll,
  playMeldChime,
  playWinFanfare,
  setAudioMuted,
} from '../lib/audio';
import { PlayingCard } from './PlayingCard';
import {
  isFullscreenActive,
  toggleGameFullscreenLandscape,
} from '../lib/fullscreen';

interface GameTableViewProps {
  user: UserProfile;
  session: ActiveTableSession;
  tables: GameTableSummary[];
  wsRef: React.MutableRefObject<WebSocket | null>;
  incomingMessages: TableChatMessage[];
  onSendChat: (text: string, isEmoji?: boolean) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  onClearChatMessages?: () => void;
  onOpenAddCoins: () => void;
  onSwitchTable: (
    nextBet: number,
    nextVariant: TongitsVariant,
    nextMaxPlayers?: number,
    nextTableId?: string
  ) => Promise<string | null>;
  onExitTable: () => void;
  onRoundSettled: (updatedProfile: UserProfile) => void;
}

const QUICK_EMOJIS = ['😂', '🔥', '😱', '👏', '💸', '😎'];
const FIGHT_COUNTDOWN_SECONDS = 15;

const CARD_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 30,
  mass: 0.85,
};

function formatTimer(sec: number): string {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }
  return `${sec}s`;
}

export const GameTableView: React.FC<GameTableViewProps> = ({
  user,
  session,
  tables,
  incomingMessages,
  onSendChat,
  onDeleteChatMessage,
  onClearChatMessages,
  onOpenAddCoins,
  onSwitchTable,
  onExitTable,
  onRoundSettled,
}) => {
  const [seats, setSeats] = useState<SeatedPlayer[]>(session.seats);
  const [milestones, setMilestones] = useState<MilestoneEntry[]>(session.milestones);
  const [handsPlayed, setHandsPlayed] = useState<number>(session.handsPlayed);
  const [tableWallet, setTableWallet] = useState<number>(session.bringInWallet);
  const [timeLeft, setTimeLeft] = useState<number>(session.turnSeconds);
  const [pot, setPot] = useState<number>(session.betAmount * session.seats.length);
  const [statusBanner, setStatusBanner] = useState<string>(
    'Swipe cards to switch · Tap meld cards to down · Tap center to get/throw!'
  );
  const [roundResult, setRoundResult] = useState<{ won: boolean; title: string; detail: string } | null>(null);

  // Settings, Milestones, Switch Table & Messenger drawers
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [switchBet, setSwitchBet] = useState<number>(session.betAmount);
  const [switchVariant, setSwitchVariant] = useState<TongitsVariant>(session.variant);
  const [switchMaxPlayers, setSwitchMaxPlayers] = useState<2 | 3>(session.maxPlayers === 2 ? 2 : 3);
  const [switchTableId, setSwitchTableId] = useState<string>(session.tableId);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [muted, setMuted] = useState(isAudioMuted());
  const [myFloatingEmoji, setMyFloatingEmoji] = useState<string | null>(null);
  const [opponentEmojis, setOpponentEmojis] = useState<Record<string, string>>({});
  const lastProcessedMsgIdRef = useRef<string | null>(null);

  // Tong-its / Tsekitsa Pro card state
  interface TableDiscardEntry {
    id: string;
    card: PlayingCardData;
    thrownBySeatId: string;
    thrownByName: string;
    targetSeatId: string;
    targetSeatName: string;
  }

  interface TableMeldEntry {
    id: string;
    ownerId: string;
    ownerName: string;
    cards: PlayingCardData[];
  }

  interface FightCountdownState {
    active: boolean;
    secondsLeft: number;
    initiatedBy: 'player' | 'opponent';
    initiatorName: string;
    specialTag: string | null;
  }

  const [deck, setDeck] = useState<PlayingCardData[]>([]);
  const [hand, setHand] = useState<PlayingCardData[]>([]);
  const [discardPile, setDiscardPile] = useState<TableDiscardEntry[]>([]);
  const [tableMelds, setTableMelds] = useState<TableMeldEntry[]>([]);
  const [showMeldsPanel, setShowMeldsPanel] = useState<boolean>(true);
  const [nextMeldGroupNum, setNextMeldGroupNum] = useState<number>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hasDrawnThisTurn, setHasDrawnThisTurn] = useState(false);
  const [turnBusy, setTurnBusy] = useState(false);
  const [fightCountdown, setFightCountdown] = useState<FightCountdownState | null>(null);
  const [activeSwipe, setActiveSwipe] = useState<{
    cardId: string;
    dx: number;
    dy: number;
    targetCardId: string | null;
  } | null>(null);
  // Pointer/Touch swipe-to-switch state with exact DOM card hit-testing
  const swipeStateRef = useRef<{
    cardId: string;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const lastSwipeAtRef = useRef<number>(0);

  // Pusoy 13-card 3-row state
  const [pusoyFront, setPusoyFront] = useState<PlayingCardData[]>([]);
  const [pusoyMiddle, setPusoyMiddle] = useState<PlayingCardData[]>([]);
  const [pusoyBack, setPusoyBack] = useState<PlayingCardData[]>([]);
  const [pusoySelected, setPusoySelected] = useState<{ row: 'front' | 'middle' | 'back'; idx: number } | null>(null);

  // Lucky 9 state
  const [lucky9Player, setLucky9Player] = useState<PlayingCardData[]>([]);
  const [lucky9Banker, setLucky9Banker] = useState<PlayingCardData[]>([]);
  const [lucky9Revealed, setLucky9Revealed] = useState(false);

  // Texas Poker state
  const [pokerHole, setPokerHole] = useState<PlayingCardData[]>([]);
  const [pokerCommunity, setPokerCommunity] = useState<PlayingCardData[]>([]);
  const [pokerOppHole, setPokerOppHole] = useState<PlayingCardData[]>([]);
  const [pokerStage, setPokerStage] = useState<'preflop' | 'flop' | 'turn' | 'river' | 'showdown'>('preflop');
  const [pokerPot, setPokerPot] = useState<number>(session.betAmount * 3);

  // Bet Game state
  const [betChoice, setBetChoice] = useState<'banker' | 'player' | 'tie' | 'red' | 'black'>('player');
  const [betGameCards, setBetGameCards] = useState<{ banker: PlayingCardData | null; player: PlayingCardData | null }>({
    banker: null,
    player: null,
  });

  // Color Game (3 Dice Square) state
  const [colorBets, setColorBets] = useState<Record<string, number>>({});
  const [diceResults, setDiceResults] = useState<string[]>(['red', 'blue', 'yellow']);
  const [rollingDice, setRollingDice] = useState(false);

  const opponents = useMemo(() => seats.filter((s) => s.id !== user.id), [seats, user.id]);
  const mySeat = useMemo(() => seats.find((s) => s.id === user.id), [seats, user.id]);
  const highestWalletBanker = useMemo(() => {
    if (seats.length === 0) return null;
    return seats.reduce((best, curr) => (curr.tableWallet > best.tableWallet ? curr : best), seats[0]);
  }, [seats]);

  // Re-sync Lucky 9 Banker automatically whenever wallets change
  useEffect(() => {
    if (!highestWalletBanker) return;
    setSeats((prev) =>
      prev.map((s) => ({
        ...s,
        isBanker: s.id === highestWalletBanker.id,
      }))
    );
  }, [highestWalletBanker?.id]);

  // Ref for auto-action when countdown hits 0 so interval stays stable
  const onTimeoutRef = useRef<() => void>(() => {});

  // Turn / Table Countdown Timer (ticks every second for all 7 tables)
  useEffect(() => {
    setTimeLeft(session.turnSeconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setTimeout(() => onTimeoutRef.current(), 0);
          return session.turnSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [session.tableId, session.turnSeconds]);

  // Auto-deal initial round on mount or session switch
  useEffect(() => {
    setSeats(session.seats);
    setMilestones(session.milestones);
    setHandsPlayed(session.handsPlayed);
    setTableWallet(session.bringInWallet);
    setSwitchBet(session.betAmount);
    setSwitchVariant(session.variant);
    setSwitchMaxPlayers(session.maxPlayers === 2 ? 2 : 3);
    setSwitchTableId(session.tableId);
    dealFreshRound();
  }, [session.tableId, session.variant, session.maxPlayers]);

  // Display floating emoji reactions on opponent seats when WebSocket messages arrive
  useEffect(() => {
    if (incomingMessages.length === 0) return;
    const latest = incomingMessages[incomingMessages.length - 1];
    if (!latest || latest.id === lastProcessedMsgIdRef.current) return;
    lastProcessedMsgIdRef.current = latest.id;

    if (latest.isEmoji && latest.senderId !== user.id) {
      setOpponentEmojis((prev) => ({ ...prev, [latest.senderId]: latest.text }));
      setTimeout(() => {
        setOpponentEmojis((prev) => {
          if (prev[latest.senderId] !== latest.text) return prev;
          const next = { ...prev };
          delete next[latest.senderId];
          return next;
        });
      }, 2600);
    }
  }, [incomingMessages, user.id]);

  const dealFreshRound = () => {
    playCardDealBurst();
    setRoundResult(null);
    setFightCountdown(null);
    setSelectedIds([]);
    setPusoySelected(null);
    setTimeLeft(session.turnSeconds);

    const includeJokers = session.gameKey === 'tongits' && session.variant === 'Joker';
    const freshDeck = createShuffledDeck(includeJokers);

    if (session.gameKey === 'tongits' || session.gameKey === 'tsekitsa') {
      // Player 1 (You) receives 13 cards; Player 2 (and Player 3 in 3P) receive 12 cards each
      const myCards = freshDeck.splice(0, 13);
      const opponentList = session.seats.filter((s) => s.id !== user.id);
      opponentList.forEach(() => {
        freshDeck.splice(0, 12);
      });

      setSeats(
        session.seats.map((s) => ({
          ...s,
          cardCount: s.id === user.id ? 13 : 12,
        }))
      );
      setHand(myCards);
      setDiscardPile([]);
      setDeck(freshDeck);
      setTableMelds([]);
      setShowMeldsPanel(true);
      setNextMeldGroupNum(1);
      setHasDrawnThisTurn(true); // Player 1 starts with 13 cards ready to Group/Drop Melds or Drop Card
      setTurnBusy(false);
      setPot(session.betAmount * session.seats.length);
      setStatusBanner(
        session.gameKey === 'tongits'
          ? `Tong-its Pro (${session.variant}) dealt! You have 13 cards (Opponents: 12 cards). Group Melds, Drop Melds, or Drop 1 card.`
          : 'Tsekitsa dealt! You have 13 cards (Opponents: 12 cards). Arrange melds or drop 1 card.'
      );
    } else if (session.gameKey === 'pusoy') {
      const cards13 = freshDeck.splice(0, 13);
      setPusoyFront(cards13.slice(0, 3));
      setPusoyMiddle(cards13.slice(3, 8));
      setPusoyBack(cards13.slice(8, 13));
      setDeck(freshDeck);
      setPot(session.betAmount * session.seats.length * 2);
      setStatusBanner('Pusoy 13 cards dealt! Tap any 2 cards to Balis-balis / Swap, or tap Auto-Meld.');
    } else if (session.gameKey === 'lucky9') {
      const pCards = freshDeck.splice(0, 2);
      const bCards = freshDeck.splice(0, 2);
      setLucky9Player(pCards);
      setLucky9Banker(bCards);
      setDeck(freshDeck);
      setLucky9Revealed(false);
      setPot(session.betAmount * 2);
      setStatusBanner('Lucky 9 dealt! Highest Wallet player is Banker. Tap Hirit (3rd card) or Good!');
    } else if (session.gameKey === 'poker') {
      const hole = freshDeck.splice(0, 2);
      const opp = freshDeck.splice(0, 2);
      setPokerHole(hole);
      setPokerOppHole(opp);
      setPokerCommunity([]);
      setDeck(freshDeck);
      setPokerStage('preflop');
      setPokerPot(session.betAmount * 3);
      setStatusBanner('Texas Poker hole cards dealt! Check/Call, Raise, or Fold.');
    } else if (session.gameKey === 'betgame') {
      setBetGameCards({ banker: null, player: null });
      setDeck(freshDeck);
      setStatusBanner('Select Banker, Player, Tie, Red, or Black and tap Deal & Flip!');
    } else if (session.gameKey === 'colorgame') {
      setColorBets({});
      setRollingDice(false);
      setStatusBanner('Color Game (3 Dice Square): Tap any color squares to stake chips, then Roll 3 Dice!');
    }
  };

  // Persist round settlement to backend SQLite + update VIP cashback & milestones
  const settleRoundOnServer = async (
    won: boolean,
    netDelta: number,
    stakeTotal: number,
    title: string,
    summary: string
  ) => {
    const primaryBot = opponents.find((o) => o.role === 'bot');
    setRoundResult({ won, title, detail: summary });
    if (won) playWinFanfare();
    else playCardDrop();

    setTableWallet((w) => Math.max(0, Number((w + netDelta - session.rakeAmount).toFixed(2))));
    setSeats((prev) =>
      prev.map((s) => {
        if (s.id === user.id) {
          return { ...s, tableWallet: Math.max(0, Number((s.tableWallet + netDelta - session.rakeAmount).toFixed(2))) };
        }
        if (!won && primaryBot && s.id === primaryBot.id) {
          return { ...s, tableWallet: Number((s.tableWallet + Math.abs(netDelta)).toFixed(2)) };
        }
        return s;
      })
    );

    try {
      const res = await fetch('/api/table/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          tableId: session.tableId,
          gameKey: session.gameKey,
          betAmount: session.betAmount,
          stakeTotal,
          netDelta,
          won,
          summary,
          botWinnerId: !won && primaryBot ? primaryBot.id : null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.profile) {
        onRoundSettled(json.profile);
        if (json.milestones) setMilestones(json.milestones);
        if (json.handsPlayed) setHandsPlayed(json.handsPlayed);
      }
    } catch {
      // Keep playable even if transient network drop occurs
    }
  };

  // ==================== PRO TONG-ITS & TSEKITSA ACTIONS ====================

  const topDiscard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  // Opponent's throw ("labog") is face-up ONLY to the player it was thrown to ("gilabogan") and hidden from other players
  const isTopDiscardVisibleToMe = Boolean(topDiscard && topDiscard.targetSeatId === user.id);

  // Detect Special Cards (Royal Flush / Quadro) in player's hand or dropped melds
  const myDroppedMelds = useMemo(
    () => tableMelds.filter((m) => m.ownerId === user.id).map((m) => m.cards),
    [tableMelds, user.id]
  );
  const specialHand = useMemo(
    () => detectSpecialTongitsHands(hand, myDroppedMelds),
    [hand, myDroppedMelds]
  );

  // Highlight cards that belong to an auto-detected valid meld so player can tap to down melds fast
  const detectedMeldsInHand = useMemo(() => autoMeldHand(hand).melds, [hand]);
  const validMeldCardIds = useMemo(() => {
    const s = new Set<string>();
    detectedMeldsInHand.forEach((m) => m.forEach((c) => s.add(c.id)));
    return s;
  }, [detectedMeldsInHand]);

  const selectedCards = useMemo(
    () => hand.filter((c) => selectedIds.includes(c.id)),
    [hand, selectedIds]
  );
  const selectedIsValidMeld = useMemo(
    () => isValidMeldSelection(selectedCards),
    [selectedCards]
  );

  // Rule: Normal hands can Fight BEFORE drawing (or when deck is empty).
  // SPECIAL CARDS (ROYAL or QUADRO) can Fight EVEN AFTER DRAWING!
  const canCallFightNow =
    !turnBusy &&
    !fightCountdown?.active &&
    (!hasDrawnThisTurn || specialHand.canFightAfterDraw || deck.length === 0);

  // Drop specific cards as a meld onto the table (used by Tap Card to Down Melds & Drop Melds button)
  const dropCardsAsMeld = (chosen: PlayingCardData[]) => {
    if (!isValidMeldSelection(chosen)) {
      setStatusBanner('Select 3+ same-suit consecutive cards or 3–4 matching ranks to Down Melds.');
      return;
    }
    playMeldChime();
    const chosenIds = new Set(chosen.map((c) => c.id));
    const newEntry: TableMeldEntry = {
      id: `meld-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: user.id,
      ownerName: `${user.full_name} (You)`,
      cards: [...chosen].sort((a, b) => a.value - b.value),
    };
    setTableMelds((prev) => [...prev, newEntry]);
    setShowMeldsPanel(true);

    const remaining = hand.filter((c) => !chosenIds.has(c.id));
    setHand(remaining);
    setSeats((prev) => prev.map((s) => (s.id === user.id ? { ...s, cardCount: remaining.length } : s)));
    setSelectedIds([]);
    setStatusBanner(
      `Downed meld (${chosen.map((c) => (c.isJoker ? 'JK' : c.rank + c.suit)).join(' ')}) onto the table!`
    );

    if (remaining.length === 0) {
      const winAmt = session.betAmount * (session.seats.length * 2);
      settleRoundOnServer(
        true,
        winAmt,
        session.betAmount * 2,
        'TONG-ITS VICTORY!',
        `Zero cards left! Won +₱${winAmt.toFixed(2)}`
      );
    }
  };

  // Tap Card interaction:
  // - If tapping a card that is already selected as part of a valid 3+ card meld -> IMMEDIATELY DOWN MELD!
  // - If tapping a card that belongs to a valid meld while no cards are selected -> selects that meld (or toggle single card) so a second tap downs it!
  const handleHandCardTap = (cardId: string) => {
    // Ignore click immediately following a swipe-to-switch gesture
    if (Date.now() - lastSwipeAtRef.current < 260) return;

    // 1. If the currently selected cards already form a valid meld and player taps any of them -> DOWN MELD immediately!
    if (selectedIds.includes(cardId) && selectedIsValidMeld) {
      dropCardsAsMeld(selectedCards);
      return;
    }

    playCardSelect();

    // 2. If nothing is selected yet and this card is part of a valid meld, allow quick 1-tap toggle,
    //    or if player clicks the top "DOWN" badge it drops directly.
    setSelectedIds((prev) => (prev.includes(cardId) ? prev.filter((x) => x !== cardId) : [...prev, cardId]));
  };

  // Direct 1-tap "Top Card to Down Meld" action triggered from the card's top meld chip or quick bar
  const handleQuickDownMeldFromCard = (cardId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const meld = findValidMeldContainingCard(hand, cardId);
    if (meld) {
      dropCardsAsMeld(meld);
    } else {
      setStatusBanner('This card does not form a 3+ meld yet.');
    }
  };

  // Exact DOM hit-test to find which exact hand card the pointer is over
  const findHitHandCardId = (clientX: number, clientY: number, excludeCardId: string): string | null => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-hand-card-id]');
    const pad = 6;
    let bestId: string | null = null;
    let bestDist = Infinity;

    nodes.forEach((el) => {
      const id = el.dataset.handCardId;
      if (!id || id === excludeCardId) return;
      const rect = el.getBoundingClientRect();
      if (
        clientX >= rect.left - pad &&
        clientX <= rect.right + pad &&
        clientY >= rect.top - pad &&
        clientY <= rect.bottom + pad
      ) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(clientX - cx, clientY - cy);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = id;
        }
      }
    });

    return bestId;
  };

  // Fallback for quick flick swipes: find exact nearest card geometrically in the swipe direction
  const findDirectionalHandCardId = (
    sourceCardId: string,
    dx: number,
    dy: number
  ): string | null => {
    const mag = Math.hypot(dx, dy);
    if (mag < 22) return null;
    const ux = dx / mag;
    const uy = dy / mag;

    const nodes = document.querySelectorAll<HTMLElement>('[data-hand-card-id]');
    let sourceCenter: { x: number; y: number } | null = null;
    const candidates: Array<{ id: string; x: number; y: number }> = [];

    nodes.forEach((el) => {
      const id = el.dataset.handCardId;
      if (!id) return;
      const rect = el.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      if (id === sourceCardId) {
        sourceCenter = center;
      } else {
        candidates.push({ id, ...center });
      }
    });

    if (!sourceCenter) return null;
    const src = sourceCenter as { x: number; y: number };

    let bestId: string | null = null;
    let bestScore = Infinity;

    for (const c of candidates) {
      const vx = c.x - src.x;
      const vy = c.y - src.y;
      const dist = Math.hypot(vx, vy);
      if (dist < 8) continue;
      const cos = (vx * ux + vy * uy) / dist;
      if (cos < 0.5) continue;
      // Favor nearest card closely aligned with the exact swipe vector
      const score = dist / (cos * cos);
      if (score < bestScore) {
        bestScore = score;
        bestId = c.id;
      }
    }

    return bestId;
  };

  // Pointer/Touch Swipe-to-Switch Card: drags card visually and swaps ONLY with the exact card where it is swiped
  const handleCardPointerDown = (cardId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture is unsupported
    }
    swipeStateRef.current = {
      cardId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  };

  const handleCardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const sw = swipeStateRef.current;
    if (!sw || sw.pointerId !== e.pointerId) return;
    const dx = e.clientX - sw.startX;
    const dy = e.clientY - sw.startY;
    if (!sw.moved && Math.hypot(dx, dy) < 8) return;

    sw.moved = true;
    const hitId = findHitHandCardId(e.clientX, e.clientY, sw.cardId);
    const previewTarget = hitId ?? findDirectionalHandCardId(sw.cardId, dx, dy);
    setActiveSwipe({
      cardId: sw.cardId,
      dx,
      dy,
      targetCardId: previewTarget,
    });
  };

  const handleCardPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const sw = swipeStateRef.current;
    if (!sw || sw.pointerId !== e.pointerId) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    const dx = e.clientX - sw.startX;
    const dy = e.clientY - sw.startY;

    if (sw.moved) {
      const exactHitId = findHitHandCardId(e.clientX, e.clientY, sw.cardId);
      const resolvedTargetId = exactHitId ?? findDirectionalHandCardId(sw.cardId, dx, dy);

      if (resolvedTargetId && resolvedTargetId !== sw.cardId) {
        setHand((prev) => {
          const fromIdx = prev.findIndex((c) => c.id === sw.cardId);
          const toIdx = prev.findIndex((c) => c.id === resolvedTargetId);
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
          const copy = [...prev];
          [copy[fromIdx], copy[toIdx]] = [copy[toIdx], copy[fromIdx]];
          return copy;
        });
        playCardSelect();
        lastSwipeAtRef.current = Date.now();
        setStatusBanner('Switched exact cards!');
      } else {
        lastSwipeAtRef.current = Date.now();
      }
    }

    swipeStateRef.current = null;
    setActiveSwipe(null);
  };

  // Group Melds: if cards are selected (2+), tag & cluster them together; otherwise Auto-Group all valid melds
  const handleGroupMelds = () => {
    if (selectedIds.length >= 2) {
      playMeldChime();
      const groupId = nextMeldGroupNum;
      setNextMeldGroupNum((n) => (n >= 4 ? 1 : n + 1));
      setHand((prev) => {
        const picked = prev
          .filter((c) => selectedIds.includes(c.id))
          .map((c) => ({ ...c, meldGroup: groupId }));
        const rest = prev.filter((c) => !selectedIds.includes(c.id));
        return [...picked, ...rest];
      });
      setSelectedIds([]);
      setStatusBanner(`Grouped ${selectedIds.length} cards into Meld Group M${groupId}! Tap top "DOWN" on any card to drop melds.`);
      return;
    }

    playMeldChime();
    const { arranged, melds } = autoMeldHand(hand);
    setHand(arranged);
    setSelectedIds([]);
    setStatusBanner(
      melds.length > 0
        ? `Grouped ${melds.length} valid meld${melds.length > 1 ? 's' : ''}! Tap the green DOWN chip on top of a card to drop melds.`
        : 'Hand sorted! Swipe any card left/right to switch position.'
    );
  };

  const handleSortHand = () => {
    playCardSelect();
    setHand((prev) =>
      [...prev].sort((a, b) => {
        if (a.isJoker) return 1;
        if (b.isJoker) return -1;
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.value - b.value;
      })
    );
    setStatusBanner('Hand sorted by suit and rank!');
  };

  const handleUngroupHand = () => {
    playCardSelect();
    setHand((prev) => prev.map((c) => ({ ...c, meldGroup: undefined })));
    setStatusBanner('All card groups cleared (Ungrouped).');
  };

  // Drop Card to Switch (Balis-balis / Swap 2 selected cards smoothly in the 3-row layout)
  const handleDropToSwitch = () => {
    if (selectedIds.length !== 2) {
      setStatusBanner('Swipe any card left/right to switch — or select 2 cards and tap Switch.');
      return;
    }
    playCardSelect();
    setHand((prev) => {
      const idx1 = prev.findIndex((c) => c.id === selectedIds[0]);
      const idx2 = prev.findIndex((c) => c.id === selectedIds[1]);
      if (idx1 === -1 || idx2 === -1) return prev;
      const copy = [...prev];
      [copy[idx1], copy[idx2]] = [copy[idx2], copy[idx1]];
      return copy;
    });
    setSelectedIds([]);
    setStatusBanner('Cards switched cleanly!');
  };

  // Drop Melds (Baba) onto table
  const handleDropMelds = () => {
    const chosen = hand.filter((c) => selectedIds.includes(c.id));
    dropCardsAsMeld(chosen);
  };

  const handleSapawCard = (targetMeldId?: string) => {
    if (tableMelds.length === 0) {
      setStatusBanner('Drop a meld onto the table first before doing a Sapaw.');
      return;
    }
    if (selectedIds.length !== 1) {
      setStatusBanner('Select 1 card from your hand to Sapaw onto a shown meld.');
      return;
    }
    const card = hand.find((c) => c.id === selectedIds[0]);
    if (!card) return;

    const candidates = targetMeldId
      ? tableMelds.filter((m) => m.id === targetMeldId)
      : tableMelds;

    const matched = candidates.find((m) => isValidMeldSelection([...m.cards, card]));
    if (!matched) {
      setStatusBanner(`${card.isJoker ? 'JOKER' : card.rank + card.suit} cannot extend any shown meld yet.`);
      return;
    }

    playMeldChime();
    setTableMelds((prev) =>
      prev.map((m) =>
        m.id === matched.id
          ? { ...m, cards: [...m.cards, card].sort((a, b) => a.value - b.value) }
          : m
      )
    );
    const remaining = hand.filter((c) => c.id !== card.id);
    setHand(remaining);
    setSeats((prev) => prev.map((s) => (s.id === user.id ? { ...s, cardCount: remaining.length } : s)));
    setSelectedIds([]);
    setStatusBanner(`Sapaw! Attached ${card.isJoker ? 'JOKER' : card.rank + card.suit} onto ${matched.ownerName}'s meld.`);

    if (remaining.length === 0) {
      const winAmt = session.betAmount * (session.seats.length * 2);
      settleRoundOnServer(true, winAmt, session.betAmount * 2, 'TONG-ITS BY SAPAW!', `Zero cards left after Sapaw! Won +₱${winAmt.toFixed(2)}`);
    }
  };

  // Draw from center Card Pile
  const handleDrawDeck = () => {
    if (turnBusy) return;
    if (deck.length === 0) {
      handleTongitsFight();
      return;
    }
    playCardDraw();
    const [drawn, ...rest] = deck;
    setDeck(rest);
    setHand((prev) => {
      const next = [...prev, drawn];
      setSeats((seatsPrev) => seatsPrev.map((s) => (s.id === user.id ? { ...s, cardCount: next.length } : s)));
      return next;
    });
    setHasDrawnThisTurn(true);
    setStatusBanner(`Drew ${drawn.isJoker ? 'JOKER' : drawn.rank + drawn.suit} from Card Pile. Drop Melds or select 1 card to Drop.`);
  };

  // Get Card (pick up the opponent's face-up throw directed to you)
  const handleGetOpponentCard = () => {
    if (turnBusy) return;
    if (!topDiscard) {
      setStatusBanner('No thrown card to get yet. Tap Draw from the Card Pile.');
      return;
    }
    if (!isTopDiscardVisibleToMe) {
      setStatusBanner(`You can only Get Card when an opponent throws face-up to you. Tap Draw from the Card Pile.`);
      return;
    }
    playCardDraw();
    const picked = topDiscard.card;
    setDiscardPile((prev) => prev.slice(0, -1));
    setHand((prev) => {
      const next = [...prev, picked];
      setSeats((seatsPrev) => seatsPrev.map((s) => (s.id === user.id ? { ...s, cardCount: next.length } : s)));
      return next;
    });
    setHasDrawnThisTurn(true);
    setStatusBanner(`Got ${picked.isJoker ? 'JOKER' : picked.rank + picked.suit} from ${topDiscard.thrownByName}'s throw! Drop Melds or throw 1 card.`);
  };

  // Drop 1 Card (Labog) — visible face-up ONLY to the next receiver ("gilabogan"), hidden face-down from other players
  const handleDropCardLabog = () => {
    if (turnBusy) return;
    if (selectedIds.length !== 1) {
      setStatusBanner('Select 1 card from your hand to Drop / Labog.');
      return;
    }
    const cardToDrop = hand.find((c) => c.id === selectedIds[0]);
    if (!cardToDrop) return;

    const nextReceiver = opponents[0];
    playCardDrop();
    const remaining = hand.filter((c) => c.id !== cardToDrop.id);
    setHand(remaining);
    setSeats((prev) => prev.map((s) => (s.id === user.id ? { ...s, cardCount: remaining.length } : s)));
    setDiscardPile((prev) => [
      ...prev,
      {
        id: `disc-${Date.now()}-${cardToDrop.id}`,
        card: cardToDrop,
        thrownBySeatId: user.id,
        thrownByName: `${user.full_name} (You)`,
        targetSeatId: nextReceiver?.id || 'opp-1',
        targetSeatName: nextReceiver?.name || 'Player 2',
      },
    ]);
    setSelectedIds([]);
    setHasDrawnThisTurn(false);

    if (remaining.length === 0) {
      const winAmt = session.betAmount * (session.seats.length * 2);
      settleRoundOnServer(true, winAmt, session.betAmount * 2, 'TONG-ITS!', `Cleared hand! Won +₱${winAmt.toFixed(2)}`);
      return;
    }

    setTurnBusy(true);
    setStatusBanner(
      `Dropped to ${nextReceiver?.name || 'Player 2'} (face-up only for ${nextReceiver?.name || 'them'}, hidden from other players)...`
    );

    // Simulate realistic turn rotation around seated opponents
    if (opponents.length >= 2) {
      // 3-Player turn rotation: Opponent 1 throws to Opponent 2 (hidden/face-down to You), then Opponent 2 throws to You (face-up to You!)
      const opp1 = opponents[0];
      const opp2 = opponents[1];

      setTimeout(() => {
        setDeck((prevDeck) => {
          if (prevDeck.length < 2) {
            setTurnBusy(false);
            return prevDeck;
          }
          const opp1Throw = prevDeck[0];
          playCardDrop();
          setDiscardPile((dp) => [
            ...dp,
            {
              id: `disc-${Date.now()}-o1`,
              card: opp1Throw,
              thrownBySeatId: opp1.id,
              thrownByName: opp1.name,
              targetSeatId: opp2.id,
              targetSeatName: opp2.name,
            },
          ]);
          setStatusBanner(`${opp1.name} threw to ${opp2.name} (Hidden from you — visible only to ${opp2.name})...`);
          return prevDeck.slice(1);
        });
      }, 650);

      setTimeout(() => {
        setDeck((prevDeck) => {
          if (prevDeck.length === 0) {
            setTurnBusy(false);
            return prevDeck;
          }
          const opp2Throw = prevDeck[0];
          const remainingDeck = prevDeck.slice(1);
          playCardDrop();

          // Occasionally opponent drops a visible 3-card meld onto the table so Show Melds feels alive
          if (tableMelds.length < 3 && remainingDeck.length >= 6 && Math.random() < 0.35) {
            const sampleMeld = createShuffledDeck(false)
              .filter((c) => c.suit === '♥' && c.value >= 4 && c.value <= 6)
              .slice(0, 3);
            if (sampleMeld.length === 3) {
              setTableMelds((prev) => [
                ...prev,
                {
                  id: `opp-meld-${Date.now()}`,
                  ownerId: opp2.id,
                  ownerName: opp2.name,
                  cards: sampleMeld,
                },
              ]);
              setSeats((sPrev) =>
                sPrev.map((s) => (s.id === opp2.id ? { ...s, cardCount: Math.max(3, s.cardCount - 3) } : s))
              );
            }
          }

          setDiscardPile((dp) => [
            ...dp,
            {
              id: `disc-${Date.now()}-o2`,
              card: opp2Throw,
              thrownBySeatId: opp2.id,
              thrownByName: opp2.name,
              targetSeatId: user.id,
              targetSeatName: user.full_name,
            },
          ]);
          setStatusBanner(
            `${opp2.name} threw ${opp2Throw.isJoker ? 'JOKER' : opp2Throw.rank + opp2Throw.suit} face-up to YOU! Tap Get Card or Draw.`
          );
          setTimeLeft(session.turnSeconds);
          setTurnBusy(false);
          return remainingDeck;
        });
      }, 1350);
    } else {
      // 2-Player turn rotation: Player 2 throws face-up directly to YOU
      const opp1 = opponents[0];
      setTimeout(() => {
        setDeck((prevDeck) => {
          if (prevDeck.length === 0) {
            setTurnBusy(false);
            return prevDeck;
          }
          const oppThrow = prevDeck[0];
          const remainingDeck = prevDeck.slice(1);
          playCardDrop();
          setDiscardPile((dp) => [
            ...dp,
            {
              id: `disc-${Date.now()}-o1`,
              card: oppThrow,
              thrownBySeatId: opp1?.id || 'opp-1',
              thrownByName: opp1?.name || 'Player 2',
              targetSeatId: user.id,
              targetSeatName: user.full_name,
            },
          ]);
          setStatusBanner(
            `${opp1?.name || 'Player 2'} threw ${oppThrow.isJoker ? 'JOKER' : oppThrow.rank + oppThrow.suit} face-up to YOU! Tap Get Card or Draw.`
          );
          setTimeLeft(session.turnSeconds);
          setTurnBusy(false);
          return remainingDeck;
        });
      }, 720);
    }
  };

  // Center Throw/Get Pile direct tap handler ("Tap center in the card to throw & get card")
  const handleCenterDiscardTap = () => {
    if (turnBusy || fightCountdown?.active) return;

    // 1. If player has drawn and selected 1 card -> THROW directly onto center pile!
    if (hasDrawnThisTurn) {
      if (selectedIds.length === 1) {
        handleDropCardLabog();
      } else {
        setStatusBanner('Select 1 card in your hand, then tap the center pile to Throw!');
      }
      return;
    }

    // 2. If player hasn't drawn yet -> GET opponent's face-up thrown card (or guide to draw)
    if (isTopDiscardVisibleToMe && topDiscard) {
      handleGetOpponentCard();
    } else {
      setStatusBanner('Tap the Center Card Pile to Get/Draw a card!');
    }
  };

  // Resolve Fight showdown (called when 15s Fight countdown hits 0 or player confirms Showdown)
  const resolveTongitsFightShowdown = (specialTag: string | null) => {
    setFightCountdown(null);
    const { arranged } = autoMeldHand(hand);
    const myPoints = calculateDeadwood(arranged);
    const bot = opponents.find((o) => o.role === 'bot');
    const botRate = bot?.botWinRate ?? 80;
    const botRoll = Math.random() * 100;

    // Special Royal / Quadro gives strong advantage + bonus multiplier
    const effectiveBotRate = specialTag ? Math.max(15, botRate - 55) : botRate;
    const oppPoints =
      botRoll < effectiveBotRate
        ? Math.max(2, Math.min(myPoints - 2, Math.floor(Math.random() * 14) + 3))
        : myPoints + Math.floor(Math.random() * 18) + 4;

    const won = myPoints <= oppPoints;
    const mult = specialTag?.includes('ROYAL') ? 3 : specialTag?.includes('QUADRO') ? 2 : 1;
    const winAmount = session.betAmount * (session.seats.length - 1) * mult;
    const delta = won ? winAmount : -session.betAmount;
    const tagPrefix = specialTag ? `${specialTag} ` : '';
    settleRoundOnServer(
      won,
      delta,
      session.betAmount,
      won ? `${tagPrefix}FIGHT VICTORY!` : `${bot?.name || 'Opponent'} Won the Fight`,
      `${specialTag ? `[${specialTag} ${mult}x] ` : ''}Your hand: ${myPoints} pts vs ${bot?.name || 'Opponent'}: ${oppPoints} pts (${won ? '+' : ''}₱${delta.toFixed(2)})`
    );
  };

  // Keep latest resolver in a ref for the 15-second Fight countdown interval
  const fightResolveRef = useRef<(finished: FightCountdownState) => void>(() => {});
  useEffect(() => {
    fightResolveRef.current = (finished: FightCountdownState) => {
      if (finished.initiatedBy === 'opponent') {
        // Player failed to answer opponent's fight in 15s -> auto fold
        setFightCountdown(null);
        handleTongitsFold();
      } else {
        resolveTongitsFightShowdown(finished.specialTag);
      }
    };
  });

  // 15-Second Fight Countdown Ticker
  useEffect(() => {
    if (!fightCountdown?.active) return;
    const interval = setInterval(() => {
      setFightCountdown((prev) => {
        if (!prev || !prev.active) return prev;
        if (prev.secondsLeft <= 1) {
          const finished = prev;
          setTimeout(() => fightResolveRef.current(finished), 0);
          return null;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fightCountdown?.active]);

  // Fight (Labanan / Challenge Showdown with 15-second countdown + Royal/Quadro draw-fight rule)
  const handleTongitsFight = () => {
    if (turnBusy || fightCountdown?.active) return;

    // Enforce Special Card Rule:
    // After drawing a card, ONLY Royal or Quadro can call Fight (unless stock deck is empty).
    if (hasDrawnThisTurn && !specialHand.canFightAfterDraw && deck.length > 0) {
      setStatusBanner(
        'Fight is only allowed BEFORE drawing — unless you hold special cards ROYAL or QUADRO!'
      );
      return;
    }

    playMeldChime();
    const specialTag = specialHand.labels.length > 0 ? specialHand.labels.join(' + ') : null;
    setFightCountdown({
      active: true,
      secondsLeft: FIGHT_COUNTDOWN_SECONDS,
      initiatedBy: 'player',
      initiatorName: `${user.full_name} (You)`,
      specialTag,
    });
    setStatusBanner(
      specialTag
        ? `${specialTag} FIGHT called after draw! 15-second Fight Countdown started!`
        : 'FIGHT called! 15-second Fight Countdown active — opponents deciding...'
    );
  };

  // Fold (Tupi)
  const handleTongitsFold = () => {
    if (turnBusy) return;
    setFightCountdown(null);
    const foldLoss = -session.betAmount;
    settleRoundOnServer(
      false,
      foldLoss,
      session.betAmount,
      'Hand Folded',
      `You folded this round (${foldLoss.toFixed(2)}). Ready for the next deal!`
    );
  };

  // ==================== PUSOY ACTIONS ====================

  const handlePusoyCardClick = (row: 'front' | 'middle' | 'back', idx: number) => {
    playCardSelect();
    if (!pusoySelected) {
      setPusoySelected({ row, idx });
      return;
    }
    if (pusoySelected.row === row && pusoySelected.idx === idx) {
      setPusoySelected(null);
      return;
    }

    const rows = {
      front: [...pusoyFront],
      middle: [...pusoyMiddle],
      back: [...pusoyBack],
    };
    const temp = rows[pusoySelected.row][pusoySelected.idx];
    rows[pusoySelected.row][pusoySelected.idx] = rows[row][idx];
    rows[row][idx] = temp;

    setPusoyFront(rows.front);
    setPusoyMiddle(rows.middle);
    setPusoyBack(rows.back);
    setPusoySelected(null);
    playCardDrop();
    setStatusBanner('Balis-balis swapped! Tap Auto-Meld or Submit Pusoy Hand.');
  };

  const handlePusoyAutoMeld = () => {
    playMeldChime();
    const all13 = [...pusoyFront, ...pusoyMiddle, ...pusoyBack];
    const arranged = autoArrangePusoy(all13);
    setPusoyFront(arranged.front);
    setPusoyMiddle(arranged.middle);
    setPusoyBack(arranged.back);
    setPusoySelected(null);
    setStatusBanner('Pusoy Auto-Meld arranged optimal Back, Middle & Front rows!');
  };

  const handlePusoySubmit = () => {
    const fEval = evaluateFiveCardHand(pusoyFront);
    const mEval = evaluateFiveCardHand(pusoyMiddle);
    const bEval = evaluateFiveCardHand(pusoyBack);
    const totalScore = fEval.score + mEval.score + bEval.score;

    const bot = opponents.find((o) => o.role === 'bot');
    const botWins = Math.random() * 100 < (bot?.botWinRate ?? 80) && totalScore < 950;
    const won = !botWins;
    const units = won ? 3 : -2;
    const delta = units * session.betAmount;

    settleRoundOnServer(
      won,
      delta,
      session.betAmount * 2,
      won ? 'Pusoy Scoop Victory!' : `${bot?.name || 'MasterCard_PH'} Took the Table`,
      `Front: ${fEval.label} · Mid: ${mEval.label} · Back: ${bEval.label} (${delta >= 0 ? '+' : ''}₱${delta.toFixed(2)})`
    );
  };

  // ==================== LUCKY 9 ACTIONS ====================

  const handleLucky9Hirit = () => {
    if (lucky9Player.length >= 3 || lucky9Revealed || deck.length === 0) return;
    playCardDraw();
    const [drawn, ...rest] = deck;
    setLucky9Player((prev) => [...prev, drawn]);
    setDeck(rest);
    setStatusBanner(`Hirit! Drew ${drawn.rank}${drawn.suit}. Tap Good (Reveal) to compare with Banker.`);
  };

  const handleLucky9Reveal = () => {
    if (lucky9Revealed) return;
    playCardDrop();
    let finalBanker = [...lucky9Banker];
    if (scoreLucky9(finalBanker) < 5 && deck.length > 0) {
      finalBanker = [...finalBanker, deck[0]];
      setLucky9Banker(finalBanker);
    }
    setLucky9Revealed(true);

    const pScore = scoreLucky9(lucky9Player);
    const bScore = scoreLucky9(finalBanker);
    const won = pScore > bScore;
    const isLucky9 = pScore === 9 && won;
    const delta = pScore === bScore ? 0 : won ? session.betAmount * (isLucky9 ? 2 : 1) : -session.betAmount;

    settleRoundOnServer(
      won,
      delta,
      session.betAmount,
      pScore === bScore ? 'Push (Tie)' : isLucky9 ? 'LUCKY 9 NATURAL!' : won ? 'You Beat the Banker!' : 'Banker Wins Hand',
      `Your Total: ${pScore} vs Banker (${highestWalletBanker?.name || 'Banker'}): ${bScore} (${delta >= 0 ? '+' : ''}₱${delta.toFixed(2)})`
    );
  };

  // ==================== TEXAS POKER ACTIONS ====================

  const handlePokerAction = (action: 'call' | 'raise' | 'fold') => {
    if (action === 'fold') {
      settleRoundOnServer(false, -session.betAmount, session.betAmount, 'Folded Hand', `Forfeited ₱${session.betAmount.toFixed(2)} blind.`);
      return;
    }

    playChipClink();
    const addAmt = action === 'raise' ? session.betAmount * 2 : session.betAmount;
    const nextPot = pokerPot + addAmt * 2;
    setPokerPot(nextPot);

    if (pokerStage === 'preflop') {
      playCardDealBurst();
      setPokerCommunity(deck.slice(0, 3));
      setDeck((d) => d.slice(3));
      setPokerStage('flop');
      setStatusBanner('Flop dealt! Check/Call, Raise, or Fold.');
    } else if (pokerStage === 'flop') {
      playCardDraw();
      setPokerCommunity((c) => [...c, deck[0]]);
      setDeck((d) => d.slice(1));
      setPokerStage('turn');
      setStatusBanner('Turn card revealed! Final action before River.');
    } else if (pokerStage === 'turn') {
      playCardDraw();
      setPokerCommunity((c) => [...c, deck[0]]);
      setDeck((d) => d.slice(1));
      setPokerStage('river');
      setStatusBanner('River card revealed! Tap Showdown to compare 5-card hands.');
    } else {
      setPokerStage('showdown');
      const myBest = evaluateFiveCardHand([...pokerHole, ...pokerCommunity.slice(0, 3)]);
      const oppBest = evaluateFiveCardHand([...pokerOppHole, ...pokerCommunity.slice(0, 3)]);
      const won = myBest.score >= oppBest.score;
      const delta = won ? Math.round(nextPot * 0.6) : -session.betAmount * 2;
      settleRoundOnServer(
        won,
        delta,
        session.betAmount * 2,
        won ? `Poker Showdown Win (${myBest.label})` : `Opponent Wins (${oppBest.label})`,
        `Your hand: ${myBest.label} vs Opponent: ${oppBest.label} (${delta >= 0 ? '+' : ''}₱${delta.toFixed(2)})`
      );
    }
  };

  // ==================== BET GAME ACTIONS ====================

  const handleBetGameFlip = () => {
    playCardDealBurst();
    const d = createShuffledDeck(false);
    const bCard = d[0];
    const pCard = d[1];
    setBetGameCards({ banker: bCard, player: pCard });

    let won = false;
    let multiplier = 1;
    if (betChoice === 'banker') won = bCard.value > pCard.value;
    else if (betChoice === 'player') won = pCard.value > bCard.value;
    else if (betChoice === 'tie') {
      won = pCard.value === bCard.value;
      multiplier = 8;
    } else if (betChoice === 'red') won = pCard.isRed;
    else if (betChoice === 'black') won = !pCard.isRed;

    const delta = won ? session.betAmount * multiplier : -session.betAmount;
    settleRoundOnServer(
      won,
      delta,
      session.betAmount,
      won ? `Bet Game Hit (${betChoice.toUpperCase()})!` : 'House Won the Flip',
      `Banker ${bCard.rank}${bCard.suit} vs Player ${pCard.rank}${pCard.suit} (${delta >= 0 ? '+' : ''}₱${delta.toFixed(2)})`
    );
  };

  // ==================== COLOR GAME (3 DICE SQUARE) ACTIONS ====================

  const handleStakeColor = (colorId: string) => {
    if (rollingDice) return;
    playChipClink();
    setColorBets((prev) => ({
      ...prev,
      [colorId]: (prev[colorId] || 0) + session.betAmount,
    }));
  };

  const handleRollColorDice = () => {
    const totalStake = Object.values(colorBets).reduce((a, b) => a + b, 0);
    if (totalStake <= 0) {
      setStatusBanner('Tap at least one Color Square to place your chip before rolling!');
      return;
    }
    setRollingDice(true);
    playDiceRoll();

    let ticks = 0;
    const anim = setInterval(() => {
      ticks++;
      setDiceResults([
        COLOR_GAME_SQUARES[Math.floor(Math.random() * 6)].id,
        COLOR_GAME_SQUARES[Math.floor(Math.random() * 6)].id,
        COLOR_GAME_SQUARES[Math.floor(Math.random() * 6)].id,
      ]);
      if (ticks >= 8) {
        clearInterval(anim);
        const finalDice = [
          COLOR_GAME_SQUARES[Math.floor(Math.random() * 6)].id,
          COLOR_GAME_SQUARES[Math.floor(Math.random() * 6)].id,
          COLOR_GAME_SQUARES[Math.floor(Math.random() * 6)].id,
        ];
        setDiceResults(finalDice);
        setRollingDice(false);

        let grossReturn = 0;
        for (const [colorId, stake] of Object.entries(colorBets)) {
          const matches = finalDice.filter((d) => d === colorId).length;
          if (matches > 0) {
            grossReturn += stake + stake * matches;
          }
        }
        const netDelta = grossReturn - totalStake;
        const won = netDelta > 0;
        settleRoundOnServer(
          won,
          netDelta,
          totalStake,
          won ? `Color Game Win (+₱${netDelta.toFixed(2)})!` : 'Dice Rolled — Try Next Round!',
          `Rolled: ${finalDice.map((c) => c.toUpperCase()).join(' · ')} | Stake ₱${totalStake}`
        );
      }
    }, 85);
  };

  // ==================== MESSENGER, EMOJIS & SETTINGS ====================

  const handleQuickEmoji = (emoji: string) => {
    playCardSelect();
    onSendChat(emoji, true);
    setMyFloatingEmoji(emoji);
    setTimeout(() => setMyFloatingEmoji(null), 2200);

    // Friendly live reaction from a seated bot opponent
    const botOpp = opponents.find((o) => o.role === 'bot');
    if (botOpp) {
      const replies = ['🔥', '😎', '👏', '😂', '💸'];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      setTimeout(() => {
        setOpponentEmojis((prev) => ({ ...prev, [botOpp.id]: reply }));
        setTimeout(() => {
          setOpponentEmojis((prev) => {
            if (prev[botOpp.id] !== reply) return prev;
            const next = { ...prev };
            delete next[botOpp.id];
            return next;
          });
        }, 2200);
      }, 850);
    }
  };

  const handleConfirmSwitchTable = async () => {
    setSwitchBusy(true);
    setSwitchError(null);
    const err = await onSwitchTable(switchBet, switchVariant, switchMaxPlayers, switchTableId);
    setSwitchBusy(false);
    if (err) {
      setSwitchError(err);
    } else {
      setSwitchModalOpen(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = chatInput.trim();
    if (!txt) return;
    onSendChat(txt, false);
    setChatInput('');
  };

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  // Bind live timeout handler for every table type when countdown reaches 00:00
  useEffect(() => {
    onTimeoutRef.current = () => {
      if (roundResult) {
        dealFreshRound();
        return;
      }
      if (session.gameKey === 'tongits' || session.gameKey === 'tsekitsa') {
        if (hand.length > 0 && !turnBusy) {
          const highestCard = [...hand].sort((a, b) => b.value - a.value)[0];
          const nextReceiver = opponents[0];
          playCardDrop();
          const remaining = hand.filter((c) => c.id !== highestCard.id);
          setHand(remaining);
          setSeats((prev) => prev.map((s) => (s.id === user.id ? { ...s, cardCount: remaining.length } : s)));
          setDiscardPile((prev) => [
            ...prev,
            {
              id: `disc-timeout-${Date.now()}`,
              card: highestCard,
              thrownBySeatId: user.id,
              thrownByName: `${user.full_name} (You)`,
              targetSeatId: nextReceiver?.id || 'opp-1',
              targetSeatName: nextReceiver?.name || 'Player 2',
            },
          ]);
          setSelectedIds([]);
          setHasDrawnThisTurn(false);
          setStatusBanner(`45s Throw Timer expired! Auto-dropped highest card to ${nextReceiver?.name || 'Player 2'}.`);
        }
      } else if (session.gameKey === 'pusoy') {
        setStatusBanner('45s Pusoy Deal Timer expired! Auto-submitting arranged 13-card hand.');
        handlePusoySubmit();
      } else if (session.gameKey === 'colorgame') {
        const stakedTotal = Object.values(colorBets).reduce((a, b) => a + b, 0);
        if (stakedTotal > 0 && !rollingDice) {
          setStatusBanner('30s Color Game Countdown finished! Auto-rolling 3 dice.');
          handleRollColorDice();
        } else {
          setStatusBanner('New 30s Color Game round started! Tap any color square to place bets.');
        }
      } else if (session.gameKey === 'lucky9') {
        setStatusBanner('15m Lucky 9 Banker Countdown cycled — Highest Wallet Banker updated!');
      } else if (session.gameKey === 'poker') {
        setStatusBanner('15m Texas Poker table timer cycled — Place your next action.');
      } else if (session.gameKey === 'betgame') {
        setStatusBanner('15m Bet Game table timer cycled — Select side and tap Deal & Flip.');
      }
    };
  });

  const timerLabel =
    session.gameKey === 'tongits'
      ? 'Throw Timer'
      : session.gameKey === 'pusoy'
        ? 'Deal Timer'
        : session.gameKey === 'tsekitsa'
          ? 'Turn Timer'
          : session.gameKey === 'lucky9'
            ? 'Banker Timer'
            : session.gameKey === 'colorgame'
              ? 'Roll Timer'
              : 'Table Timer';

  const timerPct = Math.max(0, Math.min(100, (timeLeft / Math.max(1, session.turnSeconds)) * 100));
  const timerUrgent = timeLeft <= 10;

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isFullscreenActive());

  useEffect(() => {
    const syncFs = () => setIsFullscreen(isFullscreenActive());
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs as EventListener);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    const active = await toggleGameFullscreenLandscape();
    setIsFullscreen(active);
  };

  return (
    <div className="fixed inset-0 z-30 h-[100dvh] w-screen bg-[#02140f] flex flex-col overflow-hidden p-1.5 sm:p-2 gap-1.5">
      {/* Compact Top In-Game Bar with Live Countdown Timer & Progress Bar */}
      <div className="shrink-0 rounded-2xl border border-emerald-800/80 bg-[#04241c] overflow-hidden shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className="font-display text-sm font-extrabold text-amber-300 uppercase">
              {session.gameName}
              {session.gameKey === 'tongits' ? ` · ${session.variant}` : ''}
            </span>
            <span className="font-mono-num text-emerald-200">
              Bet ₱{session.betAmount}
            </span>
            <span
              className={`font-mono-num font-extrabold px-2 py-0.5 rounded-md transition-colors ${
                timerUrgent
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-amber-400/20 border border-amber-400/60 text-amber-200'
              }`}
            >
              {timerLabel}: {formatTimer(timeLeft)}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Landscape'}
              aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen landscape'}
              className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1.5 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                isFullscreen
                  ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                  : 'border-emerald-700/80 bg-[#031c16] text-emerald-200 hover:border-amber-400 hover:text-amber-300'
              }`}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit Full' : 'Full Screen'}</span>
            </button>
            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              className="rounded-xl border border-emerald-700/80 bg-[#031c16] p-1.5 sm:p-2 text-emerald-200 hover:text-amber-300 cursor-pointer"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMilestonesOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-700/80 bg-[#031c16] px-2.5 py-1.5 text-xs font-bold text-emerald-100 hover:border-amber-400 cursor-pointer whitespace-nowrap"
            >
              <Flag className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Milestones</span>
            </button>
            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-700/80 bg-[#031c16] px-2.5 py-1.5 text-xs font-bold text-emerald-100 hover:border-amber-400 cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Messenger</span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-2.5 sm:px-3 py-1.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          </div>
        </div>
        <div className="h-1 w-full bg-emerald-950">
          <div
            className={`h-full transition-all duration-1000 linear ${
              timerUrgent ? 'bg-red-500' : 'bg-amber-400'
            }`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </div>

      {/* In-Game Settings Drawer (Switch Table, Add Coins, Messenger, Exit) */}
      {settingsOpen && (
        <div className="shrink-0 rounded-2xl border border-amber-400/50 bg-[#052920] p-3 flex flex-wrap items-center justify-between gap-2 shadow-xl">
          <span className="text-xs font-bold text-amber-300">In-Game Settings</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setSwitchError(null);
                setSwitchModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Switch Table
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                onOpenAddCoins();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
            >
              <Coins className="h-3.5 w-3.5" />
              Add Coins
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setChatOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-[#031c16] px-3 py-2 text-xs font-bold text-emerald-100 hover:border-amber-400 cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Messenger
            </button>
            <button
              type="button"
              onClick={onExitTable}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-500 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              Exit Table
            </button>
          </div>
        </div>
      )}

      {/* ==================== FELT GAME ARENA (100% FULL SCREEN EDGE-TO-EDGE) ==================== */}
      <div className="felt-surface flex-1 min-h-0 w-full rounded-2xl p-2 sm:p-4 flex flex-col justify-between relative overflow-y-auto overflow-x-hidden">
        {/* TOP ROW: ALL SEATED OPPONENTS VISIBLE ON PHONE & DESKTOP */}
        <div className="flex items-start justify-between gap-2 relative z-10">
          {opponents.map((opp, idx) => (
            <div
              key={opp.id}
              className={`relative rounded-2xl border px-2.5 py-2 sm:px-3.5 sm:py-2.5 bg-black/55 backdrop-blur-xs min-w-[112px] sm:min-w-[155px] ${
                opp.isBanker ? 'border-amber-400' : 'border-white/15'
              }`}
            >
              {opponentEmojis[opp.id] && (
                <div className="absolute -bottom-3 right-2 z-20 rounded-full bg-black/80 border border-amber-400/60 px-2 py-0.5 text-lg shadow-lg animate-bounce">
                  {opponentEmojis[opp.id]}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-extrabold ${
                    idx === 0 ? 'bg-amber-400 text-emerald-950' : 'bg-sky-400 text-slate-950'
                  }`}
                >
                  {opp.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-white truncate max-w-[76px] sm:max-w-[105px]">
                      {opp.name}
                    </span>
                    {opp.isBanker && <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                  </div>
                  <p className="font-mono-num text-[10px] text-amber-300">
                    ₱{opp.tableWallet.toLocaleString()} · VIP {opp.vipLevel}
                  </p>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-emerald-200 border-t border-white/10 pt-1">
                <span>{opp.isBanker ? 'Banker (High Wallet)' : `${opp.cardCount} Cards`}</span>
                <span className="font-mono-num text-emerald-300">Seated</span>
              </div>
            </div>
          ))}

          {/* Clickable Center Pot & Milestone HUD */}
          <button
            type="button"
            onClick={() => setMilestonesOpen(true)}
            className="hidden md:flex flex-col items-center text-center bg-black/45 border border-amber-400/30 hover:border-amber-400 rounded-2xl px-4 py-2 transition-colors cursor-pointer"
          >
            <span className="text-[10px] text-emerald-300 uppercase tracking-wider">Table Pot · Hand #{handsPlayed + 1}</span>
            <strong className="font-mono-num text-lg font-extrabold text-amber-300">
              ₱{pot.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </strong>
            <span className="text-[10px] text-emerald-200 truncate max-w-[200px]">
              {milestones[0]?.label || 'View Table Milestones →'}
            </span>
          </button>
        </div>

        {/* Status Banner */}
        <div className="my-2 text-center relative z-10">
          <p className="inline-block rounded-xl bg-black/55 border border-white/15 px-3.5 py-1.5 text-xs font-medium text-amber-200 max-w-xl">
            {statusBanner}
          </p>
        </div>

        {/* ==================== GAME-SPECIFIC CENTER INTERACTION ZONE ==================== */}
        <LayoutGroup id={`table-cards-${session.tableId}`}>
        <div className="my-2 flex-1 flex flex-col justify-center relative z-10">
          {/* 1. PRO TONG-ITS & TSEKITSA CENTER: CARD PILE + TARGET-VISIBLE THROW (FACE-UP ONLY TO RECEIVER) + SHOW MELDS */}
          {(session.gameKey === 'tongits' || session.gameKey === 'tsekitsa') && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                {/* Clickable Center Card Pile (Tap Center to Get / Draw) */}
                <div className="flex flex-col items-center gap-1.5">
                  <motion.div
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.94 }}
                    transition={CARD_SPRING}
                    className={`rounded-2xl p-0.5 transition-all ${
                      !hasDrawnThisTurn && !turnBusy
                        ? 'ring-2 ring-amber-400/90 shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                        : ''
                    }`}
                  >
                    <PlayingCard
                      faceDown
                      backLabel={!hasDrawnThisTurn ? 'TAP GET' : 'CARD PILE'}
                      onClick={handleDrawDeck}
                    />
                  </motion.div>
                  <div className="text-center">
                    <span className="font-mono-num text-xs font-bold text-amber-200 block">
                      Card Pile ({deck.length})
                    </span>
                    <span className="text-[10px] font-bold text-amber-300/90 block">
                      {!hasDrawnThisTurn ? 'Tap Center to Get Card' : 'Stock Deck'}
                    </span>
                  </div>
                </div>

                {/* Center Throw / Get Pile — Tap center card to THROW selected card or GET face-up throw */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative">
                    {hasDrawnThisTurn && selectedIds.length === 1 && !turnBusy && (
                      <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-md bg-emerald-400 px-2 py-0.5 text-[10px] font-extrabold text-emerald-950 shadow-md animate-bounce">
                        TAP CENTER TO THROW
                      </div>
                    )}
                    {!hasDrawnThisTurn && isTopDiscardVisibleToMe && !turnBusy && (
                      <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-emerald-950 shadow-md">
                        TAP CENTER TO GET
                      </div>
                    )}
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.div
                        key={topDiscard?.id || 'empty-discard'}
                        initial={{ opacity: 0, y: 34, scale: 0.86, rotate: -8 }}
                        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, y: 24, scale: 0.82, rotate: 6 }}
                        transition={CARD_SPRING}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.94 }}
                      >
                        {topDiscard ? (
                          isTopDiscardVisibleToMe ? (
                            <div className="relative flex flex-col items-center">
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-black text-emerald-950 shadow-lg animate-pulse border border-white">
                                🎯 THROWN TO YOU BY {topDiscard.thrownByName.toUpperCase()}
                              </div>
                              <div
                                className={`rounded-2xl p-0.5 transition-all ${
                                  hasDrawnThisTurn && selectedIds.length === 1
                                    ? 'ring-2 ring-emerald-400 shadow-[0_0_28px_rgba(52,211,153,0.8)]'
                                    : 'ring-2 ring-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.65)]'
                                }`}
                              >
                                <PlayingCard
                                  card={topDiscard.card}
                                  layoutId={`card-${topDiscard.card.id}`}
                                  onClick={handleCenterDiscardTap}
                                />
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`rounded-2xl p-0.5 transition-all ${
                                hasDrawnThisTurn && selectedIds.length === 1
                                  ? 'ring-2 ring-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.65)]'
                                  : ''
                              }`}
                            >
                              <PlayingCard
                                faceDown
                                backLabel={hasDrawnThisTurn && selectedIds.length === 1 ? 'THROW HERE' : 'HIDDEN'}
                                onClick={handleCenterDiscardTap}
                              />
                            </div>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={handleCenterDiscardTap}
                            className={`w-[56px] h-[82px] sm:w-[68px] sm:h-[98px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-[10px] font-extrabold text-center px-1 transition-all cursor-pointer ${
                              hasDrawnThisTurn && selectedIds.length === 1
                                ? 'border-emerald-300 bg-emerald-500/25 text-emerald-100 ring-2 ring-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.55)]'
                                : 'border-emerald-400/45 bg-black/25 text-emerald-200/80 hover:border-amber-400'
                            }`}
                          >
                            <span>{hasDrawnThisTurn && selectedIds.length === 1 ? 'TAP TO THROW' : 'CENTER THROW'}</span>
                          </button>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div className="text-center">
                    <span className="font-mono-num text-xs font-bold text-emerald-200 block">
                      {topDiscard
                        ? isTopDiscardVisibleToMe
                          ? `Face-Up to You (${discardPile.length})`
                          : `Center Pile (${discardPile.length})`
                        : 'Center Throw (0)'}
                    </span>
                    <span className="text-[10px] text-amber-300/90 block">
                      {hasDrawnThisTurn
                        ? selectedIds.length === 1
                          ? 'Tap center to Throw selected card'
                          : 'Select 1 card & tap center to Throw'
                        : topDiscard
                          ? isTopDiscardVisibleToMe
                            ? `From ${topDiscard.thrownByName} · Tap to Get`
                            : `Only ${topDiscard.targetSeatName} can see`
                          : 'Tap center to Throw or Get'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Show Melds Table Display — Your Melds & Opponent Melds (Click any meld with 1 selected card to Sapaw) */}
              <AnimatePresence>
                {showMeldsPanel && tableMelds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={CARD_SPRING}
                    className="rounded-2xl bg-black/35 border border-emerald-500/35 p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-amber-300">
                        Shown Table Melds ({tableMelds.length})
                      </span>
                      <span className="text-[10px] text-emerald-300">
                        Select 1 card & tap any meld to Sapaw
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {tableMelds.map((meld) => (
                        <motion.button
                          key={meld.id}
                          layout
                          initial={{ opacity: 0, scale: 0.85, y: 16 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={CARD_SPRING}
                          type="button"
                          onClick={() => selectedIds.length === 1 && handleSapawCard(meld.id)}
                          className="flex flex-col items-center gap-1 rounded-2xl bg-black/45 border border-emerald-400/40 hover:border-amber-400 px-2.5 py-1.5 transition-colors cursor-pointer"
                        >
                          <span className="text-[9px] font-bold text-emerald-200">{meld.ownerName}</span>
                          <div className="flex items-center -space-x-3">
                            <AnimatePresence mode="popLayout">
                              {meld.cards.map((card) => (
                                <motion.div
                                  key={card.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.75, y: 16 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.7 }}
                                  transition={CARD_SPRING}
                                >
                                  <PlayingCard card={card} layoutId={`card-${card.id}`} compact />
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* 2. PUSOY 13-CARD 3-ROW CLICKABLE SWAP ARENA */}
          {session.gameKey === 'pusoy' && (
            <div className="space-y-2.5 max-w-2xl mx-auto w-full">
              {[
                { key: 'front' as const, label: 'Front (3)', cards: pusoyFront },
                { key: 'middle' as const, label: 'Middle (5)', cards: pusoyMiddle },
                { key: 'back' as const, label: 'Back (5)', cards: pusoyBack },
              ].map((row) => {
                const evalRes = evaluateFiveCardHand(row.cards);
                return (
                  <div
                    key={row.key}
                    className="rounded-2xl bg-black/35 border border-white/15 px-3 py-2 flex flex-col sm:flex-row items-center justify-between gap-2"
                  >
                    <div className="text-left min-w-[105px]">
                      <span className="text-xs font-bold text-amber-300 block">{row.label}</span>
                      <span className="text-[11px] text-emerald-200">{evalRes.label}</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      <AnimatePresence mode="popLayout">
                        {row.cards.map((card, idx) => (
                          <motion.div
                            key={card.id}
                            layout
                            initial={{ opacity: 0, y: -26, scale: 0.82 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.78 }}
                            transition={{ ...CARD_SPRING, delay: Math.min(idx * 0.02, 0.12) }}
                          >
                            <PlayingCard
                              card={card}
                              layoutId={`card-${card.id}`}
                              compact
                              selected={pusoySelected?.row === row.key && pusoySelected.idx === idx}
                              onClick={() => handlePusoyCardClick(row.key, idx)}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handlePusoyAutoMeld}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="h-4 w-4" />
                  Auto-Meld / Plastar
                </button>
                <button
                  type="button"
                  onClick={handlePusoySubmit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-5 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 cursor-pointer whitespace-nowrap"
                >
                  <Trophy className="h-4 w-4" />
                  Submit & Compare Hand
                </button>
              </div>
            </div>
          )}

          {/* 3. LUCKY 9 ARENA (HIGHEST WALLET AUTO-BANKER) */}
          {session.gameKey === 'lucky9' && (
            <div className="space-y-4 max-w-xl mx-auto w-full text-center">
              <div className="rounded-2xl bg-black/40 border border-amber-400/35 p-3">
                <p className="text-xs font-bold text-amber-300 mb-2">
                  Banker ({highestWalletBanker?.name || 'High Wallet'} · ₱{highestWalletBanker?.tableWallet.toLocaleString()})
                  {lucky9Revealed ? ` — Score: ${scoreLucky9(lucky9Banker)}` : ' — Face-Down'}
                </p>
                <div className="flex justify-center gap-2.5">
                  <AnimatePresence mode="popLayout">
                    {lucky9Banker.map((c, idx) => (
                      <motion.div
                        key={c.id}
                        layout
                        initial={{ opacity: 0, y: -32, scale: 0.82, rotate: -6 }}
                        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, y: -24, scale: 0.8 }}
                        transition={{ ...CARD_SPRING, delay: idx * 0.05 }}
                      >
                        <PlayingCard card={c} layoutId={`card-${c.id}`} faceDown={!lucky9Revealed} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              <div className="rounded-2xl bg-black/35 border border-emerald-400/40 p-3">
                <p className="text-xs font-bold text-white mb-2">
                  Your Hand — Lucky 9 Score:{' '}
                  <strong className="font-mono-num text-amber-300 text-base">{scoreLucky9(lucky9Player)}</strong>
                </p>
                <div className="flex justify-center gap-2.5">
                  <AnimatePresence mode="popLayout">
                    {lucky9Player.map((c, idx) => (
                      <motion.div
                        key={c.id}
                        layout
                        initial={{ opacity: 0, y: -36, scale: 0.82, rotate: 5 }}
                        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, y: 28, scale: 0.8 }}
                        transition={{ ...CARD_SPRING, delay: idx * 0.05 }}
                      >
                        <PlayingCard card={c} layoutId={`card-${c.id}`} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex justify-center gap-2.5">
                <button
                  type="button"
                  disabled={lucky9Player.length >= 3 || lucky9Revealed}
                  onClick={handleLucky9Hirit}
                  className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  Hirit (Draw 3rd Card)
                </button>
                <button
                  type="button"
                  disabled={lucky9Revealed}
                  onClick={handleLucky9Reveal}
                  className="rounded-xl bg-emerald-400 px-5 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  Good (Reveal & Settle)
                </button>
              </div>
            </div>
          )}

          {/* 4. TEXAS POKER ARENA */}
          {session.gameKey === 'poker' && (
            <div className="space-y-4 max-w-2xl mx-auto w-full text-center">
              <div className="rounded-2xl bg-black/40 border border-white/15 p-3">
                <p className="text-xs text-emerald-200 mb-2">
                  Community Board · Pot <strong className="font-mono-num text-amber-300">₱{pokerPot}</strong> ({pokerStage.toUpperCase()})
                </p>
                <div className="flex justify-center gap-2 min-h-[84px] items-center">
                  {pokerCommunity.length === 0 ? (
                    <span className="text-xs text-emerald-300">Waiting for Flop...</span>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {pokerCommunity.map((c, idx) => (
                        <motion.div
                          key={c.id}
                          layout
                          initial={{ opacity: 0, x: -24, y: -24, scale: 0.82 }}
                          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -18, scale: 0.8 }}
                          transition={{ ...CARD_SPRING, delay: idx * 0.04 }}
                        >
                          <PlayingCard card={c} layoutId={`card-${c.id}`} compact />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <AnimatePresence mode="popLayout">
                  {pokerHole.map((c, idx) => (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: -36, scale: 0.84, rotate: idx === 0 ? -6 : 6 }}
                      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, y: 24, scale: 0.8 }}
                      transition={{ ...CARD_SPRING, delay: idx * 0.06 }}
                    >
                      <PlayingCard card={c} layoutId={`card-${c.id}`} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePokerAction('call')}
                  className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 cursor-pointer whitespace-nowrap"
                >
                  {pokerStage === 'river' ? 'Showdown' : 'Check / Call'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePokerAction('raise')}
                  className="rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
                >
                  Raise (+₱{session.betAmount * 2})
                </button>
                <button
                  type="button"
                  onClick={() => handlePokerAction('fold')}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-red-500 cursor-pointer whitespace-nowrap"
                >
                  Fold
                </button>
              </div>
            </div>
          )}

          {/* 5. BET GAME ARENA */}
          {session.gameKey === 'betgame' && (
            <div className="space-y-4 max-w-xl mx-auto w-full text-center">
              <div className="flex items-center justify-center gap-8">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-xs font-bold text-amber-300">BANKER</span>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={betGameCards.banker?.id || 'banker-facedown'}
                      initial={{ opacity: 0, rotateY: 75, scale: 0.86 }}
                      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                      exit={{ opacity: 0, rotateY: -75, scale: 0.86 }}
                      transition={{ duration: 0.22 }}
                    >
                      <PlayingCard card={betGameCards.banker || undefined} faceDown={!betGameCards.banker} backLabel="BANKER" />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <span className="font-display text-xl font-extrabold text-amber-400">VS</span>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-xs font-bold text-emerald-300">PLAYER</span>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={betGameCards.player?.id || 'player-facedown'}
                      initial={{ opacity: 0, rotateY: 75, scale: 0.86 }}
                      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                      exit={{ opacity: 0, rotateY: -75, scale: 0.86 }}
                      transition={{ duration: 0.22 }}
                    >
                      <PlayingCard card={betGameCards.player || undefined} faceDown={!betGameCards.player} backLabel="PLAYER" />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: 'banker' as const, label: 'Banker 2x' },
                  { id: 'player' as const, label: 'Player 2x' },
                  { id: 'tie' as const, label: 'Tie 8x' },
                  { id: 'red' as const, label: 'Red 2x' },
                  { id: 'black' as const, label: 'Black 2x' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      playChipClink();
                      setBetChoice(opt.id);
                    }}
                    className={`rounded-xl py-2.5 text-xs font-bold border transition-colors cursor-pointer ${
                      betChoice === opt.id
                        ? 'bg-amber-400 text-emerald-950 border-white'
                        : 'bg-black/45 text-emerald-100 border-white/15 hover:border-amber-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleBetGameFlip}
                className="rounded-xl bg-emerald-400 px-6 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 cursor-pointer"
              >
                Deal & Flip (Bet ₱{session.betAmount})
              </button>
            </div>
          )}

          {/* 6. COLOR GAME (3 DICE SQUARE) ARENA */}
          {session.gameKey === 'colorgame' && (
            <div className="space-y-4 max-w-xl mx-auto w-full">
              {/* 3 Animated Color Dice */}
              <div className="flex items-center justify-center gap-4">
                {diceResults.map((colorId, idx) => {
                  const def = COLOR_GAME_SQUARES.find((c) => c.id === colorId) || COLOR_GAME_SQUARES[0];
                  return (
                    <div
                      key={idx}
                      className={`h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-4 shadow-2xl flex items-center justify-center font-display text-xs font-extrabold uppercase transition-transform duration-100 ${def.bgClass} ${def.borderClass} ${def.textClass} ${
                        rollingDice ? 'scale-110 rotate-12' : ''
                      }`}
                    >
                      {def.label}
                    </div>
                  );
                })}
              </div>

              {/* 6 Clickable Color Squares */}
              <div className="grid grid-cols-3 gap-2.5">
                {COLOR_GAME_SQUARES.map((sq) => {
                  const staked = colorBets[sq.id] || 0;
                  return (
                    <button
                      key={sq.id}
                      type="button"
                      onClick={() => handleStakeColor(sq.id)}
                      className={`relative rounded-2xl border-2 p-3.5 text-center shadow-lg transition-transform active:scale-95 cursor-pointer ${sq.bgClass} ${sq.borderClass} ${sq.textClass}`}
                    >
                      <span className="font-display text-sm font-extrabold block uppercase">{sq.label}</span>
                      <span className="font-mono-num text-xs font-bold block mt-0.5 opacity-90">
                        {staked > 0 ? `₱${staked}` : `+₱${session.betAmount}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setColorBets({})}
                  className="rounded-xl border border-white/25 bg-black/45 px-4 py-2.5 text-xs font-bold text-white hover:bg-black/65 cursor-pointer"
                >
                  Clear Chips
                </button>
                <button
                  type="button"
                  disabled={rollingDice}
                  onClick={handleRollColorDice}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                >
                  <Dices className="h-4 w-4" />
                  {rollingDice ? 'Rolling 3 Dice...' : 'Roll 3 Dice'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ==================== BOTTOM ZONE: QUICK EMOJI BAR + PLAYER HAND ==================== */}
        <div className="space-y-2.5 relative z-10 mt-2">
          {/* Quick Emoji & Player Profile Strip (Always visible on screen) */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-black/50 border border-white/15 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 font-display text-xs font-extrabold">
                {user.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">{user.full_name} (You)</span>
                  {mySeat?.isBanker && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                  {myFloatingEmoji && <span className="text-base">{myFloatingEmoji}</span>}
                </div>
                <span className="font-mono-num text-[11px] text-amber-300">
                  Table Wallet: ₱{tableWallet.toLocaleString('en-PH', { minimumFractionDigits: 2 })} · VIP {user.vip_level}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => handleQuickEmoji(em)}
                  aria-label={`Send ${em} emoji`}
                  className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-base transition-transform hover:scale-110 cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Pro Tong-its & Tsekitsa Action Deck + 3-Row All-Cards-Visible Hand (3+2 Up · 5 Center · 5 Below) */}
          {(session.gameKey === 'tongits' || session.gameKey === 'tsekitsa') && (() => {
            const rowUpLeft = hand.slice(0, 3);
            const rowCenter = hand.slice(3, 8);
            const rowBelow = hand.slice(8, 13);
            const rowUpRight = hand.slice(13, 15);

            const renderHandCard = (card: PlayingCardData, globalIndex: number) => {
              const isInValidMeld = validMeldCardIds.has(card.id);
              const isSelected = selectedIds.includes(card.id);
              const isDraggingThis = activeSwipe?.cardId === card.id;
              const isDropTarget = activeSwipe?.targetCardId === card.id;

              return (
                <motion.div
                  key={card.id}
                  data-hand-card-id={card.id}
                  layout={!isDraggingThis}
                  initial={{ opacity: 0, y: -32, scale: 0.84 }}
                  animate={
                    isDraggingThis
                      ? { opacity: 0.96, x: activeSwipe.dx, y: activeSwipe.dy, scale: 1.07 }
                      : { opacity: 1, x: 0, y: 0, scale: isDropTarget ? 1.06 : 1 }
                  }
                  exit={{ opacity: 0, y: -44, scale: 0.75 }}
                  transition={
                    isDraggingThis
                      ? { duration: 0 }
                      : { ...CARD_SPRING, delay: Math.min(globalIndex * 0.012, 0.12) }
                  }
                  onPointerDown={(e) => handleCardPointerDown(card.id, e)}
                  onPointerMove={handleCardPointerMove}
                  onPointerUp={handleCardPointerUp}
                  onPointerCancel={handleCardPointerUp}
                  className={`relative touch-none select-none cursor-grab active:cursor-grabbing ${
                    isDraggingThis ? 'z-40' : isDropTarget ? 'z-30' : 'z-10'
                  }`}
                >
                  {/* Top Card 1-Tap DOWN Meld Chip whenever this card forms a valid 3+ meld */}
                  {isInValidMeld && !isDraggingThis && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => handleQuickDownMeldFromCard(card.id, e)}
                      title="Tap to Down this Meld onto the table"
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 rounded-md bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight text-emerald-950 shadow-md ring-1 ring-white/80 hover:bg-emerald-300 active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      ↓ DOWN
                    </button>
                  )}
                  <div
                    className={
                      isDropTarget
                        ? 'rounded-xl ring-2 ring-amber-300 bg-amber-400/20 shadow-[0_0_18px_rgba(251,191,36,0.55)]'
                        : isDraggingThis
                          ? 'rounded-xl ring-2 ring-sky-300 shadow-[0_12px_28px_rgba(0,0,0,0.65)]'
                          : isInValidMeld && !isSelected
                            ? 'rounded-xl ring-1 ring-emerald-400/70 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                            : ''
                    }
                  >
                    <PlayingCard
                      card={card}
                      layoutId={isDraggingThis ? undefined : `card-${card.id}`}
                      compact
                      selected={isSelected}
                      onClick={() => handleHandCardTap(card.id)}
                    />
                  </div>
                </motion.div>
              );
            };

            return (
              <div className="space-y-2">
                {/* Special Hand Banner (ROYAL / QUADRO can Fight even after drawing) & 1-Tap Selected Meld Down Bar */}
                {(specialHand.canFightAfterDraw || selectedIsValidMeld) && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {specialHand.canFightAfterDraw && (
                      <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-amber-500/25 px-3 py-1 text-[11px] font-extrabold text-amber-200 shadow-md">
                        <Crown className="h-3.5 w-3.5 text-amber-300" />
                        <span>
                          SPECIAL {specialHand.labels.join(' + ')} ({specialHand.bonusMultiplier}x) — CAN FIGHT EVEN AFTER DRAW!
                        </span>
                      </div>
                    )}
                    {selectedIsValidMeld && (
                      <button
                        type="button"
                        onClick={handleDropMelds}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3.5 py-1 text-[11px] font-black text-emerald-950 shadow-lg ring-2 ring-white/70 hover:bg-emerald-300 cursor-pointer"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Tap to Down Selected Meld ({selectedCards.length} cards)
                      </button>
                    )}
                  </div>
                )}

                {/* Pro Game Controls Bar */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    type="button"
                    disabled={turnBusy || !!fightCountdown?.active}
                    onClick={handleDrawDeck}
                    className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-45 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Draw
                  </button>
                  <button
                    type="button"
                    disabled={turnBusy || !!fightCountdown?.active || !isTopDiscardVisibleToMe}
                    onClick={handleGetOpponentCard}
                    className="inline-flex items-center gap-1 rounded-xl bg-yellow-300 px-3 py-2 text-xs font-extrabold text-emerald-950 hover:bg-yellow-200 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    <Hand className="h-3.5 w-3.5" />
                    Get Card
                  </button>
                  <button
                    type="button"
                    onClick={handleSortHand}
                    className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap shadow"
                  >
                    <span>Sort</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGroupMelds}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 cursor-pointer whitespace-nowrap"
                  >
                    <FolderKanban className="h-3.5 w-3.5" />
                    Group
                  </button>
                  <button
                    type="button"
                    onClick={handleUngroupHand}
                    className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-teal-500 cursor-pointer whitespace-nowrap"
                  >
                    <span>Ungroup</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDropMelds}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-extrabold cursor-pointer whitespace-nowrap ${
                      selectedIsValidMeld
                        ? 'bg-emerald-300 text-emerald-950 ring-2 ring-white shadow-md'
                        : 'bg-teal-400 text-emerald-950 hover:bg-teal-300'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Down Melds
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMeldsPanel((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/60 bg-black/50 px-3 py-2 text-xs font-bold text-emerald-200 hover:border-amber-400 cursor-pointer whitespace-nowrap"
                  >
                    {showMeldsPanel ? <Eye className="h-3.5 w-3.5 text-amber-300" /> : <EyeOff className="h-3.5 w-3.5 text-emerald-400" />}
                    Show Melds ({tableMelds.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleDropToSwitch}
                    className="inline-flex items-center gap-1 rounded-xl bg-sky-400 px-3 py-2 text-xs font-extrabold text-slate-950 hover:bg-sky-300 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Switch Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSapawCard()}
                    className="inline-flex items-center gap-1 rounded-xl bg-purple-400 px-3 py-2 text-xs font-extrabold text-slate-950 hover:bg-purple-300 cursor-pointer whitespace-nowrap"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Sapaw
                  </button>
                  <button
                    type="button"
                    disabled={turnBusy || !!fightCountdown?.active}
                    onClick={handleDropCardLabog}
                    className="rounded-xl bg-red-500 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-red-400 disabled:opacity-45 cursor-pointer whitespace-nowrap"
                  >
                    Throw Card
                  </button>
                  <button
                    type="button"
                    disabled={!canCallFightNow}
                    onClick={handleTongitsFight}
                    title={
                      !canCallFightNow && hasDrawnThisTurn && !specialHand.canFightAfterDraw
                        ? 'Fight is available before drawing — unless you hold a SPECIAL ROYAL or QUADRO'
                        : 'Start 15-second Fight Countdown'
                    }
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-extrabold disabled:opacity-40 cursor-pointer whitespace-nowrap transition-all ${
                      specialHand.canFightAfterDraw
                        ? 'border-amber-200 bg-gradient-to-r from-amber-400 to-yellow-300 text-emerald-950 shadow-[0_0_16px_rgba(251,191,36,0.55)] hover:brightness-110'
                        : 'border-amber-300/80 bg-amber-950/70 text-amber-300 hover:bg-amber-900'
                    }`}
                  >
                    <Swords className="h-3.5 w-3.5" />
                    {specialHand.canFightAfterDraw
                      ? `${specialHand.labels.join('/')} Fight (15s)`
                      : 'Fight (15s)'}
                  </button>
                  <button
                    type="button"
                    disabled={turnBusy || !!fightCountdown?.active}
                    onClick={handleTongitsFold}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-400/60 bg-black/55 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-950/70 disabled:opacity-45 cursor-pointer whitespace-nowrap"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Fold
                  </button>
                </div>

                {/* 3-Row Full-Visibility Card Hand: Top (3 + 2 Up) · Center (5 Cards) · Below (5 Cards) */}
                <div className="rounded-2xl bg-black/35 border border-emerald-500/25 px-2 pt-3.5 pb-2.5 sm:px-4 space-y-2.5">
                  {/* Top Row: 3 Cards Left + 2 Extra Slots Right */}
                  <div className="flex items-center justify-center gap-3 sm:gap-5">
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <AnimatePresence mode="popLayout">
                        {rowUpLeft.map((card, i) => renderHandCard(card, i))}
                      </AnimatePresence>
                    </div>
                    <div className="h-12 w-px bg-emerald-400/25" aria-hidden="true" />
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <AnimatePresence mode="popLayout">
                        {rowUpRight.map((card, i) => renderHandCard(card, 13 + i))}
                      </AnimatePresence>
                      {Array.from({ length: Math.max(0, 2 - rowUpRight.length) }).map((_, slotIdx) => (
                        <div
                          key={`up-slot-${slotIdx}`}
                          className="w-[50px] h-[72px] sm:w-[58px] sm:h-[84px] rounded-xl border border-dashed border-emerald-400/30 bg-black/20 flex items-center justify-center text-[9px] font-semibold text-emerald-300/60 text-center px-1"
                        >
                          +Card
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Center Row: 5 Cards */}
                  <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                    <AnimatePresence mode="popLayout">
                      {rowCenter.map((card, i) => renderHandCard(card, 3 + i))}
                    </AnimatePresence>
                  </div>

                  {/* Below Row: 5 Cards */}
                  <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                    <AnimatePresence mode="popLayout">
                      {rowBelow.map((card, i) => renderHandCard(card, 8 + i))}
                    </AnimatePresence>
                  </div>

                  <p className="text-center text-[11px] text-emerald-200/85 pt-0.5">
                    Your Hand: <strong className="font-mono-num text-amber-300">{hand.length} cards</strong> · Swipe card to switch · Tap top <strong className="text-emerald-300">↓ DOWN</strong> on meld cards ·{' '}
                    {hasDrawnThisTurn
                      ? 'Select 1 card & tap center pile to Throw.'
                      : isTopDiscardVisibleToMe
                        ? 'Tap center face-up card to Get or Card Pile to Draw.'
                        : 'Tap center Card Pile to Get a card.'}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
        </LayoutGroup>

        {/* 15-Second Tong-its Fight Countdown Overlay */}
        {fightCountdown?.active && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-3xl border-2 border-amber-400 bg-[#052920] p-6 text-center shadow-[0_0_40px_rgba(251,191,36,0.35)] space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-emerald-950 shadow-lg">
                <Swords className="h-7 w-7" />
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                  {fightCountdown.initiatorName} Called Fight!
                </p>
                {fightCountdown.specialTag && (
                  <div className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-black text-amber-200">
                    <Crown className="h-3.5 w-3.5 text-amber-300" />
                    SPECIAL {fightCountdown.specialTag} DRAW FIGHT
                  </div>
                )}
              </div>

              {/* 15-Second Tabular Countdown */}
              <div className="space-y-2">
                <div
                  className={`font-mono-num text-5xl font-black tracking-tight ${
                    fightCountdown.secondsLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-amber-300'
                  }`}
                >
                  {fightCountdown.secondsLeft}s
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/60 border border-emerald-800">
                  <div
                    className={`h-full transition-all duration-700 ease-linear ${
                      fightCountdown.secondsLeft <= 5
                        ? 'bg-red-500'
                        : 'bg-gradient-to-r from-amber-400 to-emerald-400'
                    }`}
                    style={{
                      width: `${Math.max(0, Math.min(100, (fightCountdown.secondsLeft / FIGHT_COUNTDOWN_SECONDS) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-emerald-200">
                  Fight countdown ends in <strong className="font-mono-num text-white">{fightCountdown.secondsLeft} seconds</strong>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setFightCountdown(null);
                    handleTongitsFold();
                  }}
                  className="rounded-xl border border-red-400/70 bg-red-950/60 py-2.5 text-xs font-extrabold text-red-200 hover:bg-red-900/80 cursor-pointer"
                >
                  Fold (Tupi)
                </button>
                <button
                  type="button"
                  onClick={() => resolveTongitsFightShowdown(fightCountdown.specialTag)}
                  className="rounded-xl bg-amber-400 py-2.5 text-xs font-black text-emerald-950 hover:bg-amber-300 cursor-pointer"
                >
                  {fightCountdown.initiatedBy === 'opponent' ? 'Challenge (Laban)' : 'Showdown Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Round Settlement Modal Overlay */}
        {roundResult && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-3xl border border-amber-400/60 bg-[#052920] p-6 text-center shadow-2xl space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-emerald-950">
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-extrabold text-white">{roundResult.title}</h3>
              <p className="text-xs text-emerald-200 leading-relaxed">{roundResult.detail}</p>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onExitTable}
                  className="rounded-xl border border-emerald-700 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-900 cursor-pointer"
                >
                  Back to Lobby
                </button>
                <button
                  type="button"
                  onClick={dealFreshRound}
                  className="rounded-xl bg-amber-400 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer"
                >
                  Play Next Hand
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Real-Time In-Game Messenger Drawer */}
        {chatOpen && (
          <div className="absolute right-3 bottom-3 top-3 z-30 w-72 sm:w-80 rounded-2xl border border-emerald-700 bg-[#04241c]/95 shadow-2xl flex flex-col overflow-hidden backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 border-b border-emerald-800 px-3.5 py-2.5">
              <span className="font-display text-xs font-bold text-amber-300">Table Messenger (Live)</span>
              <div className="flex items-center gap-1.5">
                {incomingMessages.length > 0 && onClearChatMessages && (
                  <button
                    type="button"
                    onClick={onClearChatMessages}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-400/50 bg-red-950/60 px-2 py-1 text-[10px] font-bold text-red-200 hover:bg-red-900/70 cursor-pointer"
                    title="Delete all messages"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  aria-label="Close table messenger"
                  className="rounded-lg p-1 text-emerald-300 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {incomingMessages.length === 0 ? (
                <p className="text-emerald-400 text-center py-6">Say hi or send an emoji to players at this table!</p>
              ) : (
                incomingMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`group flex items-start justify-between gap-2 rounded-xl px-3 py-2 ${
                      m.senderId === user.id
                        ? 'bg-amber-400/20 text-amber-100 ml-6'
                        : 'bg-[#0a382c] text-emerald-50 mr-6'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-emerald-300 block">{m.senderName}</span>
                      <span className={m.isEmoji ? 'text-xl' : 'text-xs break-words'}>{m.text}</span>
                    </div>
                    {onDeleteChatMessage && (
                      <button
                        type="button"
                        onClick={() => onDeleteChatMessage(m.id)}
                        aria-label="Delete message"
                        title="Delete message"
                        className="shrink-0 rounded-md p-1 text-red-300/80 hover:bg-red-950/70 hover:text-red-200 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleChatSubmit} className="flex items-center gap-1.5 border-t border-emerald-800 p-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type message..."
                className="flex-1 rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Send table message"
                className="rounded-xl bg-amber-400 p-2 text-emerald-950 hover:bg-amber-300 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Table Milestones Drawer */}
        {milestonesOpen && (
          <div className="absolute left-3 bottom-3 top-3 z-30 w-72 sm:w-80 rounded-2xl border border-amber-400/50 bg-[#04241c]/95 shadow-2xl flex flex-col overflow-hidden backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-emerald-800 px-3.5 py-2.5">
              <span className="font-display text-xs font-bold text-amber-300 inline-flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" />
                Table Milestones ({handsPlayed} Hands)
              </span>
              <button
                type="button"
                onClick={() => setMilestonesOpen(false)}
                aria-label="Close milestones"
                className="rounded-lg p-1 text-emerald-300 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-emerald-800/80 p-3 space-y-1.5 bg-[#031c16]/70">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-200 font-semibold">Next 10-Hand Milestone</span>
                <span className="font-mono-num font-bold text-amber-300">{handsPlayed % 10} / 10 Hands</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#021410] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all"
                  style={{ width: `${Math.max(8, ((handsPlayed % 10) / 10) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-emerald-300 font-mono-num">
                Bet ₱{session.betAmount} · Min ₱{session.minWallet}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {milestones.length === 0 ? (
                <p className="text-emerald-400 text-center py-6">Play hands to record table milestones!</p>
              ) : (
                milestones.map((m, idx) => (
                  <div key={idx} className="rounded-xl border border-emerald-800/80 bg-[#031c16] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-amber-300">{m.label}</span>
                      <span className="font-mono-num text-[10px] text-emerald-400">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-emerald-200">{m.detail}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Live Switch Table Modal (Change Bet Tier or Variant Without Leaving Felt) */}
        {switchModalOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-amber-400/60 bg-[#052920] p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-extrabold text-white">Switch {session.gameName} Table</h3>
                  <p className="text-[11px] text-emerald-300">
                    Your main wallet: <strong className="font-mono-num text-amber-300">₱{user.wallet_balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSwitchModalOpen(false)}
                  aria-label="Close switch table"
                  className="rounded-lg p-1 text-emerald-300 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {(() => {
                const liveGameTables = tables.filter((t) => {
                  if (t.game_key !== session.gameKey) return false;
                  if (session.gameKey === 'tongits') {
                    return t.variant === switchVariant && t.max_players === switchMaxPlayers;
                  }
                  return true;
                });
                const activeSelectedTable = liveGameTables.find((t) => t.id === switchTableId);
                const selectedDisabled = activeSelectedTable ? !activeSelectedTable.is_enabled : false;

                return (
                  <>
                    {session.gameKey === 'tongits' && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <span className="text-xs font-bold text-emerald-200 block">Tong-its Mode</span>
                          <div className="grid grid-cols-3 gap-2">
                            {(['Regular', 'Butasan', 'Joker'] as TongitsVariant[]).map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => {
                                  setSwitchVariant(v);
                                  const match = tables.find(
                                    (t) =>
                                      t.game_key === 'tongits' &&
                                      t.variant === v &&
                                      t.max_players === switchMaxPlayers &&
                                      t.is_enabled
                                  );
                                  if (match) {
                                    setSwitchTableId(match.id);
                                    setSwitchBet(match.bet_amount);
                                  }
                                }}
                                className={`rounded-xl py-2 text-xs font-bold border transition-colors cursor-pointer ${
                                  switchVariant === v
                                    ? 'bg-amber-400 text-emerald-950 border-white'
                                    : 'bg-[#031c16] text-emerald-200 border-emerald-800 hover:border-amber-400'
                                }`}
                              >
                                {v === 'Joker' ? 'With Joker' : v}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-xs font-bold text-emerald-200 block">Table Size</span>
                          <div className="grid grid-cols-2 gap-2">
                            {([2, 3] as const).map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                  setSwitchMaxPlayers(sz);
                                  const match = tables.find(
                                    (t) =>
                                      t.game_key === 'tongits' &&
                                      t.variant === switchVariant &&
                                      t.max_players === sz &&
                                      t.is_enabled
                                  );
                                  if (match) {
                                    setSwitchTableId(match.id);
                                    setSwitchBet(match.bet_amount);
                                  }
                                }}
                                className={`rounded-xl py-2 text-xs font-extrabold border transition-colors cursor-pointer ${
                                  switchMaxPlayers === sz
                                    ? 'bg-emerald-400 text-emerald-950 border-white'
                                    : 'bg-[#031c16] text-emerald-200 border-emerald-800 hover:border-amber-400'
                                }`}
                              >
                                {sz}P Table ({sz} Players)
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-emerald-200 block">
                        Available Tables &amp; Betting Price
                      </span>
                      {liveGameTables.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-0.5">
                          {liveGameTables.map((tbl) => {
                            const disabled = !tbl.is_enabled;
                            const picked = switchTableId === tbl.id;
                            return (
                              <button
                                key={tbl.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  setSwitchTableId(tbl.id);
                                  setSwitchBet(tbl.bet_amount);
                                }}
                                className={`rounded-xl p-2.5 text-left border transition-colors ${
                                  disabled
                                    ? 'bg-black/40 text-emerald-500/50 border-emerald-900/60 opacity-55 cursor-not-allowed'
                                    : picked
                                      ? 'bg-amber-400 text-emerald-950 border-white cursor-pointer'
                                      : 'bg-[#031c16] text-emerald-100 border-emerald-800 hover:border-amber-400 cursor-pointer'
                                }`}
                              >
                                <span className="font-mono-num text-sm font-extrabold block">
                                  Bet ₱{tbl.bet_amount}
                                </span>
                                <span className="font-mono-num text-[10px] opacity-85 block">
                                  {disabled ? 'Disabled by Admin' : `Min ₱${tbl.min_wallet} · ${tbl.max_players}P`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {BET_TIERS.map((tier) => (
                            <button
                              key={tier.bet}
                              type="button"
                              onClick={() => setSwitchBet(tier.bet)}
                              className={`rounded-xl p-2.5 text-left border transition-colors cursor-pointer ${
                                switchBet === tier.bet
                                  ? 'bg-amber-400 text-emerald-950 border-white'
                                  : 'bg-[#031c16] text-emerald-100 border-emerald-800 hover:border-amber-400'
                              }`}
                            >
                              <span className="font-mono-num text-sm font-extrabold block">Bet ₱{tier.bet}</span>
                              <span className="font-mono-num text-[10px] opacity-85 block">
                                Min ₱{tier.minWallet}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {switchError && (
                      <div className="rounded-xl border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs font-semibold text-red-200">
                        {switchError}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setSwitchModalOpen(false)}
                        className="rounded-xl border border-emerald-700 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-900 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={switchBusy || selectedDisabled}
                        onClick={handleConfirmSwitchTable}
                        className="rounded-xl bg-amber-400 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                      >
                        {switchBusy
                          ? 'Switching...'
                          : session.gameKey === 'tongits'
                            ? `Move to ${switchVariant} ${switchMaxPlayers}P · ₱${switchBet}`
                            : `Move to Bet ₱${switchBet}`}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
