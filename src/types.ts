export type UserRole = 'admin' | 'agent' | 'player' | 'bot';

export type GameKey =
  | 'tongits'
  | 'pusoy'
  | 'lucky9'
  | 'poker'
  | 'betgame'
  | 'colorgame'
  | 'tsekitsa'
  | 'superace'
  | 'pinatachoy'
  | 'choyimpire'
  | 'choyrush'
  | 'choybounty';

export type SlotGameKey =
  | 'superace'
  | 'pinatachoy'
  | 'choyimpire'
  | 'choyrush'
  | 'choybounty';

export const SLOT_GAME_KEYS: SlotGameKey[] = [
  'superace',
  'pinatachoy',
  'choyimpire',
  'choyrush',
  'choybounty',
];

export const COMING_SOON_SLOT_KEYS: SlotGameKey[] = [
  'pinatachoy',
  'choyimpire',
  'choyrush',
  'choybounty',
];

export interface SlotGameThemeMeta {
  gameKey: SlotGameKey;
  title: string;
  tagline: string;
  inspiredFeature: string;
  featureSummary: string;
  cabinetGradient: string;
  freeSpinGradient: string;
  accentBorder: string;
  symbols: Record<
    SuperAceSymbol,
    { label: string; icon: string; textColor: string; subLabel?: string }
  >;
}

export const SUPER_ACE_BETS = [0.5, 1, 2, 3, 5, 8, 10, 20, 30, 40, 50] as const;

export type SuperAceSymbol =
  | 'ACE'
  | 'KING'
  | 'QUEEN'
  | 'JACK'
  | 'SPADE'
  | 'HEART'
  | 'CLUB'
  | 'DIAMOND'
  | 'WILD_SMALL'
  | 'WILD_BIG'
  | 'SCATTER';

export const SLOT_GAME_CATALOG: Record<SlotGameKey, SlotGameThemeMeta> = {
  superace: {
    gameKey: 'superace',
    title: 'Super Ace',
    tagline: '6×5 Cascading Card Slot',
    inspiredFeature: 'Golden Card → Wild Joker Feature',
    featureSummary:
      'Golden Cards on reels 2–5 flip into Small Wild Joker or cloning Big Wild Joker when broken, stepping cascade multipliers ×1–×5 (×2–×10 in 10 Free Spins).',
    cabinetGradient: 'from-[#07372a] via-[#04241b] to-[#031712]',
    freeSpinGradient: 'from-[#2b1d04] via-[#0c291e] to-[#031c16]',
    accentBorder: 'border-amber-500/45',
    symbols: {
      ACE: { label: 'A', icon: '♠', textColor: 'text-indigo-950', subLabel: 'ACE' },
      KING: { label: 'K', icon: '♥', textColor: 'text-red-600', subLabel: 'KING' },
      QUEEN: { label: 'Q', icon: '♦', textColor: 'text-blue-600', subLabel: 'QUEEN' },
      JACK: { label: 'J', icon: '♣', textColor: 'text-emerald-700', subLabel: 'JACK' },
      SPADE: { label: '♠', icon: '♠', textColor: 'text-indigo-950', subLabel: 'SPADE' },
      HEART: { label: '♥', icon: '♥', textColor: 'text-red-600', subLabel: 'HEART' },
      CLUB: { label: '♣', icon: '♣', textColor: 'text-emerald-700', subLabel: 'FLOWER' },
      DIAMOND: { label: '♦', icon: '♦', textColor: 'text-blue-600', subLabel: 'DIAMOND' },
      WILD_SMALL: { label: 'JOKER', icon: '★', textColor: 'text-purple-800', subLabel: 'WILD' },
      WILD_BIG: { label: 'BIG JOKER', icon: '♛', textColor: 'text-red-800', subLabel: 'CLONE WILD' },
      SCATTER: { label: 'SCATTER', icon: '★', textColor: 'text-amber-950', subLabel: '10 FREE' },
    },
  },
  pinatachoy: {
    gameKey: 'pinatachoy',
    title: 'Pinata Choy',
    tagline: '6×5 Fiesta Multiplier Burst Slot',
    inspiredFeature: 'Golden Piñata Multiplier Frames',
    featureSummary:
      'Break festive fiesta clusters to crack Golden Piñata frames into bursting Wilds with escalating ×1–×5 cascade multipliers (×2–×10 during 10 Free Spins).',
    cabinetGradient: 'from-[#3b1124] via-[#1c0b1f] to-[#0d1814]',
    freeSpinGradient: 'from-[#421c05] via-[#2b0f21] to-[#120b14]',
    accentBorder: 'border-pink-400/50',
    symbols: {
      ACE: { label: 'PIÑATA', icon: '🪅', textColor: 'text-fuchsia-900', subLabel: 'FIESTA' },
      KING: { label: 'CHILI', icon: '🌶', textColor: 'text-red-700', subLabel: 'HOT' },
      QUEEN: { label: 'TACO', icon: '🌮', textColor: 'text-amber-800', subLabel: 'GOLD' },
      JACK: { label: 'HAT', icon: '👒', textColor: 'text-emerald-900', subLabel: 'FEST' },
      SPADE: { label: 'LIME', icon: '🍋', textColor: 'text-emerald-800' },
      HEART: { label: 'CANDY', icon: '🍬', textColor: 'text-pink-700' },
      CLUB: { label: 'GUITAR', icon: '🎸', textColor: 'text-amber-900' },
      DIAMOND: { label: 'STAR', icon: '✦', textColor: 'text-purple-800' },
      WILD_SMALL: { label: 'CHOY WILD', icon: '🪅', textColor: 'text-amber-950', subLabel: 'WILD' },
      WILD_BIG: { label: 'MEGA PIÑATA', icon: '♛', textColor: 'text-red-950', subLabel: 'CLONE WILD' },
      SCATTER: { label: 'SCATTER', icon: '🎉', textColor: 'text-amber-950', subLabel: '10 FREE' },
    },
  },
  choyimpire: {
    gameKey: 'choyimpire',
    title: 'Choy Impire',
    tagline: '6×5 Golden Temple Cascading Slot',
    inspiredFeature: 'Golden Relic Frame Wild Conversion',
    featureSummary:
      'Ancient golden temple relics frame inner reels and convert into Wild Sun Idols on every break, climbing ×1–×5 multipliers (×2–×10 in 10 Free Spins).',
    cabinetGradient: 'from-[#2e2007] via-[#172116] to-[#081611]',
    freeSpinGradient: 'from-[#452c04] via-[#241b06] to-[#0c140d]',
    accentBorder: 'border-yellow-400/55',
    symbols: {
      ACE: { label: 'SUN IDOL', icon: '☀', textColor: 'text-amber-900', subLabel: 'IMPIRE' },
      KING: { label: 'MASK', icon: '🗿', textColor: 'text-yellow-900', subLabel: 'GOLD' },
      QUEEN: { label: 'CROWN', icon: '♛', textColor: 'text-amber-800', subLabel: 'ROYAL' },
      JACK: { label: 'JADE', icon: '❖', textColor: 'text-emerald-900', subLabel: 'RELIC' },
      SPADE: { label: 'A', icon: '♠', textColor: 'text-slate-900' },
      HEART: { label: 'K', icon: '♥', textColor: 'text-red-700' },
      CLUB: { label: 'Q', icon: '♣', textColor: 'text-emerald-900' },
      DIAMOND: { label: 'J', icon: '♦', textColor: 'text-amber-800' },
      WILD_SMALL: { label: 'SUN WILD', icon: '☀', textColor: 'text-amber-950', subLabel: 'WILD' },
      WILD_BIG: { label: 'IMPIRE WILD', icon: '♛', textColor: 'text-red-950', subLabel: 'CLONE WILD' },
      SCATTER: { label: 'TEMPLE', icon: '🏛', textColor: 'text-amber-950', subLabel: '10 FREE' },
    },
  },
  choyrush: {
    gameKey: 'choyrush',
    title: 'Choy Rush',
    tagline: '6×5 Sweet Cluster Multiplier Slot',
    inspiredFeature: 'Sweet Spot Cascading Multipliers',
    featureSummary:
      'Cluster candy pops leave glowing golden multiplier wrappers that turn into Sugar Wilds and accelerate cascade wins up to ×5 (×10 during 10 Free Spins).',
    cabinetGradient: 'from-[#351133] via-[#1b102d] to-[#0a1919]',
    freeSpinGradient: 'from-[#4a1238] via-[#2c0e36] to-[#121024]',
    accentBorder: 'border-rose-400/50',
    symbols: {
      ACE: { label: 'LOLLIPOP', icon: '🍭', textColor: 'text-pink-800', subLabel: 'RUSH' },
      KING: { label: 'HEART', icon: '💖', textColor: 'text-rose-700', subLabel: 'SWEET' },
      QUEEN: { label: 'STAR', icon: '⭐', textColor: 'text-amber-700', subLabel: 'SUGAR' },
      JACK: { label: 'DONUT', icon: '🍩', textColor: 'text-purple-900', subLabel: 'GLAZE' },
      SPADE: { label: 'BERRY', icon: '🫐', textColor: 'text-indigo-800' },
      HEART: { label: 'CHERRY', icon: '🍒', textColor: 'text-red-700' },
      CLUB: { label: 'MINT', icon: '🍬', textColor: 'text-emerald-800' },
      DIAMOND: { label: 'GEM', icon: '💎', textColor: 'text-sky-800' },
      WILD_SMALL: { label: 'SUGAR WILD', icon: '🍭', textColor: 'text-amber-950', subLabel: 'WILD' },
      WILD_BIG: { label: 'MEGA RUSH', icon: '♛', textColor: 'text-red-950', subLabel: 'CLONE WILD' },
      SCATTER: { label: 'SCATTER', icon: '🧁', textColor: 'text-amber-950', subLabel: '10 FREE' },
    },
  },
  choybounty: {
    gameKey: 'choybounty',
    title: 'Choy Bounty',
    tagline: '6×5 Wild Outlaw Showdown Slot',
    inspiredFeature: 'Gold-Framed Bounty Wild Showdown',
    featureSummary:
      'Outlaw gold-framed symbols flip into Wild Sheriff Badges on every break, firing consecutive bounty cascades from ×1–×5 (×2–×10 in 10 Free Spins).',
    cabinetGradient: 'from-[#331a08] via-[#1f140b] to-[#0b1812]',
    freeSpinGradient: 'from-[#472104] via-[#2c1506] to-[#140d07]',
    accentBorder: 'border-orange-400/55',
    symbols: {
      ACE: { label: 'BOUNTY', icon: '🤠', textColor: 'text-amber-950', subLabel: 'OUTLAW' },
      KING: { label: 'BADGE', icon: '★', textColor: 'text-yellow-900', subLabel: 'SHERIFF' },
      QUEEN: { label: 'GOLD BAR', icon: '💰', textColor: 'text-amber-800', subLabel: 'LOOT' },
      JACK: { label: 'BOOT', icon: '🥾', textColor: 'text-orange-950', subLabel: 'WEST' },
      SPADE: { label: 'A', icon: '♠', textColor: 'text-slate-900' },
      HEART: { label: 'K', icon: '♥', textColor: 'text-red-700' },
      CLUB: { label: 'Q', icon: '♣', textColor: 'text-emerald-950' },
      DIAMOND: { label: 'J', icon: '♦', textColor: 'text-red-700' },
      WILD_SMALL: { label: 'WANTED', icon: '★', textColor: 'text-amber-950', subLabel: 'WILD' },
      WILD_BIG: { label: 'BOSS WILD', icon: '♛', textColor: 'text-red-950', subLabel: 'CLONE WILD' },
      SCATTER: { label: 'SCATTER', icon: '💰', textColor: 'text-amber-950', subLabel: '10 FREE' },
    },
  },
};

export interface SuperAceCell {
  id: string;
  symbol: SuperAceSymbol;
  isGolden: boolean;
  isWild: boolean;
  isScatter: boolean;
  isNew?: boolean;
}

export interface SuperAceCascadeStep {
  stepIndex: number;
  multiplier: number;
  winningCells: Array<{ row: number; col: number }>;
  matchedSymbol: SuperAceSymbol;
  boxCount: number;
  basePayoutAt1Peso: number;
  stepWin: number;
  goldenTransformed: Array<{ row: number; col: number; wildType: 'WILD_SMALL' | 'WILD_BIG' }>;
  bigJokerClones: Array<{ row: number; col: number }>;
  gridAfterDrop: SuperAceCell[][];
}

export interface SuperAcePlayerState {
  totalRegularSpins: number;
  scattersTriggered: number;
  spinsSinceLastScatter: number;
  freeSpinsRemaining: number;
  freeSpinsTotal: number;
  freeSpinBet: number;
  freeSpinTotalWin: number;
}

export interface SuperAceSpinResult {
  initialGrid: SuperAceCell[][];
  cascades: SuperAceCascadeStep[];
  finalGrid: SuperAceCell[][];
  betAmount: number;
  wasFreeSpin: boolean;
  scatterCount: number;
  scatterPositions: Array<{ row: number; col: number }>;
  triggeredFreeSpins: number;
  totalWin: number;
  netDelta: number;
  cashbackEarned: number;
  highBetBoostActive: boolean;
  betWalletRatio: number;
  state: SuperAcePlayerState;
  profile: UserProfile;
}

export type TongitsVariant = 'Regular' | 'Butasan' | 'Joker';

export interface UserProfile {
  id: string;
  phone: string;
  full_name: string;
  role: UserRole;
  vip_level: number;
  wallet_balance: number;
  total_cash_in: number;
  total_bet: number;
  total_wins: number;
  total_losses: number;
  games_won: number;
  games_lost: number;
  pending_cashback: number;
  withdrawal_pin: string;
  referral_code: string;
  referred_by: string | null;
  daily_cashout_count: number;
  last_cashout_date: string | null;
  last_lat: number | null;
  last_lng: number | null;
  bot_win_rate: number;
  created_at: string;
}

export interface GameSetting {
  game_key: GameKey;
  game_name: string;
  short_label: string;
  is_enabled: boolean;
  turn_seconds: number;
  tournament_enabled: boolean;
  tournament_prize: number;
}

export interface SystemConfig {
  id: number;
  weekly_reward_enabled: boolean;
  weekly_top1_prize: number;
  weekly_top2_prize: number;
  weekly_top3_prize: number;
  ask_choy_knowledge: string;
  public_share_url?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  user_name?: string;
  user_phone?: string;
  type: 'cash_in' | 'cash_out' | 'cashback' | 'rake' | 'win' | 'loss' | 'bonus' | 'weekly_reward';
  payment_method: string | null;
  sender_details: string | null;
  receiver_details: string | null;
  reference_no: string | null;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  created_at: string;
}

export interface MilestoneEntry {
  timestamp: string;
  label: string;
  detail: string;
}

export interface GameTableSummary {
  id: string;
  game_key: GameKey;
  variant: TongitsVariant;
  max_players: number;
  bet_amount: number;
  min_wallet: number;
  rake_amount: number;
  is_enabled: boolean;
  status: 'waiting' | 'playing';
  banker_id: string | null;
  hands_played: number;
  total_pot_volume: number;
  active_players: number;
  milestone_log: MilestoneEntry[];
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface TableChatMessage {
  id: string;
  tableId: string;
  senderName: string;
  senderId: string;
  text: string;
  isEmoji?: boolean;
  timestamp: string;
}

export interface BetTier {
  bet: number;
  minWallet: number;
  rake: number;
  tierLabel: string;
}

export const BET_TIERS: BetTier[] = [
  { bet: 1, minWallet: 100, rake: 0.5, tierLabel: 'Starter' },
  { bet: 2, minWallet: 150, rake: 0.5, tierLabel: 'Classic' },
  { bet: 3, minWallet: 300, rake: 1.0, tierLabel: 'Pro' },
  { bet: 5, minWallet: 350, rake: 1.0, tierLabel: 'High Roller' },
  { bet: 10, minWallet: 500, rake: 1.0, tierLabel: 'VIP Master' },
];

export const VIP_RULES = {
  1: {
    name: 'VIP 1',
    minCashIn: 100,
    minBet: 500,
    cashbackRate: 0.005,
    cashbackLabel: '0.5%',
    dailyCashoutLimit: 1,
    maxCashoutAmount: 1000,
  },
  2: {
    name: 'VIP 2',
    minCashIn: 1000,
    minBet: 10000,
    cashbackRate: 0.01,
    cashbackLabel: '1.0%',
    dailyCashoutLimit: 3,
    maxCashoutAmount: 5000,
  },
} as const;

export type Suit = '♠' | '♥' | '♣' | '♦' | '★';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'JOKER';

export interface PlayingCardData {
  id: string;
  rank: Rank;
  suit: Suit;
  value: number;
  isRed: boolean;
  isJoker?: boolean;
  meldGroup?: number;
}

export interface SeatedPlayer {
  id: string;
  name: string;
  vipLevel: number;
  role: UserRole;
  tableWallet: number;
  cardCount: number;
  isBanker: boolean;
  botWinRate: number;
  lastEmoji?: string;
}

export interface ActiveTableSession {
  tableId: string;
  gameKey: GameKey;
  gameName: string;
  variant: TongitsVariant;
  maxPlayers: number;
  betAmount: number;
  minWallet: number;
  rakeAmount: number;
  bringInWallet: number;
  turnSeconds: number;
  seats: SeatedPlayer[];
  milestones: MilestoneEntry[];
  handsPlayed: number;
}

export interface GameAnalyticsRow {
  game_key: GameKey;
  game_name: string;
  hands_played: number;
  pot_volume: number;
  rake_earned: number;
}

export interface AdminOverviewData {
  kpis: {
    totalCashIn: number;
    totalCashOut: number;
    totalRake: number;
    netRevenue: number;
    pendingCount: number;
    totalPlayers: number;
    activeBots: number;
  };
  players: UserProfile[];
  transactions: Transaction[];
  games: GameSetting[];
  systemConfig: SystemConfig;
  tables: GameTableSummary[];
  analytics: GameAnalyticsRow[];
}

export interface TournamentEntry {
  id: string;
  game_key: GameKey;
  user_id: string;
  user_name: string;
  vip_level: number;
  score: number;
  joined_at: string;
}

export interface TournamentSummary {
  game_key: GameKey;
  game_name: string;
  short_label: string;
  tournament_enabled: boolean;
  tournament_prize: number;
  entry_fee: number;
  entrants: TournamentEntry[];
  is_joined: boolean;
}

export interface AgentReferralMember {
  id: string;
  full_name: string;
  phone: string;
  vip_level: number;
  total_cash_in: number;
  total_bet: number;
  created_at: string;
}

export interface AgentOverviewData {
  referralCode: string;
  referredCount: number;
  totalReferralVolume: number;
  estimatedCommission: number;
  members: AgentReferralMember[];
}
