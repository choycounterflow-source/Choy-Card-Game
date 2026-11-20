import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AgentOverviewData,
  GameKey,
  GameSetting,
  GameTableSummary,
  MilestoneEntry,
  NotificationItem,
  SystemConfig,
  TournamentEntry,
  TournamentSummary,
  Transaction,
  UserProfile,
} from '../src/types.ts';

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(process.cwd(), 'choyjiez.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      vip_level INTEGER NOT NULL DEFAULT 1,
      wallet_balance REAL NOT NULL DEFAULT 0,
      total_cash_in REAL NOT NULL DEFAULT 0,
      total_bet REAL NOT NULL DEFAULT 0,
      total_wins REAL NOT NULL DEFAULT 0,
      total_losses REAL NOT NULL DEFAULT 0,
      games_won INTEGER NOT NULL DEFAULT 0,
      games_lost INTEGER NOT NULL DEFAULT 0,
      pending_cashback REAL NOT NULL DEFAULT 0,
      withdrawal_pin TEXT NOT NULL DEFAULT '1234',
      referral_code TEXT UNIQUE NOT NULL,
      referred_by TEXT,
      daily_cashout_count INTEGER NOT NULL DEFAULT 0,
      last_cashout_date TEXT,
      last_lat REAL,
      last_lng REAL,
      daily_streak INTEGER NOT NULL DEFAULT 0,
      last_checkin_date TEXT,
      checkin_claimed_days TEXT NOT NULL DEFAULT '[]',
      bot_win_rate INTEGER NOT NULL DEFAULT 80,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_settings (
      game_key TEXT PRIMARY KEY,
      game_name TEXT NOT NULL,
      short_label TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      turn_seconds INTEGER NOT NULL DEFAULT 45,
      tournament_enabled INTEGER NOT NULL DEFAULT 0,
      tournament_prize REAL NOT NULL DEFAULT 5000
    );

    CREATE TABLE IF NOT EXISTS system_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      weekly_reward_enabled INTEGER NOT NULL DEFAULT 1,
      weekly_top1_prize REAL NOT NULL DEFAULT 3000,
      weekly_top2_prize REAL NOT NULL DEFAULT 1500,
      weekly_top3_prize REAL NOT NULL DEFAULT 500,
      ask_choy_knowledge TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id),
      type TEXT NOT NULL,
      payment_method TEXT,
      sender_details TEXT,
      receiver_details TEXT,
      reference_no TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_tables (
      id TEXT PRIMARY KEY,
      game_key TEXT NOT NULL REFERENCES game_settings(game_key),
      variant TEXT NOT NULL DEFAULT 'Regular',
      max_players INTEGER NOT NULL DEFAULT 3,
      bet_amount REAL NOT NULL,
      min_wallet REAL NOT NULL,
      rake_amount REAL NOT NULL DEFAULT 0.5,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'waiting',
      banker_id TEXT REFERENCES profiles(id),
      hands_played INTEGER NOT NULL DEFAULT 0,
      total_pot_volume REAL NOT NULL DEFAULT 0,
      milestone_log TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tournament_entries (
      id TEXT PRIMARY KEY,
      game_key TEXT NOT NULL REFERENCES game_settings(game_key),
      user_id TEXT NOT NULL REFERENCES profiles(id),
      score INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game_key, user_id)
    );

    CREATE TABLE IF NOT EXISTS slot_player_state (
      user_id TEXT PRIMARY KEY REFERENCES profiles(id),
      total_regular_spins INTEGER NOT NULL DEFAULT 0,
      scatters_triggered INTEGER NOT NULL DEFAULT 0,
      spins_since_last_scatter INTEGER NOT NULL DEFAULT 0,
      free_spins_remaining INTEGER NOT NULL DEFAULT 0,
      free_spin_bet REAL NOT NULL DEFAULT 1,
      free_spin_total_win REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS slot_game_states (
      user_id TEXT NOT NULL REFERENCES profiles(id),
      game_key TEXT NOT NULL,
      total_regular_spins INTEGER NOT NULL DEFAULT 0,
      scatters_triggered INTEGER NOT NULL DEFAULT 0,
      spins_since_last_scatter INTEGER NOT NULL DEFAULT 0,
      free_spins_remaining INTEGER NOT NULL DEFAULT 0,
      free_spins_total INTEGER NOT NULL DEFAULT 0,
      free_spin_bet REAL NOT NULL DEFAULT 1,
      free_spin_total_win REAL NOT NULL DEFAULT 0,
      buy_bonus_target_win REAL NOT NULL DEFAULT 0,
      buy_bonus_rate_pct INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, game_key)
    );
    CREATE TABLE IF NOT EXISTS slot_welcome_scatter_ips (
      ip_address TEXT PRIMARY KEY,
      first_user_id TEXT NOT NULL REFERENCES profiles(id),
      claimed_game_key TEXT NOT NULL DEFAULT '',
      first_scatter_used INTEGER NOT NULL DEFAULT 0,
      second_scatter_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_migrations (
      key TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS studio_pending_commits (
      file_path TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe migration for existing databases missing free_spins_total or buy bonus columns
  const slotCols = db.prepare(`PRAGMA table_info(slot_game_states)`).all() as Array<{ name: string }>;
  if (!slotCols.some((col) => col.name === 'free_spins_total')) {
    db.exec(`ALTER TABLE slot_game_states ADD COLUMN free_spins_total INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!slotCols.some((col) => col.name === 'buy_bonus_target_win')) {
    db.exec(`ALTER TABLE slot_game_states ADD COLUMN buy_bonus_target_win REAL NOT NULL DEFAULT 0;`);
  }
  if (!slotCols.some((col) => col.name === 'buy_bonus_rate_pct')) {
    db.exec(`ALTER TABLE slot_game_states ADD COLUMN buy_bonus_rate_pct INTEGER NOT NULL DEFAULT 0;`);
  }

  // Safe migration for IP-based welcome scatter tracking on profiles
  const profileCols = db.prepare(`PRAGMA table_info(profiles)`).all() as Array<{ name: string }>;
  if (!profileCols.some((col) => col.name === 'registered_ip')) {
    db.exec(`ALTER TABLE profiles ADD COLUMN registered_ip TEXT NOT NULL DEFAULT '';`);
  }
  if (!profileCols.some((col) => col.name === 'welcome_scatter_eligible')) {
    db.exec(`ALTER TABLE profiles ADD COLUMN welcome_scatter_eligible INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!profileCols.some((col) => col.name === 'daily_streak')) {
    db.exec(`ALTER TABLE profiles ADD COLUMN daily_streak INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!profileCols.some((col) => col.name === 'last_checkin_date')) {
    db.exec(`ALTER TABLE profiles ADD COLUMN last_checkin_date TEXT;`);
  }
  if (!profileCols.some((col) => col.name === 'checkin_claimed_days')) {
    db.exec(`ALTER TABLE profiles ADD COLUMN checkin_claimed_days TEXT NOT NULL DEFAULT '[]';`);
  }

  // Safe migration for per-table enable/disable on game_tables
  const tableCols = db.prepare(`PRAGMA table_info(game_tables)`).all() as Array<{ name: string }>;
  if (!tableCols.some((col) => col.name === 'is_enabled')) {
    db.exec(`ALTER TABLE game_tables ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1;`);
  }

  // Safe migration for Admin custom public share URL & Secret Studio PIN/Builder URL on system_config
  const sysCols = db.prepare(`PRAGMA table_info(system_config)`).all() as Array<{ name: string }>;
  if (!sysCols.some((col) => col.name === 'public_share_url')) {
    db.exec(`ALTER TABLE system_config ADD COLUMN public_share_url TEXT NOT NULL DEFAULT '';`);
  }
  if (!sysCols.some((col) => col.name === 'admin_secret_pin')) {
    db.exec(`ALTER TABLE system_config ADD COLUMN admin_secret_pin TEXT NOT NULL DEFAULT '2026';`);
  }
  if (!sysCols.some((col) => col.name === 'admin_builder_url')) {
    db.exec(`ALTER TABLE system_config ADD COLUMN admin_builder_url TEXT NOT NULL DEFAULT '';`);
  }
  if (!sysCols.some((col) => col.name === 'admin_github_repo_url')) {
    db.exec(`ALTER TABLE system_config ADD COLUMN admin_github_repo_url TEXT NOT NULL DEFAULT '';`);
  }
  if (!sysCols.some((col) => col.name === 'admin_github_branch')) {
    db.exec(`ALTER TABLE system_config ADD COLUMN admin_github_branch TEXT NOT NULL DEFAULT 'main';`);
  }
  if (!sysCols.some((col) => col.name === 'admin_render_url')) {
    db.exec(`ALTER TABLE system_config ADD COLUMN admin_render_url TEXT NOT NULL DEFAULT '';`);
  }

  seedInitialData();
  ensureSlotGamesRegistered();
  ensureTongitsTablesMatrix();
  purgeDemoRecords();
  applyOneTimeMigrations();
}

function ensureTongitsTablesMatrix(): void {
  const variants: Array<'Regular' | 'Butasan' | 'Joker'> = ['Regular', 'Butasan', 'Joker'];
  const playerCounts = [2, 3];
  const tiers = [
    { bet: 1, minWallet: 100, rake: 0.5 },
    { bet: 2, minWallet: 150, rake: 0.5 },
    { bet: 3, minWallet: 300, rake: 1.0 },
    { bet: 5, minWallet: 350, rake: 1.0 },
    { bet: 10, minWallet: 500, rake: 1.0 },
  ];

  // Clean up old generic tbl-tongits-b* rows so Tong-its uses the explicit variant + 2P/3P matrix
  db.prepare(`DELETE FROM game_tables WHERE game_key = 'tongits' AND id LIKE 'tbl-tongits-b%'`).run();

  const insertTbl = db.prepare(`
    INSERT OR IGNORE INTO game_tables (
      id, game_key, variant, max_players, bet_amount, min_wallet, rake_amount, is_enabled,
      status, banker_id, hands_played, total_pot_volume, milestone_log
    )
    VALUES (?, 'tongits', ?, ?, ?, ?, ?, 1, 'waiting', 'bot-mastercard-001', 0, 0, ?)
  `);

  for (const variant of variants) {
    for (const maxPlayers of playerCounts) {
      for (const tier of tiers) {
        const id = `tbl-tongits-${variant.toLowerCase()}-${maxPlayers}p-b${tier.bet}`;
        const initialMilestones: MilestoneEntry[] = [
          {
            timestamp: new Date().toISOString(),
            label: `Tong-its ${variant} ${maxPlayers}P Opened`,
            detail: `Bet ₱${tier.bet} · Min Buy-in ₱${tier.minWallet}`,
          },
        ];
        insertTbl.run(
          id,
          variant,
          maxPlayers,
          tier.bet,
          tier.minWallet,
          tier.rake,
          JSON.stringify(initialMilestones)
        );
      }
    }
  }
}

function applyOneTimeMigrations(): void {
  const clearedBots = db
    .prepare('SELECT key FROM app_migrations WHERE key = ?')
    .get('clear_seeded_bot_coins_v1');
  if (!clearedBots) {
    // Clear pre-seeded coins on built-in bot players once; Admin manages all coins thereafter
    db.prepare(`UPDATE profiles SET wallet_balance = 0 WHERE role = 'bot'`).run();
    db.prepare('INSERT INTO app_migrations (key) VALUES (?)').run('clear_seeded_bot_coins_v1');
  }

  const zeroBuiltIn = db
    .prepare('SELECT key FROM app_migrations WHERE key = ?')
    .get('zero_builtin_coins_v2');
  if (!zeroBuiltIn) {
    // Remove all pre-seeded built-in coins from built-in accounts; Admin can add coins anytime
    db.prepare(
      `UPDATE profiles SET wallet_balance = 0 WHERE id IN ('admin-choy-001', 'bot-mastercard-001', 'bot-queen-002') OR role = 'bot'`
    ).run();
    db.prepare('INSERT INTO app_migrations (key) VALUES (?)').run('zero_builtin_coins_v2');
  }

  const removedFreeSpin = db
    .prepare('SELECT key FROM app_migrations WHERE key = ?')
    .get('remove_free_spin_mode_v1');
  if (!removedFreeSpin) {
    // Clear any lingering Free Spin Mode counters so all slot spins run in real paid mode
    db.prepare(
      `UPDATE slot_game_states SET free_spins_remaining = 0, free_spins_total = 0, free_spin_total_win = 0`
    ).run();
    db.prepare(
      `UPDATE slot_player_state SET free_spins_remaining = 0, free_spin_total_win = 0`
    ).run();
    db.prepare('INSERT INTO app_migrations (key) VALUES (?)').run('remove_free_spin_mode_v1');
  }
}

function ensureSlotGamesRegistered(): void {
  const slotDefs: Array<{
    key: GameKey;
    name: string;
    short: string;
    enabled: number;
    tourneyEnabled: number;
    prize: number;
    milestoneTitle: string;
  }> = [
    {
      key: 'superace',
      name: 'Super Ace (6×5 Slot Machine)',
      short: 'Super Ace',
      enabled: 1,
      tourneyEnabled: 1,
      prize: 15000,
      milestoneTitle: 'Super Ace 6×5 Opened',
    },
    {
      key: 'pinatachoy',
      name: 'Pinata Choy (6×5 Slot · Coming Soon)',
      short: 'Pinata Choy',
      enabled: 0,
      tourneyEnabled: 0,
      prize: 15000,
      milestoneTitle: 'Pinata Choy 6×5 Staged (Coming Soon)',
    },
    {
      key: 'choyimpire',
      name: 'Choy Impire (6×5 Slot · Coming Soon)',
      short: 'Choy Impire',
      enabled: 0,
      tourneyEnabled: 0,
      prize: 15000,
      milestoneTitle: 'Choy Impire 6×5 Staged (Coming Soon)',
    },
    {
      key: 'choyrush',
      name: 'Choy Rush (6×5 Slot · Coming Soon)',
      short: 'Choy Rush',
      enabled: 0,
      tourneyEnabled: 0,
      prize: 15000,
      milestoneTitle: 'Choy Rush 6×5 Staged (Coming Soon)',
    },
    {
      key: 'choybounty',
      name: 'Choy Bounty (6×5 Slot · Coming Soon)',
      short: 'Choy Bounty',
      enabled: 0,
      tourneyEnabled: 0,
      prize: 15000,
      milestoneTitle: 'Choy Bounty 6×5 Staged (Coming Soon)',
    },
  ];

  const insertGame = db.prepare(`
    INSERT OR IGNORE INTO game_settings (game_key, game_name, short_label, is_enabled, turn_seconds, tournament_enabled, tournament_prize)
    VALUES (?, ?, ?, ?, 30, ?, ?)
  `);

  const insertTbl = db.prepare(`
    INSERT INTO game_tables (id, game_key, variant, max_players, bet_amount, min_wallet, rake_amount, status, banker_id, hands_played, total_pot_volume, milestone_log)
    VALUES (?, ?, 'Regular', 1, 1, 0.5, 0, 'waiting', 'admin-choy-001', 0, 0, ?)
  `);

  for (const s of slotDefs) {
    insertGame.run(s.key, s.name, s.short, s.enabled, s.tourneyEnabled, s.prize);
    const tblId = `tbl-${s.key}-slot`;
    const exists = db.prepare('SELECT id FROM game_tables WHERE id = ?').get(tblId);
    if (!exists) {
      const initialMilestones: MilestoneEntry[] = [
        {
          timestamp: new Date().toISOString(),
          label: s.milestoneTitle,
          detail: '6×5 Cascading Slot · Bets ₱0.5–₱50 · Free Spins & Wilds',
        },
      ];
      insertTbl.run(tblId, s.key, JSON.stringify(initialMilestones));
    }
  }

  // Migrate any legacy superace state rows into slot_game_states cleanly
  db.prepare(`
    INSERT OR IGNORE INTO slot_game_states (
      user_id, game_key, total_regular_spins, scatters_triggered, spins_since_last_scatter,
      free_spins_remaining, free_spin_bet, free_spin_total_win, updated_at
    )
    SELECT user_id, 'superace', total_regular_spins, scatters_triggered, spins_since_last_scatter,
           free_spins_remaining, free_spin_bet, free_spin_total_win, updated_at
    FROM slot_player_state
  `).run();
}

function purgeDemoRecords(): void {
  const demoUserIds = ['player-demo-001', 'player-vip2-002', 'player-vip1-003', 'agent-davao-001'];
  const placeholders = demoUserIds.map(() => '?').join(', ');
  const delTe = db.prepare(`DELETE FROM tournament_entries WHERE user_id IN (${placeholders}) OR id IN ('te-1','te-2','te-3','te-4','te-5','te-6','te-7','te-8')`).run(...demoUserIds);
  const delNotif = db.prepare(`DELETE FROM notifications WHERE user_id IN (${placeholders}) OR id = 'notif-welcome-1'`).run(...demoUserIds);
  const delTx = db.prepare(`DELETE FROM transactions WHERE user_id IN (${placeholders}) OR id LIKE 'tx-seed-%'`).run(...demoUserIds);
  const delProfiles = db.prepare(`DELETE FROM profiles WHERE id IN (${placeholders})`).run(...demoUserIds);

  const txCount = (db.prepare('SELECT COUNT(*) as c FROM transactions').get() as { c: number }).c;
  const purgedAny = delTe.changes + delNotif.changes + delTx.changes + delProfiles.changes > 0;
  if (purgedAny || txCount === 0) {
    db.prepare(`
      UPDATE game_tables
      SET hands_played = 0, total_pot_volume = 0
      WHERE hands_played > 0 OR total_pot_volume > 0
    `).run();
    db.prepare(`
      UPDATE profiles
      SET total_cash_in = 0, total_bet = 0, total_wins = 0, total_losses = 0,
          games_won = 0, games_lost = 0, pending_cashback = 0
      WHERE id IN ('admin-choy-001', 'bot-mastercard-001', 'bot-queen-002')
    `).run();
  }
}

function seedInitialData(): void {
  const existingAdmin = db.prepare('SELECT id FROM profiles WHERE phone = ?').get('09361223978');
  if (!existingAdmin) {
    const insertProfile = db.prepare(`
      INSERT INTO profiles (
        id, phone, password_hash, full_name, role, vip_level, wallet_balance,
        total_cash_in, total_bet, total_wins, total_losses, games_won, games_lost,
        pending_cashback, withdrawal_pin, referral_code, last_lat, last_lng, bot_win_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Default Super Admin (09361223978 / 051690) — starts with ₱0; Admin can add coins to any account
    insertProfile.run(
      'admin-choy-001',
      '09361223978',
      '051690',
      'Super Admin Choy',
      'admin',
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      '0516',
      'ADMIN2026',
      14.5995,
      120.9842,
      80
    );

    // 2 Built-in 80% Win-Rate Players (start with ₱0 — Admin manages all coins)
    insertProfile.run(
      'bot-mastercard-001',
      '09170000001',
      'bot123',
      'MasterCard_PH',
      'bot',
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      '1234',
      'BOT001',
      10.3157,
      123.8854,
      80
    );

    insertProfile.run(
      'bot-queen-002',
      '09170000002',
      'bot123',
      'QueenOfSpades',
      'bot',
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      '1234',
      'BOT002',
      7.1907,
      125.4553,
      80
    );
  }

  const gameCount = (db.prepare('SELECT COUNT(*) as c FROM game_settings').get() as { c: number }).c;
  if (gameCount === 0) {
    const insertGame = db.prepare(`
      INSERT INTO game_settings (game_key, game_name, short_label, is_enabled, turn_seconds, tournament_enabled, tournament_prize)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertGame.run('tongits', 'Tong-its (2P/3P Regular · Butasan · Joker)', 'Tong-its', 1, 45, 1, 10000);
    insertGame.run('pusoy', 'Pusoy (Auto-Meld & Balis-balis)', 'Pusoy', 1, 45, 1, 8000);
    insertGame.run('lucky9', 'Lucky 9 (Highest Wallet Banker)', 'Lucky 9', 1, 900, 1, 5000);
    insertGame.run('poker', 'Texas Poker', 'Poker', 1, 900, 1, 12000);
    insertGame.run('betgame', 'Bet Game', 'Bet Game', 1, 900, 0, 5000);
    insertGame.run('colorgame', 'Color Game (3 Dice Square)', 'Color Game', 1, 30, 1, 5000);
    insertGame.run('tsekitsa', 'Tsekitsa', 'Tsekitsa', 1, 45, 0, 5000);
  }

  const sysConfig = db.prepare('SELECT id, ask_choy_knowledge FROM system_config WHERE id = 1').get() as
    | { id: number; ask_choy_knowledge: string }
    | undefined;
  const cleanAskChoyWelcome =
    'Welcome sa Choy Card Game! Minimum Cash-in is ₱100 para VIP 1 (Cash out 1x per day Max ₱1,000). VIP 2 unlocks priority VIP rewards and 3x cash out per day Max ₱5,000. Minimum table buy-in: Bet ₱1 = ₱100, Bet ₱2 = ₱150, Bet ₱3 = ₱300, Bet ₱5 = ₱350, Bet ₱10 = ₱500. Strictly NO players within 2km GPS radius at the same table. Cash-in accepts GCash direct launch, Maya, and Intuit Payment Terminal (pending admin approval). Contact support: 09361223978.';

  if (!sysConfig) {
    db.prepare(`
      INSERT INTO system_config (id, weekly_reward_enabled, weekly_top1_prize, weekly_top2_prize, weekly_top3_prize, ask_choy_knowledge)
      VALUES (1, 1, 3000, 1500, 500, ?)
    `).run(cleanAskChoyWelcome);
  } else if (
    sysConfig.ask_choy_knowledge.includes('ChoyJiez Card Hub') ||
    sysConfig.ask_choy_knowledge.includes('0.5% cashback') ||
    sysConfig.ask_choy_knowledge.includes('Auto-rake')
  ) {
    db.prepare('UPDATE system_config SET ask_choy_knowledge = ? WHERE id = 1').run(
      cleanAskChoyWelcome
    );
  }

  const tableCount = (db.prepare('SELECT COUNT(*) as c FROM game_tables').get() as { c: number }).c;
  if (tableCount === 0) {
    const games: GameKey[] = ['tongits', 'pusoy', 'lucky9', 'poker', 'betgame', 'colorgame', 'tsekitsa'];
    const tiers = [
      { bet: 1, minWallet: 100, rake: 0.5 },
      { bet: 2, minWallet: 150, rake: 0.5 },
      { bet: 3, minWallet: 300, rake: 1.0 },
      { bet: 5, minWallet: 350, rake: 1.0 },
      { bet: 10, minWallet: 500, rake: 1.0 },
    ];
    const insertTable = db.prepare(`
      INSERT INTO game_tables (id, game_key, variant, max_players, bet_amount, min_wallet, rake_amount, status, banker_id, hands_played, total_pot_volume, milestone_log)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const g of games) {
      for (const tier of tiers) {
        const id = `tbl-${g}-b${tier.bet}`;
        const initialMilestones: MilestoneEntry[] = [
          {
            timestamp: new Date().toISOString(),
            label: 'Table Opened',
            detail: `Bet ₱${tier.bet} · Min Buy-in ₱${tier.minWallet}`,
          },
        ];
        insertTable.run(
          id,
          g,
          'Regular',
          3,
          tier.bet,
          tier.minWallet,
          tier.rake,
          'waiting',
          'bot-mastercard-001',
          0,
          0,
          JSON.stringify(initialMilestones)
        );
      }
    }
  }
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

export function sanitizeProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    phone: String(row.phone),
    full_name: String(row.full_name),
    role: row.role as UserProfile['role'],
    vip_level: Number(row.vip_level),
    wallet_balance: Number(row.wallet_balance),
    total_cash_in: Number(row.total_cash_in),
    total_bet: Number(row.total_bet),
    total_wins: Number(row.total_wins),
    total_losses: Number(row.total_losses),
    games_won: Number(row.games_won),
    games_lost: Number(row.games_lost),
    pending_cashback: Number(row.pending_cashback),
    withdrawal_pin: String(row.withdrawal_pin),
    referral_code: String(row.referral_code),
    referred_by: row.referred_by ? String(row.referred_by) : null,
    daily_cashout_count: Number(row.daily_cashout_count),
    last_cashout_date: row.last_cashout_date ? String(row.last_cashout_date) : null,
    last_lat: row.last_lat !== null && row.last_lat !== undefined ? Number(row.last_lat) : null,
    last_lng: row.last_lng !== null && row.last_lng !== undefined ? Number(row.last_lng) : null,
    daily_streak: Number(row.daily_streak ?? 0),
    last_checkin_date: row.last_checkin_date ? String(row.last_checkin_date) : null,
    checkin_claimed_days: row.checkin_claimed_days ? String(row.checkin_claimed_days) : '[]',
    bot_win_rate: Number(row.bot_win_rate ?? 80),
    created_at: String(row.created_at),
  };
}

export function getProfileById(id: string): UserProfile | null {
  const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? sanitizeProfile(row) : null;
}

export function getProfileByPhone(phone: string): (UserProfile & { password_hash: string }) | null {
  const row = db.prepare('SELECT * FROM profiles WHERE phone = ?').get(phone) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...sanitizeProfile(row),
    password_hash: String(row.password_hash),
  };
}

export function getAllProfiles(): UserProfile[] {
  const rows = db.prepare('SELECT * FROM profiles ORDER BY total_wins DESC, wallet_balance DESC').all() as Record<string, unknown>[];
  return rows.map(sanitizeProfile);
}

export function getGameSettings(): GameSetting[] {
  const rows = db.prepare('SELECT * FROM game_settings ORDER BY rowid ASC').all() as Record<string, unknown>[];
  return rows.map((r) => ({
    game_key: r.game_key as GameKey,
    game_name: String(r.game_name),
    short_label: String(r.short_label),
    is_enabled: Boolean(r.is_enabled),
    turn_seconds: Number(r.turn_seconds),
    tournament_enabled: Boolean(r.tournament_enabled),
    tournament_prize: Number(r.tournament_prize),
  }));
}

export function getSystemConfig(): SystemConfig {
  const row = db.prepare('SELECT * FROM system_config WHERE id = 1').get() as Record<string, unknown>;
  return {
    id: 1,
    weekly_reward_enabled: Boolean(row.weekly_reward_enabled),
    weekly_top1_prize: Number(row.weekly_top1_prize),
    weekly_top2_prize: Number(row.weekly_top2_prize),
    weekly_top3_prize: Number(row.weekly_top3_prize),
    ask_choy_knowledge: String(row.ask_choy_knowledge),
    public_share_url: String(row.public_share_url || ''),
  };
}

export interface AdminSecretSettings {
  secretPin: string;
  builderUrl: string;
  githubRepoUrl: string;
  githubBranch: string;
  renderUrl: string;
}

export function getAdminSecretSettings(): AdminSecretSettings {
  const row = db
    .prepare(
      'SELECT admin_secret_pin, admin_builder_url, admin_github_repo_url, admin_github_branch, admin_render_url FROM system_config WHERE id = 1'
    )
    .get() as
    | {
        admin_secret_pin?: string;
        admin_builder_url?: string;
        admin_github_repo_url?: string;
        admin_github_branch?: string;
        admin_render_url?: string;
      }
    | undefined;
  return {
    secretPin: String(row?.admin_secret_pin || '2026').trim() || '2026',
    builderUrl: String(row?.admin_builder_url || '').trim(),
    githubRepoUrl: String(row?.admin_github_repo_url || '').trim(),
    githubBranch: String(row?.admin_github_branch || 'main').trim() || 'main',
    renderUrl: String(row?.admin_render_url || '').trim(),
  };
}

export function updateAdminSecretSettings(
  patch: Partial<AdminSecretSettings>
): AdminSecretSettings {
  const current = getAdminSecretSettings();
  const next: AdminSecretSettings = {
    secretPin: patch.secretPin !== undefined ? patch.secretPin.trim() : current.secretPin,
    builderUrl: patch.builderUrl !== undefined ? patch.builderUrl.trim() : current.builderUrl,
    githubRepoUrl:
      patch.githubRepoUrl !== undefined ? patch.githubRepoUrl.trim() : current.githubRepoUrl,
    githubBranch:
      patch.githubBranch !== undefined
        ? patch.githubBranch.trim() || 'main'
        : current.githubBranch,
    renderUrl: patch.renderUrl !== undefined ? patch.renderUrl.trim() : current.renderUrl,
  };
  db.prepare(
    `UPDATE system_config
     SET admin_secret_pin = ?,
         admin_builder_url = ?,
         admin_github_repo_url = ?,
         admin_github_branch = ?,
         admin_render_url = ?
     WHERE id = 1`
  ).run(next.secretPin, next.builderUrl, next.githubRepoUrl, next.githubBranch, next.renderUrl);
  return next;
}

export function getTransactionsForUser(userId: string): Transaction[] {
  const rows = db
    .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY datetime(created_at) DESC LIMIT 40')
    .all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    user_id: String(r.user_id),
    type: r.type as Transaction['type'],
    payment_method: r.payment_method ? String(r.payment_method) : null,
    sender_details: r.sender_details ? String(r.sender_details) : null,
    receiver_details: r.receiver_details ? String(r.receiver_details) : null,
    reference_no: r.reference_no ? String(r.reference_no) : null,
    amount: Number(r.amount),
    status: r.status as Transaction['status'],
    created_at: String(r.created_at),
  }));
}

export function getAllTransactions(): Transaction[] {
  const rows = db
    .prepare(`
      SELECT t.*, p.full_name as user_name, p.phone as user_phone
      FROM transactions t
      LEFT JOIN profiles p ON p.id = t.user_id
      ORDER BY CASE WHEN t.status = 'pending' THEN 0 ELSE 1 END, datetime(t.created_at) DESC
      LIMIT 100
    `)
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    user_id: String(r.user_id),
    user_name: r.user_name ? String(r.user_name) : 'Player',
    user_phone: r.user_phone ? String(r.user_phone) : '',
    type: r.type as Transaction['type'],
    payment_method: r.payment_method ? String(r.payment_method) : null,
    sender_details: r.sender_details ? String(r.sender_details) : null,
    receiver_details: r.receiver_details ? String(r.receiver_details) : null,
    reference_no: r.reference_no ? String(r.reference_no) : null,
    amount: Number(r.amount),
    status: r.status as Transaction['status'],
    created_at: String(r.created_at),
  }));
}

export function getNotificationsForUser(userId: string): NotificationItem[] {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY datetime(created_at) DESC LIMIT 25')
    .all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    user_id: String(r.user_id),
    title: String(r.title),
    message: String(r.message),
    is_read: Boolean(r.is_read),
    created_at: String(r.created_at),
  }));
}

export function addNotification(userId: string, title: string, message: string): NotificationItem {
  const id = createId('notif');
  db.prepare('INSERT INTO notifications (id, user_id, title, message, is_read) VALUES (?, ?, ?, ?, 0)').run(
    id,
    userId,
    title,
    message
  );
  return {
    id,
    user_id: userId,
    title,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
  };
}

export function getGameTables(activeSeatCounts: Map<string, number>): GameTableSummary[] {
  const rows = db
    .prepare(
      `SELECT * FROM game_tables
       ORDER BY game_key ASC,
         CASE variant WHEN 'Regular' THEN 1 WHEN 'Butasan' THEN 2 WHEN 'Joker' THEN 3 ELSE 4 END ASC,
         max_players ASC,
         bet_amount ASC`
    )
    .all() as Record<string, unknown>[];
  return rows.map((r) => {
    const id = String(r.id);
    let milestones: MilestoneEntry[] = [];
    try {
      milestones = JSON.parse(String(r.milestone_log || '[]'));
    } catch {
      milestones = [];
    }
    return {
      id,
      game_key: r.game_key as GameKey,
      variant: (r.variant as GameTableSummary['variant']) || 'Regular',
      max_players: Number(r.max_players),
      bet_amount: Number(r.bet_amount),
      min_wallet: Number(r.min_wallet),
      rake_amount: Number(r.rake_amount),
      is_enabled: r.is_enabled === undefined ? true : Boolean(r.is_enabled),
      status: (r.status as GameTableSummary['status']) || 'waiting',
      banker_id: r.banker_id ? String(r.banker_id) : null,
      hands_played: Number(r.hands_played),
      total_pot_volume: Number(r.total_pot_volume),
      active_players: activeSeatCounts.get(id) ?? 0,
      milestone_log: milestones,
      created_at: String(r.created_at),
    };
  });
}

export function recalculateVipLevel(userId: string): void {
  const p = getProfileById(userId);
  if (!p || p.role === 'admin' || p.role === 'bot') return;
  const nextVip = p.total_cash_in >= 1000 && p.total_bet >= 10000 ? 2 : 1;
  if (nextVip !== p.vip_level) {
    db.prepare('UPDATE profiles SET vip_level = ? WHERE id = ?').run(nextVip, userId);
    if (nextVip === 2) {
      addNotification(
        userId,
        'Upgraded to VIP 2',
        'Congratulations! You unlocked VIP 2 with priority VIP rewards and 3x daily cashout up to ₱5,000.'
      );
    }
  }
}

export function getTournamentsSummary(currentUserId?: string): TournamentSummary[] {
  const games = getGameSettings();
  const entriesRows = db
    .prepare(`
      SELECT te.*, p.full_name as user_name, p.vip_level as vip_level
      FROM tournament_entries te
      JOIN profiles p ON p.id = te.user_id
      ORDER BY te.score DESC, datetime(te.joined_at) ASC
    `)
    .all() as Record<string, unknown>[];

  const byGame = new Map<string, TournamentEntry[]>();
  for (const r of entriesRows) {
    const gk = String(r.game_key);
    const list = byGame.get(gk) || [];
    list.push({
      id: String(r.id),
      game_key: gk as GameKey,
      user_id: String(r.user_id),
      user_name: String(r.user_name),
      vip_level: Number(r.vip_level),
      score: Number(r.score),
      joined_at: String(r.joined_at),
    });
    byGame.set(gk, list);
  }

  return games.map((g) => {
    const entrants = byGame.get(g.game_key) || [];
    return {
      game_key: g.game_key,
      game_name: g.game_name,
      short_label: g.short_label,
      tournament_enabled: g.tournament_enabled,
      tournament_prize: g.tournament_prize,
      entry_fee: 50,
      entrants,
      is_joined: Boolean(currentUserId && entrants.some((e) => e.user_id === currentUserId)),
    };
  });
}

export function getAgentOverview(userId: string): AgentOverviewData | null {
  const profile = getProfileById(userId);
  if (!profile) return null;
  const rows = db
    .prepare(`
      SELECT id, full_name, phone, vip_level, total_cash_in, total_bet, created_at
      FROM profiles
      WHERE referred_by = ?
      ORDER BY datetime(created_at) DESC
    `)
    .all(profile.referral_code) as Record<string, unknown>[];

  const members = rows.map((r) => ({
    id: String(r.id),
    full_name: String(r.full_name),
    phone: String(r.phone),
    vip_level: Number(r.vip_level),
    total_cash_in: Number(r.total_cash_in),
    total_bet: Number(r.total_bet),
    created_at: String(r.created_at),
  }));

  const totalReferralVolume = members.reduce((sum, m) => sum + m.total_bet + m.total_cash_in, 0);
  const estimatedCommission = Number((totalReferralVolume * 0.05).toFixed(2));

  return {
    referralCode: profile.referral_code,
    referredCount: members.length,
    totalReferralVolume: Number(totalReferralVolume.toFixed(2)),
    estimatedCommission,
    members,
  };
}

export { db };
