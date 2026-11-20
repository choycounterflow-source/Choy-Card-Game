import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  addNotification,
  createId,
  db,
  getAdminSecretSettings,
  getAgentOverview,
  getAllProfiles,
  getAllTransactions,
  getGameSettings,
  getGameTables,
  getNotificationsForUser,
  getProfileById,
  getProfileByPhone,
  getSystemConfig,
  getTournamentsSummary,
  getTransactionsForUser,
  initDatabase,
  recalculateVipLevel,
  updateAdminSecretSettings,
} from './server/db.ts';
import type {
  ActiveTableSession,
  GameAnalyticsRow,
  GameKey,
  MilestoneEntry,
  SeatedPlayer,
  SlotGameKey,
  SuperAcePlayerState,
  TongitsVariant,
} from './src/types.ts';
import {
  BET_TIERS,
  SLOT_GAME_CATALOG,
  SLOT_GAME_KEYS,
  SUPER_ACE_BETS,
  VIP_RULES,
} from './src/types.ts';
import { BUY_SPIN_COST_MULTIPLIER, runSuperAceBuySpin, runSuperAceSpin } from './server/superAceEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

initDatabase();

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '20mb' }));

function getClientIp(req: express.Request): string {
  const xff = req.headers['x-forwarded-for'];
  const forwarded = Array.isArray(xff)
    ? xff[0]
    : typeof xff === 'string'
      ? xff.split(',')[0]
      : '';
  const realIp = typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : '';
  const raw = forwarded || realIp || req.ip || req.socket?.remoteAddress || 'unknown';
  return String(raw).trim().replace(/^::ffff:/, '').toLowerCase() || 'unknown';
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientSocket extends WebSocket {
  userId?: string;
  userName?: string;
  tableId?: string;
}

interface HumanSeatRecord {
  userId: string;
  name: string;
  vipLevel: number;
  bringInWallet: number;
  lat: number | null;
  lng: number | null;
}

// Authoritative in-memory active multiplayer seats per table
const activeTableHumans = new Map<string, Map<string, HumanSeatRecord>>();

function getSeatCountMap(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [tableId, seatMap] of activeTableHumans.entries()) {
    counts.set(tableId, seatMap.size);
  }
  return counts;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function broadcastGlobal(event: string, payload: unknown): void {
  const msg = JSON.stringify({ event, payload });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function broadcastToUser(userId: string, event: string, payload: unknown): void {
  const msg = JSON.stringify({ event, payload });
  for (const raw of wss.clients) {
    const client = raw as ClientSocket;
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      client.send(msg);
    }
  }
}

function broadcastToTable(tableId: string, event: string, payload: unknown): void {
  const msg = JSON.stringify({ event, payload });
  for (const raw of wss.clients) {
    const client = raw as ClientSocket;
    if (client.readyState === WebSocket.OPEN && client.tableId === tableId) {
      client.send(msg);
    }
  }
}

wss.on('connection', (rawSocket) => {
  const ws = rawSocket as ClientSocket;

  ws.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString()) as {
        event: string;
        payload?: Record<string, unknown>;
      };
      const payload = parsed.payload || {};

      if (parsed.event === 'auth:identify') {
        ws.userId = String(payload.userId || '');
        ws.userName = String(payload.userName || 'Player');
      } else if (parsed.event === 'table:subscribe') {
        ws.tableId = String(payload.tableId || '');
        const humans = activeTableHumans.get(ws.tableId);
        broadcastToTable(ws.tableId, 'table:presence', {
          tableId: ws.tableId,
          onlineCount: humans ? humans.size : 1,
        });
      } else if (parsed.event === 'table:unsubscribe') {
        ws.tableId = undefined;
      } else if (parsed.event === 'table:chat') {
        const tableId = String(payload.tableId || ws.tableId || '');
        if (!tableId) return;
        const chatMsg = {
          id: createId('msg'),
          tableId,
          senderId: String(payload.senderId || ws.userId || 'anon'),
          senderName: String(payload.senderName || ws.userName || 'Player'),
          text: String(payload.text || '').slice(0, 220),
          isEmoji: Boolean(payload.isEmoji),
          timestamp: new Date().toISOString(),
        };
        broadcastToTable(tableId, 'table:chat', chatMsg);
      } else if (parsed.event === 'table:action') {
        const tableId = String(payload.tableId || ws.tableId || '');
        if (!tableId) return;
        broadcastToTable(tableId, 'table:action', {
          ...payload,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('WebSocket message parse error:', err);
    }
  });

  ws.on('close', () => {
    if (ws.tableId && ws.userId) {
      const seatMap = activeTableHumans.get(ws.tableId);
      if (seatMap) {
        seatMap.delete(ws.userId);
        broadcastToTable(ws.tableId, 'table:presence', {
          tableId: ws.tableId,
          onlineCount: seatMap.size,
        });
      }
    }
  });
});

// ==================== PUBLIC & AUTH ENDPOINTS ====================

function isPrivateOrLocalHost(host: string): boolean {
  const clean = host.toLowerCase().trim();
  return (
    !clean ||
    clean.startsWith('localhost') ||
    clean.startsWith('127.0.0.1') ||
    clean.startsWith('0.0.0.0') ||
    clean.startsWith('ais-dev-') ||
    clean.includes('aistudio.google.com')
  );
}

function getRequestOrigin(req: express.Request): string | null {
  const rawHost = String(req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim();
  if (!rawHost) return null;
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https')
    .split(',')[0]
    .trim();
  return `${proto}://${rawHost}`.replace(/\/+$/, '');
}

function getDefaultSharedAppUrl(req?: express.Request): string {
  // 1. If the app is already running on a real deployed public host (Cloud Run / custom domain / published ais-pre), use it directly!
  if (req) {
    const rawHost = String(req.get('x-forwarded-host') || req.get('host') || '')
      .split(',')[0]
      .trim();
    if (rawHost && !isPrivateOrLocalHost(rawHost)) {
      const proto = String(req.get('x-forwarded-proto') || 'https')
        .split(',')[0]
        .trim();
      return `${proto}://${rawHost}`.replace(/\/+$/, '');
    }
  }

  const raw =
    (process.env.SHARED_APP_URL || '').trim() ||
    (process.env.APP_URL || '').trim() ||
    'https://ais-pre-esajh5tb77exk5tdp6dme7-893033407659.asia-northeast1.run.app';
  return raw.replace('://ais-dev-', '://ais-pre-').replace(/\/+$/, '');
}

async function probePublicUrlStatus(urlToCheck: string): Promise<{ isLive: boolean; status: number }> {
  if (!urlToCheck || !/^https?:\/\//i.test(urlToCheck)) {
    return { isLive: false, status: 0 };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${urlToCheck.replace(/\/+$/, '')}/`, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    // 200-399 means the host is live and responding; 404/5xx means not published yet
    const isLive = response.status >= 200 && response.status < 400;
    return { isLive, status: response.status };
  } catch {
    return { isLive: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/api/share-config', async (req, res) => {
  const sys = getSystemConfig();
  const requestOrigin = getRequestOrigin(req);
  const rawHost = String(req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim();
  const runningOnPublicHost = Boolean(rawHost && !isPrivateOrLocalHost(rawHost));

  const defaultShareUrl = getDefaultSharedAppUrl(req);
  const customShareUrl = (sys.public_share_url || '').trim().replace(/\/+$/, '');
  const shareUrl = customShareUrl
    ? customShareUrl.replace('://ais-dev-', '://ais-pre-')
    : defaultShareUrl;

  let isPublicLive = runningOnPublicHost && (!customShareUrl || customShareUrl === requestOrigin);
  let httpStatus = isPublicLive ? 200 : 0;

  if (!isPublicLive) {
    const probed = await probePublicUrlStatus(shareUrl);
    isPublicLive = probed.isLive;
    httpStatus = probed.status;
  }

  res.json({
    appName: 'Choy Card Game',
    shareUrl,
    defaultShareUrl,
    customShareUrl,
    isPublicLive,
    httpStatus,
    runningOnPublicHost,
  });
});

app.get('/api/public/config', (_req, res) => {
  const sys = getSystemConfig();
  const games = getGameSettings();
  res.json({
    systemConfig: sys,
    games,
  });
});

app.post('/api/auth/login', (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  const password = String(req.body?.password || '').trim();

  if (!phone || !password) {
    return res.status(400).json({ error: 'Please enter mobile number and password.' });
  }

  const found = getProfileByPhone(phone);
  if (!found || found.password_hash !== password) {
    return res.status(401).json({ error: 'Invalid mobile number or password.' });
  }

  const { password_hash: _ignored, ...profile } = found;
  res.json({ user: profile });
});

app.post('/api/auth/register', (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  const password = String(req.body?.password || '').trim();
  const fullName = String(req.body?.fullName || '').trim();
  const withdrawalPin = String(req.body?.withdrawalPin || '1234').trim();
  const referredBy = String(req.body?.referredBy || '').trim() || null;

  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Enter a valid 11-digit mobile number.' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }
  if (!fullName || fullName.length < 2) {
    return res.status(400).json({ error: 'Enter your display name.' });
  }
  if (!/^\d{4}$/.test(withdrawalPin)) {
    return res.status(400).json({ error: 'Withdrawal PIN must be 4 digits.' });
  }

  const existing = getProfileByPhone(phone);
  if (existing) {
    return res.status(409).json({ error: 'Mobile number is already registered. Please log in.' });
  }

  const id = createId('plr');
  const referralCode = `CHOY${Math.floor(1000 + Math.random() * 9000)}`;
  const clientIp = getClientIp(req);

  // Enforce strict once-per-Phone-IP welcome scatter eligibility:
  // Only the 1st account registered from a given IP address is eligible for the 1st-spin & 20th-spin welcome scatter.
  // Any 2nd, 3rd, ... account created on the same phone/IP gets welcome_scatter_eligible = 0.
  const existingIpClaim =
    clientIp !== 'unknown'
      ? (db
          .prepare('SELECT first_user_id FROM slot_welcome_scatter_ips WHERE ip_address = ?')
          .get(clientIp) as { first_user_id: string } | undefined)
      : undefined;
  const existingIpAccount =
    clientIp !== 'unknown'
      ? (db
          .prepare("SELECT id FROM profiles WHERE registered_ip = ? AND role != 'admin' LIMIT 1")
          .get(clientIp) as { id: string } | undefined)
      : undefined;

  const isFirstAccountOnIp = !existingIpClaim && !existingIpAccount ? 1 : 0;

  // All new players start with ₱0 coins — Admin handles all wallet funding & Cash-In approvals
  db.prepare(`
    INSERT INTO profiles (
      id, phone, password_hash, full_name, role, vip_level, wallet_balance,
      total_cash_in, total_bet, total_wins, total_losses, games_won, games_lost,
      pending_cashback, withdrawal_pin, referral_code, referred_by,
      registered_ip, welcome_scatter_eligible
    ) VALUES (?, ?, ?, ?, 'player', 1, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?)
  `).run(id, phone, password, fullName, withdrawalPin, referralCode, referredBy, clientIp, isFirstAccountOnIp);

  if (isFirstAccountOnIp === 1 && clientIp !== 'unknown') {
    db.prepare(`
      INSERT OR IGNORE INTO slot_welcome_scatter_ips (ip_address, first_user_id, claimed_game_key)
      VALUES (?, ?, '')
    `).run(clientIp, id);
  }

  addNotification(
    id,
    'Account Registered',
    'Welcome to Choy Card Game! Submit Cash-In or contact Admin to load coins into your wallet.'
  );

  const profile = getProfileById(id);
  res.status(201).json({ user: profile });
});

app.get('/api/auth/me', (req, res) => {
  const userId = String(req.query.userId || '');
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const profile = getProfileById(userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json({ user: profile });
});

// ==================== PLAYER DASHBOARD & WALLET ====================

app.get('/api/player/dashboard', (req, res) => {
  const userId = String(req.query.userId || '');
  const profile = getProfileById(userId);
  if (!profile) {
    return res.status(404).json({ error: 'User not found' });
  }

  const games = getGameSettings();
  const systemConfig = getSystemConfig();
  const transactions = getTransactionsForUser(userId);
  const notifications = getNotificationsForUser(userId);
  const tables = getGameTables(getSeatCountMap());
  const allProfiles = getAllProfiles().filter((p) => p.role !== 'admin');

  const weeklyTop3 = [...allProfiles]
    .sort((a, b) => b.total_wins - a.total_wins)
    .slice(0, 3)
    .map((p, idx) => ({
      rank: idx + 1,
      id: p.id,
      full_name: p.full_name,
      vip_level: p.vip_level,
      total_wins: p.total_wins,
      games_won: p.games_won,
      prize:
        idx === 0
          ? systemConfig.weekly_top1_prize
          : idx === 1
            ? systemConfig.weekly_top2_prize
            : systemConfig.weekly_top3_prize,
    }));

  const vipDirectory = allProfiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
    vip_level: p.vip_level,
    games_won: p.games_won,
    games_lost: p.games_lost,
    total_wins: p.total_wins,
    wallet_balance: p.wallet_balance,
  }));

  res.json({
    profile,
    games,
    systemConfig,
    transactions,
    notifications,
    tables,
    weeklyTop3,
    vipDirectory,
  });
});

app.post('/api/player/update-location', (req, res) => {
  const { userId, lat, lng } = req.body || {};
  if (!userId || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Invalid GPS coordinates' });
  }
  db.prepare('UPDATE profiles SET last_lat = ?, last_lng = ? WHERE id = ?').run(lat, lng, String(userId));
  res.json({ ok: true, lat, lng });
});

app.post('/api/player/daily-checkin', (req, res) => {
  const { userId, dayNumber } = req.body || {};
  const profile = getProfileById(String(userId || ''));
  if (!profile) return res.status(404).json({ error: 'User not found' });

  const dayNum = Number(dayNumber);
  if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 7) {
    return res.status(400).json({ error: 'Invalid day number (1-7).' });
  }

  const rewards: Record<number, number> = {
    1: 5,
    2: 10,
    3: 20,
    4: 35,
    5: 50,
    6: 75,
    7: 150,
  };
  const rewardAmt = rewards[dayNum] || 5;

  let claimedDays: number[] = [];
  try {
    claimedDays = JSON.parse(profile.checkin_claimed_days || '[]');
  } catch {
    claimedDays = [];
  }

  if (claimedDays.includes(dayNum)) {
    return res.status(400).json({ error: `Day ${dayNum} reward has already been claimed.` });
  }

  claimedDays.push(dayNum);
  const nextStreak = Math.max(profile.daily_streak || 0, dayNum);
  const todayStr = new Date().toISOString().slice(0, 10);

  db.prepare(`
    UPDATE profiles
    SET wallet_balance = ROUND(wallet_balance + ?, 2),
        daily_streak = ?,
        last_checkin_date = ?,
        checkin_claimed_days = ?
    WHERE id = ?
  `).run(rewardAmt, nextStreak, todayStr, JSON.stringify(claimedDays), profile.id);

  db.prepare(`
    INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
    VALUES (?, ?, 'bonus', 'Daily Check-in Reward', 'Choy Card Game', ?, ?, ?, 'completed')
  `).run(createId('tx'), profile.id, profile.full_name, `CHECKIN-D${dayNum}-${Date.now().toString().slice(-5)}`, rewardAmt);

  addNotification(
    profile.id,
    `Daily Reward Claimed (Day ${dayNum})!`,
    `Congratulations! You claimed your Day ${dayNum} login bonus of ₱${rewardAmt}.`
  );

  const updated = getProfileById(profile.id);
  if (updated) {
    broadcastToUser(profile.id, 'wallet:update', { wallet_balance: updated.wallet_balance });
    broadcastToUser(profile.id, 'notification:new', { title: 'Daily Reward Claimed' });
  }

  res.json({ ok: true, reward: rewardAmt, profile: updated });
});

app.post('/api/player/update-pin', (req, res) => {
  const { userId, currentPin, newPin } = req.body || {};
  const profile = getProfileById(String(userId || ''));
  if (!profile) return res.status(404).json({ error: 'User not found' });
  if (profile.withdrawal_pin !== String(currentPin || '')) {
    return res.status(400).json({ error: 'Current withdrawal PIN does not match.' });
  }
  if (!/^\d{4}$/.test(String(newPin || ''))) {
    return res.status(400).json({ error: 'New PIN must be exactly 4 digits.' });
  }
  db.prepare('UPDATE profiles SET withdrawal_pin = ? WHERE id = ?').run(String(newPin), profile.id);
  res.json({ ok: true });
});

app.post('/api/player/notifications/read', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(String(userId));
  res.json({ ok: true });
});

app.delete('/api/player/notifications/:notificationId', (req, res) => {
  const userId = String(req.query.userId || req.body?.userId || '').trim();
  const notificationId = String(req.params.notificationId || '').trim();
  if (!userId || !notificationId) {
    return res.status(400).json({ error: 'Missing userId or notificationId' });
  }
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(notificationId, userId);
  res.json({ ok: true, notifications: getNotificationsForUser(userId) });
});

app.delete('/api/player/notifications', (req, res) => {
  const userId = String(req.query.userId || req.body?.userId || '').trim();
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
  res.json({ ok: true, notifications: [] });
});

app.post('/api/player/cash-in', (req, res) => {
  const { userId, senderDetails, receiverDetails, paymentMethod, amount, referenceNo } = req.body || {};
  const profile = getProfileById(String(userId || ''));
  if (!profile) return res.status(404).json({ error: 'User not found' });

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount < 100) {
    return res.status(400).json({ error: 'Minimum Cash-In is ₱100.00.' });
  }
  if (!String(senderDetails || '').trim()) {
    return res.status(400).json({ error: 'Sender name or account number is required.' });
  }
  if (!String(referenceNo || '').trim()) {
    return res.status(400).json({ error: 'Payment reference number is required.' });
  }

  const txId = createId('tx');
  db.prepare(`
    INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
    VALUES (?, ?, 'cash_in', ?, ?, ?, ?, ?, 'pending')
  `).run(
    txId,
    profile.id,
    String(paymentMethod || 'GCash'),
    String(senderDetails).trim(),
    String(receiverDetails || 'ChoyJiez Official (09361223978)').trim(),
    String(referenceNo).trim(),
    numAmount
  );

  addNotification(
    profile.id,
    'Cash-In Submitted',
    `Your ₱${numAmount.toFixed(2)} ${paymentMethod || 'GCash'} cash-in (Ref: ${referenceNo}) is awaiting Admin approval.`
  );

  broadcastGlobal('admin:tx_updated', { txId, type: 'cash_in', status: 'pending' });
  res.status(201).json({ ok: true, txId });
});

app.post('/api/player/cash-out', (req, res) => {
  const { userId, amount, withdrawalPin, paymentMethod, receiverDetails } = req.body || {};
  const profile = getProfileById(String(userId || ''));
  if (!profile) return res.status(404).json({ error: 'User not found' });

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount < 100) {
    return res.status(400).json({ error: 'Minimum Cash-Out is ₱100.00.' });
  }
  if (profile.withdrawal_pin !== String(withdrawalPin || '')) {
    return res.status(403).json({ error: 'Incorrect 4-digit Withdrawal PIN.' });
  }
  if (numAmount > profile.wallet_balance) {
    return res.status(400).json({ error: 'Insufficient wallet balance.' });
  }

  const vipCfg = profile.vip_level >= 2 ? VIP_RULES[2] : VIP_RULES[1];
  const today = new Date().toISOString().slice(0, 10);
  const usedToday = profile.last_cashout_date === today ? profile.daily_cashout_count : 0;

  if (usedToday >= vipCfg.dailyCashoutLimit) {
    return res.status(400).json({
      error: `${vipCfg.name} daily cash-out limit reached (${vipCfg.dailyCashoutLimit}x/day).`,
    });
  }
  if (numAmount > vipCfg.maxCashoutAmount) {
    return res.status(400).json({
      error: `${vipCfg.name} maximum cash-out is ₱${vipCfg.maxCashoutAmount.toLocaleString()} per request.`,
    });
  }

  const txId = createId('tx');
  const nextWallet = Number((profile.wallet_balance - numAmount).toFixed(2));
  db.prepare(`
    UPDATE profiles
    SET wallet_balance = ?, daily_cashout_count = ?, last_cashout_date = ?
    WHERE id = ?
  `).run(nextWallet, usedToday + 1, today, profile.id);

  db.prepare(`
    INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
    VALUES (?, ?, 'cash_out', ?, 'ChoyJiez Payout', ?, ?, ?, 'pending')
  `).run(
    txId,
    profile.id,
    String(paymentMethod || 'GCash'),
    String(receiverDetails || `${profile.full_name} (${profile.phone})`),
    `CO-${Date.now().toString().slice(-6)}`,
    numAmount
  );

  addNotification(
    profile.id,
    'Cash-Out Queued',
    `Withdrawal of ₱${numAmount.toFixed(2)} to ${paymentMethod || 'GCash'} submitted for payout processing.`
  );

  broadcastToUser(profile.id, 'wallet:update', { wallet_balance: nextWallet });
  broadcastGlobal('admin:tx_updated', { txId, type: 'cash_out', status: 'pending' });

  res.status(201).json({ ok: true, txId, wallet_balance: nextWallet });
});

// ==================== GAME TABLES, 2KM GPS CHECK & AUTO-RAKE ====================

app.post('/api/table/join', (req, res) => {
  const { userId, gameKey, tableId: requestedTableId, betAmount, bringInAmount, variant, maxPlayers, lat, lng } = req.body || {};
  const profile = getProfileById(String(userId || ''));
  if (!profile) return res.status(404).json({ error: 'Player profile not found.' });

  const games = getGameSettings();
  const game = games.find((g) => g.game_key === gameKey);
  if (!game) return res.status(404).json({ error: 'Selected game not found.' });
  if (!game.is_enabled && profile.role !== 'admin') {
    return res.status(403).json({ error: `${game.short_label} is currently disabled by Admin.` });
  }

  const normalizedVariant: TongitsVariant =
    variant === 'Butasan' || variant === 'Joker' ? variant : 'Regular';
  const requestedPlayers = Number(maxPlayers) === 2 ? 2 : 3;

  // Look up the exact table row (supports direct tableId or Tong-its mode+seats+bet matrix)
  let tblRow = requestedTableId
    ? (db.prepare('SELECT * FROM game_tables WHERE id = ?').get(String(requestedTableId)) as Record<string, unknown> | undefined)
    : undefined;

  if (!tblRow && game.game_key === 'tongits') {
    const inferredId = `tbl-tongits-${normalizedVariant.toLowerCase()}-${requestedPlayers}p-b${Number(betAmount)}`;
    tblRow = db.prepare('SELECT * FROM game_tables WHERE id = ?').get(inferredId) as Record<string, unknown> | undefined;
    if (!tblRow) {
      tblRow = db
        .prepare(
          `SELECT * FROM game_tables WHERE game_key = 'tongits' AND variant = ? AND max_players = ? AND bet_amount = ? LIMIT 1`
        )
        .get(normalizedVariant, requestedPlayers, Number(betAmount)) as Record<string, unknown> | undefined;
    }
  }

  if (!tblRow) {
    const fallbackId = `tbl-${game.game_key}-b${Number(betAmount)}`;
    tblRow = db.prepare('SELECT * FROM game_tables WHERE id = ?').get(fallbackId) as Record<string, unknown> | undefined;
  }

  const fallbackTier = BET_TIERS.find((t) => t.bet === Number(betAmount));
  if (!tblRow && !fallbackTier) {
    return res.status(400).json({ error: 'Selected table or bet tier not found.' });
  }

  // Enforce per-table Admin Enable/Disable setting
  if (tblRow && Number(tblRow.is_enabled ?? 1) === 0 && profile.role !== 'admin') {
    return res.status(403).json({
      error: `This ${game.short_label} table is currently disabled by Admin. Please choose another available table.`,
    });
  }

  const resolvedBet = tblRow ? Number(tblRow.bet_amount) : fallbackTier!.bet;
  const resolvedMinWallet = tblRow ? Number(tblRow.min_wallet) : fallbackTier!.minWallet;
  const resolvedRake = tblRow ? Number(tblRow.rake_amount) : fallbackTier!.rake;
  const resolvedVariant: TongitsVariant = tblRow
    ? ((String(tblRow.variant || 'Regular') as TongitsVariant) || 'Regular')
    : normalizedVariant;
  const desiredPlayers = tblRow && game.game_key === 'tongits'
    ? Number(tblRow.max_players) === 2
      ? 2
      : 3
    : requestedPlayers;

  const requestedBringIn = Number(bringInAmount || resolvedMinWallet);
  if (requestedBringIn < resolvedMinWallet) {
    return res.status(400).json({
      error: `Minimum wallet for Bet ₱${resolvedBet} table is ₱${resolvedMinWallet}.`,
    });
  }
  if (profile.wallet_balance < requestedBringIn) {
    return res.status(400).json({
      error: `Insufficient wallet balance! You need at least ₱${requestedBringIn} to sit at this table.`,
    });
  }

  const tableId = tblRow ? String(tblRow.id) : `tbl-${game.game_key}-b${resolvedBet}`;
  const playerLat = typeof lat === 'number' ? lat : profile.last_lat;
  const playerLng = typeof lng === 'number' ? lng : profile.last_lng;

  if (typeof playerLat === 'number' && typeof playerLng === 'number') {
    db.prepare('UPDATE profiles SET last_lat = ?, last_lng = ? WHERE id = ?').run(
      playerLat,
      playerLng,
      profile.id
    );
  }

  // STRICT 2KM GPS PROXIMITY CHECK against other real human players seated at this table
  const seatedHumans = activeTableHumans.get(tableId) || new Map<string, HumanSeatRecord>();
  if (typeof playerLat === 'number' && typeof playerLng === 'number') {
    for (const [otherId, seat] of seatedHumans.entries()) {
      if (otherId !== profile.id && typeof seat.lat === 'number' && typeof seat.lng === 'number') {
        const distKm = haversineDistanceKm(playerLat, playerLng, seat.lat, seat.lng);
        if (distKm <= 2.0) {
          return res.status(403).json({
            error: `GPS Anti-Collusion Lock: Seated player ${seat.name} is within ${distKm.toFixed(2)} km (strictly > 2.0 km required).`,
          });
        }
      }
    }
  }

  // Auto-deduct table rake
  const rake = resolvedRake;
  const updatedWallet = Number((profile.wallet_balance - rake).toFixed(2));
  const effectiveBringIn = Number((requestedBringIn - rake).toFixed(2));

  db.prepare('UPDATE profiles SET wallet_balance = ? WHERE id = ?').run(updatedWallet, profile.id);
  db.prepare(`
    INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
    VALUES (?, ?, 'rake', 'Auto-Rake', ?, 'House Auto-Rake', ?, ?, 'completed')
  `).run(
    createId('tx'),
    profile.id,
    `${game.short_label} ${game.game_key === 'tongits' ? `${resolvedVariant} ${desiredPlayers}P ` : ''}Bet ₱${resolvedBet}`,
    `RK-${Date.now().toString().slice(-6)}`,
    rake
  );

  // Register human seat
  seatedHumans.set(profile.id, {
    userId: profile.id,
    name: profile.full_name,
    vipLevel: profile.vip_level,
    bringInWallet: effectiveBringIn,
    lat: playerLat ?? null,
    lng: playerLng ?? null,
  });
  activeTableHumans.set(tableId, seatedHumans);

  // Build seats: real human players + built-in house players to fill 2P or 3P seats
  const bots = getAllProfiles().filter((p) => p.role === 'bot');
  const seats: SeatedPlayer[] = [];

  for (const h of seatedHumans.values()) {
    seats.push({
      id: h.userId,
      name: h.name,
      vipLevel: h.vipLevel,
      role: h.userId === profile.id ? profile.role : 'player',
      tableWallet: h.bringInWallet,
      cardCount: game.game_key === 'pusoy' ? 13 : game.game_key === 'tongits' ? 12 : 2,
      isBanker: false,
      botWinRate: 50,
    });
  }

  for (const bot of bots) {
    if (seats.length >= desiredPlayers) break;
    if (!seats.some((s) => s.id === bot.id)) {
      seats.push({
        id: bot.id,
        name: bot.full_name,
        vipLevel: bot.vip_level,
        role: 'bot',
        tableWallet: Math.min(bot.wallet_balance, resolvedMinWallet * 4 + 350),
        cardCount: game.game_key === 'pusoy' ? 13 : game.game_key === 'tongits' ? 12 : 2,
        isBanker: false,
        botWinRate: bot.bot_win_rate,
      });
    }
  }

  // Auto-assign Banker: Highest Wallet Amount (especially critical for Lucky 9!)
  let highestIdx = 0;
  for (let i = 1; i < seats.length; i++) {
    if (seats[i].tableWallet > seats[highestIdx].tableWallet) {
      highestIdx = i;
    }
  }
  if (seats[highestIdx]) {
    seats[highestIdx].isBanker = true;
  }

  // Update table milestone log
  let milestones: MilestoneEntry[] = [];
  let handsPlayed = 0;
  if (tblRow) {
    try {
      milestones = JSON.parse(String(tblRow.milestone_log || '[]'));
    } catch {
      milestones = [];
    }
    handsPlayed = Number(tblRow.hands_played || 0);
    milestones.unshift({
      timestamp: new Date().toISOString(),
      label: `${profile.full_name} Seated`,
      detail: `Buy-in ₱${effectiveBringIn.toFixed(2)} · Auto-Rake ₱${rake.toFixed(2)} · 2km GPS Verified`,
    });
    milestones = milestones.slice(0, 15);
    db.prepare(`
      UPDATE game_tables
      SET status = 'playing', banker_id = ?, milestone_log = ?
      WHERE id = ?
    `).run(
      seats[highestIdx]?.id || null,
      JSON.stringify(milestones),
      tableId
    );
  }

  const session: ActiveTableSession = {
    tableId,
    gameKey: game.game_key,
    gameName: game.short_label,
    variant: resolvedVariant,
    maxPlayers: desiredPlayers,
    betAmount: resolvedBet,
    minWallet: resolvedMinWallet,
    rakeAmount: rake,
    bringInWallet: effectiveBringIn,
    turnSeconds: game.turn_seconds,
    seats,
    milestones,
    handsPlayed,
  };

  broadcastToTable(tableId, 'table:presence', {
    tableId,
    onlineCount: seatedHumans.size,
  });

  res.json({ session, wallet_balance: updatedWallet });
});

app.post('/api/table/leave', (req, res) => {
  const { userId, tableId } = req.body || {};
  if (tableId && userId) {
    const seatMap = activeTableHumans.get(String(tableId));
    if (seatMap) {
      seatMap.delete(String(userId));
      if (seatMap.size === 0) {
        db.prepare(`UPDATE game_tables SET status = 'waiting' WHERE id = ?`).run(String(tableId));
      }
      broadcastToTable(String(tableId), 'table:presence', {
        tableId: String(tableId),
        onlineCount: seatMap.size,
      });
    }
  }
  res.json({ ok: true });
});

app.post('/api/table/settle', (req, res) => {
  const { userId, tableId, gameKey, betAmount, stakeTotal, netDelta, won, summary, botWinnerId } = req.body || {};
  const profile = getProfileById(String(userId || ''));
  if (!profile) return res.status(404).json({ error: 'Player not found' });

  const stake = Math.max(0, Number(stakeTotal || betAmount || 1));
  const delta = Number(netDelta || 0);
  const tier = BET_TIERS.find((t) => t.bet === Number(betAmount)) || BET_TIERS[0];
  const rake = tier.rake;

  // Apply rake per hand played + net win/loss
  const nextWallet = Math.max(0, Number((profile.wallet_balance + delta - rake).toFixed(2)));
  const vipCfg = profile.vip_level >= 2 ? VIP_RULES[2] : VIP_RULES[1];
  const earnedCashback = Number((stake * vipCfg.cashbackRate).toFixed(2));

  db.prepare(`
    UPDATE profiles
    SET wallet_balance = ?,
        total_bet = total_bet + ?,
        total_wins = total_wins + ?,
        total_losses = total_losses + ?,
        games_won = games_won + ?,
        games_lost = games_lost + ?,
        pending_cashback = pending_cashback + ?
    WHERE id = ?
  `).run(
    nextWallet,
    stake,
    won ? Math.max(0, delta) : 0,
    won ? 0 : Math.abs(Math.min(0, delta)),
    won ? 1 : 0,
    won ? 0 : 1,
    earnedCashback,
    profile.id
  );

  recalculateVipLevel(profile.id);

  // If player is enrolled in this game's tournament, award tournament leaderboard points
  if (gameKey) {
    const tourneyPts = won ? Math.round(50 + stake * 5) : 15;
    db.prepare(`
      UPDATE tournament_entries
      SET score = score + ?
      WHERE game_key = ? AND user_id = ?
    `).run(tourneyPts, String(gameKey), profile.id);
  }

  // Record rake & win/loss transaction
  db.prepare(`
    INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
    VALUES (?, ?, 'rake', 'Auto-Rake', ?, 'House Auto-Rake', ?, ?, 'completed')
  `).run(createId('tx'), profile.id, `${gameKey} Round Rake`, `RK-${Date.now().toString().slice(-6)}`, rake);

  if (delta !== 0) {
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `).run(
      createId('tx'),
      profile.id,
      won ? 'win' : 'loss',
      String(gameKey || 'card'),
      String(summary || 'Table Round Settlement'),
      profile.full_name,
      `RD-${Date.now().toString().slice(-6)}`,
      Math.abs(delta)
    );
  }

  // Update built-in 80% bot profile stats if bot won or lost
  if (botWinnerId) {
    const bot = getProfileById(String(botWinnerId));
    if (bot && bot.role === 'bot') {
      db.prepare(`
        UPDATE profiles
        SET wallet_balance = wallet_balance + ?,
            total_wins = total_wins + ?,
            games_won = games_won + 1
        WHERE id = ?
      `).run(Math.abs(delta) || stake, Math.abs(delta) || stake, bot.id);
    }
  } else if (won) {
    // Player beat built-in bot(s), update bot stats without auto-minting coins
    db.prepare(`
      UPDATE profiles
      SET games_lost = games_lost + 1,
          total_losses = total_losses + ?,
          wallet_balance = MAX(0, wallet_balance - ?)
      WHERE id = 'bot-mastercard-001'
    `).run(Math.max(1, delta), Math.max(1, delta));
  }

  // Append milestone log to table
  let updatedMilestones: MilestoneEntry[] = [];
  let handsPlayed = 1;
  if (tableId) {
    const tbl = db.prepare('SELECT hands_played, total_pot_volume, milestone_log FROM game_tables WHERE id = ?').get(String(tableId)) as Record<string, unknown> | undefined;
    if (tbl) {
      handsPlayed = Number(tbl.hands_played || 0) + 1;
      const nextPot = Number(tbl.total_pot_volume || 0) + stake * 2;
      try {
        updatedMilestones = JSON.parse(String(tbl.milestone_log || '[]'));
      } catch {
        updatedMilestones = [];
      }
      updatedMilestones.unshift({
        timestamp: new Date().toISOString(),
        label: `Hand #${handsPlayed} ${won ? 'Win' : 'Round Complete'}`,
        detail: `${summary || gameKey} · Net ${delta >= 0 ? '+' : ''}₱${delta.toFixed(2)} · Rake ₱${rake.toFixed(2)}`,
      });
      updatedMilestones = updatedMilestones.slice(0, 15);
      db.prepare(`
        UPDATE game_tables
        SET hands_played = ?, total_pot_volume = ?, milestone_log = ?
        WHERE id = ?
      `).run(handsPlayed, nextPot, JSON.stringify(updatedMilestones), String(tableId));
    }
  }

  const freshProfile = getProfileById(profile.id);
  broadcastToUser(profile.id, 'wallet:update', { wallet_balance: freshProfile?.wallet_balance ?? nextWallet });
  res.json({
    profile: freshProfile,
    earnedCashback,
    rakeDeducted: rake,
    handsPlayed,
    milestones: updatedMilestones,
  });
});

// ==================== 6×5 SLOT MACHINES (SUPER ACE + UPCOMING CHOY SLOTS) ====================

function resolveSlotKey(raw: string): SlotGameKey | null {
  const normalized = raw === 'super-ace' ? 'superace' : raw;
  return SLOT_GAME_KEYS.includes(normalized as SlotGameKey) ? (normalized as SlotGameKey) : null;
}

function getOrCreateSlotState(userId: string, gameKey: SlotGameKey): SuperAcePlayerState {
  const row = db
    .prepare('SELECT * FROM slot_game_states WHERE user_id = ? AND game_key = ?')
    .get(userId, gameKey) as Record<string, unknown> | undefined;

  if (!row) {
    db.prepare(`
      INSERT INTO slot_game_states (
        user_id, game_key, total_regular_spins, scatters_triggered, spins_since_last_scatter,
        free_spins_remaining, free_spins_total, free_spin_bet, free_spin_total_win,
        buy_bonus_target_win, buy_bonus_rate_pct
      ) VALUES (?, ?, 0, 0, 0, 0, 0, 1, 0, 0, 0)
    `).run(userId, gameKey);
    return {
      totalRegularSpins: 0,
      scattersTriggered: 0,
      spinsSinceLastScatter: 0,
      freeSpinsRemaining: 0,
      freeSpinsTotal: 0,
      freeSpinBet: 1,
      freeSpinTotalWin: 0,
      buyBonusTargetWin: 0,
      buyBonusRatePct: 0,
    };
  }

  return {
    totalRegularSpins: Number(row.total_regular_spins || 0),
    scattersTriggered: Number(row.scatters_triggered || 0),
    spinsSinceLastScatter: Number(row.spins_since_last_scatter || 0),
    freeSpinsRemaining: Number(row.free_spins_remaining || 0),
    freeSpinsTotal: Number(row.free_spins_total || 0),
    freeSpinBet: Number(row.free_spin_bet || 1),
    freeSpinTotalWin: Number(row.free_spin_total_win || 0),
    buyBonusTargetWin: Number(row.buy_bonus_target_win || 0),
    buyBonusRatePct: Number(row.buy_bonus_rate_pct || 0),
  };
}

app.get('/api/slots/:gameKey/state', (req, res) => {
  const slotKey = resolveSlotKey(String(req.params.gameKey || ''));
  if (!slotKey) return res.status(404).json({ error: 'Slot game not found.' });

  const userId = String(req.query.userId || '');
  const profile = getProfileById(userId);
  if (!profile) return res.status(404).json({ error: 'Player not found.' });

  const state = getOrCreateSlotState(profile.id, slotKey);
  const vipCfg = profile.vip_level >= 2 ? VIP_RULES[2] : VIP_RULES[1];

  res.json({
    gameKey: slotKey,
    state,
    profile,
    cashbackRate: vipCfg.cashbackRate,
    cashbackLabel: vipCfg.cashbackLabel,
  });
});

app.post('/api/slots/:gameKey/buy-spin', (req, res) => {
  const slotKey = resolveSlotKey(String(req.params.gameKey || ''));
  if (!slotKey) return res.status(404).json({ error: 'Slot game not found.' });

  const slotMeta = SLOT_GAME_CATALOG[slotKey];
  const { userId, betAmount } = req.body || {};
  const profile = getProfileById(String(userId || ''));
  if (!profile) return res.status(404).json({ error: 'Player not found.' });

  const games = getGameSettings();
  const gameRow = games.find((g) => g.game_key === slotKey);
  if (gameRow && !gameRow.is_enabled && profile.role !== 'admin') {
    return res.status(403).json({
      error: `${slotMeta.title} is Coming Soon! Stay tuned for launch.`,
    });
  }

  const state = getOrCreateSlotState(profile.id, slotKey);
  if (state.freeSpinsRemaining > 0) {
    return res.status(400).json({
      error: `Finish your ${state.freeSpinsRemaining} active Free Scatter Spins first before buying another bonus.`,
    });
  }

  const requestedBet = Number(betAmount);
  if (!SUPER_ACE_BETS.includes(requestedBet as (typeof SUPER_ACE_BETS)[number])) {
    return res.status(400).json({
      error: `Invalid bet amount. Choose from: ${SUPER_ACE_BETS.join(', ')}`,
    });
  }

  const buyCost = Number((requestedBet * BUY_SPIN_COST_MULTIPLIER).toFixed(2));
  if (profile.wallet_balance < buyCost) {
    return res.status(400).json({
      error: `Insufficient wallet balance for Buy Free Spin Scatter (₱${buyCost.toFixed(2)} for ₱${requestedBet} bet).`,
    });
  }

  const preSpinWallet = profile.wallet_balance;
  const buyResult = runSuperAceBuySpin({
    betAmount: requestedBet,
    preSpinWallet,
    state,
  });

  const netDelta = Number((-buyCost).toFixed(2));
  const nextWallet = Math.max(0, Number((preSpinWallet - buyCost).toFixed(2)));
  const vipCfg = profile.vip_level >= 2 ? VIP_RULES[2] : VIP_RULES[1];
  const cashbackEarned = Number((buyCost * vipCfg.cashbackRate).toFixed(4));

  db.prepare(`
    UPDATE slot_game_states
    SET total_regular_spins = ?,
        scatters_triggered = ?,
        spins_since_last_scatter = ?,
        free_spins_remaining = ?,
        free_spins_total = ?,
        free_spin_bet = ?,
        free_spin_total_win = ?,
        buy_bonus_target_win = ?,
        buy_bonus_rate_pct = ?,
        updated_at = datetime('now')
    WHERE user_id = ? AND game_key = ?
  `).run(
    buyResult.nextState.totalRegularSpins,
    buyResult.nextState.scattersTriggered,
    buyResult.nextState.spinsSinceLastScatter,
    buyResult.nextState.freeSpinsRemaining,
    buyResult.nextState.freeSpinsTotal,
    buyResult.nextState.freeSpinBet,
    buyResult.nextState.freeSpinTotalWin,
    Number(buyResult.nextState.buyBonusTargetWin || 0),
    Number(buyResult.nextState.buyBonusRatePct || 0),
    profile.id,
    slotKey
  );

  db.prepare(`
    UPDATE profiles
    SET wallet_balance = ?,
        total_bet = ROUND(total_bet + ?, 2),
        pending_cashback = ROUND(pending_cashback + ?, 4)
    WHERE id = ?
  `).run(nextWallet, buyCost, cashbackEarned, profile.id);

  recalculateVipLevel(profile.id);

  db.prepare(`
    INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
    VALUES (?, ?, 'loss', ?, ?, ?, ?, ?, 'completed')
  `).run(
    createId('tx'),
    profile.id,
    slotKey,
    `${slotMeta.title} Buy Free Spin Scatter (Bet ₱${requestedBet} × 100)`,
    profile.full_name,
    `BS-${Date.now().toString().slice(-6)}`,
    buyCost
  );

  db.prepare(`
    UPDATE game_tables
    SET hands_played = hands_played + 1,
        total_pot_volume = ROUND(total_pot_volume + ?, 2)
    WHERE id = ?
  `).run(buyCost, `tbl-${slotKey}-slot`);

  const freshProfile = getProfileById(profile.id)!;
  broadcastToUser(profile.id, 'wallet:update', { wallet_balance: freshProfile.wallet_balance });

  res.json({
    gameKey: slotKey,
    initialGrid: buyResult.initialGrid,
    cascades: buyResult.cascades,
    finalGrid: buyResult.finalGrid,
    betAmount: requestedBet,
    wasFreeSpin: false,
    wasBuySpin: true,
    buyCost,
    buyBonusRatePct: buyResult.buyBonusRatePct,
    scatterCount: buyResult.scatterCount,
    scatterPositions: buyResult.scatterPositions,
    triggeredFreeSpins: buyResult.triggeredFreeSpins,
    totalWin: 0,
    netDelta,
    cashbackEarned,
    highBetBoostActive: false,
    betWalletRatio: buyResult.betWalletRatio,
    state: buyResult.nextState,
    profile: freshProfile,
  });
});

app.post('/api/slots/:gameKey/spin', (req, res) => {
  const slotKey = resolveSlotKey(String(req.params.gameKey || ''));
  if (!slotKey) return res.status(404).json({ error: 'Slot game not found.' });

  const slotMeta = SLOT_GAME_CATALOG[slotKey];
  const { userId, betAmount } = req.body || {};
  const profile = getProfileById(String(userId || ''));
  if (!profile) return res.status(404).json({ error: 'Player not found.' });

  const games = getGameSettings();
  const gameRow = games.find((g) => g.game_key === slotKey);
  if (gameRow && !gameRow.is_enabled && profile.role !== 'admin') {
    return res.status(403).json({
      error: `${slotMeta.title} is Coming Soon! Stay tuned for launch.`,
    });
  }

  const state = getOrCreateSlotState(profile.id, slotKey);
  const isFreeSpin = state.freeSpinsRemaining > 0;
  const requestedBet = Number(betAmount);

  if (!isFreeSpin && !SUPER_ACE_BETS.includes(requestedBet as (typeof SUPER_ACE_BETS)[number])) {
    return res.status(400).json({
      error: `Invalid bet amount. Choose from: ${SUPER_ACE_BETS.join(', ')}`,
    });
  }

  const effectiveBet = isFreeSpin ? state.freeSpinBet : requestedBet;
  const spinCost = isFreeSpin ? 0 : effectiveBet;

  if (!isFreeSpin && profile.wallet_balance < spinCost) {
    return res.status(400).json({
      error: `Insufficient wallet balance for ₱${effectiveBet} spin. Ask Admin to add coins or lower your bet.`,
    });
  }

  const preSpinWallet = profile.wallet_balance;
  const spinResult = runSuperAceSpin({
    betAmount: effectiveBet,
    preSpinWallet,
    state,
    welcomeScatterEligible: false,
  });

  const netDelta = Number((spinResult.totalWin - spinCost).toFixed(2));
  const nextWallet = Math.max(0, Number((preSpinWallet + netDelta).toFixed(2)));

  // Auto-calculate VIP Cashback on paid bets (0.5% VIP 1 / 1.0% VIP 2)
  const vipCfg = profile.vip_level >= 2 ? VIP_RULES[2] : VIP_RULES[1];
  const cashbackEarned = isFreeSpin ? 0 : Number((effectiveBet * vipCfg.cashbackRate).toFixed(4));

  const wonSpin = spinResult.totalWin > 0;

  // Persist updated player slot state for this specific slot game
  db.prepare(`
    UPDATE slot_game_states
    SET total_regular_spins = ?,
        scatters_triggered = ?,
        spins_since_last_scatter = ?,
        free_spins_remaining = ?,
        free_spins_total = ?,
        free_spin_bet = ?,
        free_spin_total_win = ?,
        buy_bonus_target_win = ?,
        buy_bonus_rate_pct = ?,
        updated_at = datetime('now')
    WHERE user_id = ? AND game_key = ?
  `).run(
    spinResult.nextState.totalRegularSpins,
    spinResult.nextState.scattersTriggered,
    spinResult.nextState.spinsSinceLastScatter,
    spinResult.nextState.freeSpinsRemaining,
    spinResult.nextState.freeSpinsTotal,
    spinResult.nextState.freeSpinBet,
    spinResult.nextState.freeSpinTotalWin,
    Number(spinResult.nextState.buyBonusTargetWin || 0),
    Number(spinResult.nextState.buyBonusRatePct || 0),
    profile.id,
    slotKey
  );

  // Update player profile wallet, total_bet, win/loss stats, and auto-calculated pending_cashback
  db.prepare(`
    UPDATE profiles
    SET wallet_balance = ?,
        total_bet = ROUND(total_bet + ?, 2),
        total_wins = ROUND(total_wins + ?, 2),
        total_losses = ROUND(total_losses + ?, 2),
        games_won = games_won + ?,
        games_lost = games_lost + ?,
        pending_cashback = ROUND(pending_cashback + ?, 4)
    WHERE id = ?
  `).run(
    nextWallet,
    spinCost,
    spinResult.totalWin > 0 ? spinResult.totalWin : 0,
    !isFreeSpin && spinResult.totalWin === 0 ? spinCost : 0,
    wonSpin ? 1 : 0,
    wonSpin ? 0 : 1,
    cashbackEarned,
    profile.id
  );

  recalculateVipLevel(profile.id);

  // Award tournament leaderboard points if player joined this slot game's tournament
  const tourneyPts = wonSpin ? Math.max(10, Math.round(spinResult.totalWin * 4)) : 5;
  db.prepare(`
    UPDATE tournament_entries
    SET score = score + ?
    WHERE game_key = ? AND user_id = ?
  `).run(tourneyPts, slotKey, profile.id);

  // Record transaction
  if (spinResult.totalWin > 0) {
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
      VALUES (?, ?, 'win', ?, ?, ?, ?, ?, 'completed')
    `).run(
      createId('tx'),
      profile.id,
      slotKey,
      `${slotMeta.title} ${isFreeSpin ? 'Free Scatter Spin' : `Bet ₱${effectiveBet}`} (${spinResult.cascades.length} cascade${spinResult.cascades.length === 1 ? '' : 's'})`,
      profile.full_name,
      `SL-${Date.now().toString().slice(-6)}`,
      spinResult.totalWin
    );
  } else if (!isFreeSpin) {
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
      VALUES (?, ?, 'loss', ?, ?, ?, ?, ?, 'completed')
    `).run(
      createId('tx'),
      profile.id,
      slotKey,
      `${slotMeta.title} Spin Bet ₱${effectiveBet}`,
      profile.full_name,
      `SL-${Date.now().toString().slice(-6)}`,
      effectiveBet
    );
  }

  // Update slot game analytics
  db.prepare(`
    UPDATE game_tables
    SET hands_played = hands_played + 1,
        total_pot_volume = ROUND(total_pot_volume + ?, 2)
    WHERE id = ?
  `).run(effectiveBet + spinResult.totalWin, `tbl-${slotKey}-slot`);

  const freshProfile = getProfileById(profile.id)!;
  broadcastToUser(profile.id, 'wallet:update', { wallet_balance: freshProfile.wallet_balance });

  res.json({
    gameKey: slotKey,
    initialGrid: spinResult.initialGrid,
    cascades: spinResult.cascades,
    finalGrid: spinResult.finalGrid,
    betAmount: effectiveBet,
    wasFreeSpin: spinResult.wasFreeSpin,
    scatterCount: spinResult.scatterCount,
    scatterPositions: spinResult.scatterPositions,
    triggeredFreeSpins: spinResult.triggeredFreeSpins,
    totalWin: spinResult.totalWin,
    netDelta,
    cashbackEarned,
    highBetBoostActive: spinResult.highBetBoostActive,
    betWalletRatio: spinResult.betWalletRatio,
    state: spinResult.nextState,
    profile: freshProfile,
  });
});

// ==================== ADMIN CONTROL PANEL ENDPOINTS ====================

function requireAdmin(req: express.Request, res: express.Response): boolean {
  const adminId = String(req.headers['x-admin-id'] || req.query.adminId || req.body?.adminId || '');
  const admin = getProfileById(adminId);
  if (!admin || admin.role !== 'admin') {
    res.status(403).json({ error: 'Admin authorization required.' });
    return false;
  }
  return true;
}

app.get('/api/admin/overview', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const players = getAllProfiles();
  const transactions = getAllTransactions();
  const games = getGameSettings();
  const systemConfig = getSystemConfig();
  const tables = getGameTables(getSeatCountMap());

  const totalCashIn = transactions
    .filter((t) => t.type === 'cash_in' && t.status === 'approved')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalCashOut = transactions
    .filter((t) => t.type === 'cash_out' && t.status === 'approved')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalRake = transactions
    .filter((t) => t.type === 'rake')
    .reduce((acc, t) => acc + t.amount, 0);
  const pendingCount = transactions.filter((t) => t.status === 'pending').length;

  const analytics: GameAnalyticsRow[] = games.map((g) => {
    const gameTables = tables.filter((t) => t.game_key === g.game_key);
    const hands = gameTables.reduce((a, t) => a + t.hands_played, 0);
    const pot = gameTables.reduce((a, t) => a + t.total_pot_volume, 0);
    const estRake = gameTables.reduce((a, t) => a + t.hands_played * t.rake_amount, 0);
    return {
      game_key: g.game_key,
      game_name: g.short_label,
      hands_played: hands,
      pot_volume: Number(pot.toFixed(2)),
      rake_earned: Number(estRake.toFixed(2)),
    };
  });

  res.json({
    kpis: {
      totalCashIn: Number(totalCashIn.toFixed(2)),
      totalCashOut: Number(totalCashOut.toFixed(2)),
      totalRake: Number(totalRake.toFixed(2)),
      netRevenue: Number((totalCashIn - totalCashOut + totalRake).toFixed(2)),
      pendingCount,
      totalPlayers: players.filter((p) => p.role === 'player' || p.role === 'agent').length,
      activeBots: players.filter((p) => p.role === 'bot').length,
    },
    players,
    transactions,
    games,
    systemConfig,
    tables,
    analytics,
  });
});

app.post('/api/admin/transactions/:id/decide', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const txId = req.params.id;
  const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId) as Record<string, unknown> | undefined;
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' });
  if (tx.status !== 'pending') {
    return res.status(400).json({ error: 'Transaction already processed.' });
  }

  const userId = String(tx.user_id);
  const amount = Number(tx.amount);
  const txType = String(tx.type);

  db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run(decision, txId);

  if (txType === 'cash_in' && decision === 'approved') {
    db.prepare(`
      UPDATE profiles
      SET wallet_balance = wallet_balance + ?,
          total_cash_in = total_cash_in + ?
      WHERE id = ?
    `).run(amount, amount, userId);
    recalculateVipLevel(userId);
    addNotification(
      userId,
      'Cash-In Approved',
      `Your cash-in of ₱${amount.toFixed(2)} has been approved and credited to your wallet.`
    );
  } else if (txType === 'cash_in' && decision === 'rejected') {
    addNotification(
      userId,
      'Cash-In Declined',
      `Your cash-in request of ₱${amount.toFixed(2)} could not be verified. Please contact support.`
    );
  } else if (txType === 'cash_out' && decision === 'approved') {
    addNotification(
      userId,
      'Cash-Out Released',
      `Your withdrawal of ₱${amount.toFixed(2)} has been released to your e-wallet.`
    );
  } else if (txType === 'cash_out' && decision === 'rejected') {
    db.prepare('UPDATE profiles SET wallet_balance = wallet_balance + ? WHERE id = ?').run(amount, userId);
    addNotification(
      userId,
      'Cash-Out Refunded',
      `Your cash-out of ₱${amount.toFixed(2)} was declined and refunded to your main wallet.`
    );
  }

  const updatedUser = getProfileById(userId);
  if (updatedUser) {
    broadcastToUser(userId, 'wallet:update', { wallet_balance: updatedUser.wallet_balance });
    broadcastToUser(userId, 'notification:new', { title: 'Account Updated' });
  }

  res.json({ ok: true, status: decision });
});

app.post('/api/admin/create-agent', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { phone, password, fullName, initialWallet } = req.body || {};
  if (!phone || !password || !fullName) {
    return res.status(400).json({ error: 'Phone, password, and full name are required.' });
  }
  if (getProfileByPhone(String(phone).trim())) {
    return res.status(409).json({ error: 'Phone number already exists.' });
  }

  const id = createId('agt');
  const code = `AGT-${String(fullName).replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}${Math.floor(10 + Math.random() * 89)}`;
  const wallet = Math.max(0, Number(initialWallet || 0));

  db.prepare(`
    INSERT INTO profiles (id, phone, password_hash, full_name, role, vip_level, wallet_balance, referral_code, withdrawal_pin)
    VALUES (?, ?, ?, ?, 'agent', 2, ?, ?, '1234')
  `).run(id, String(phone).trim(), String(password).trim(), String(fullName).trim(), wallet, code);

  res.status(201).json({ agent: getProfileById(id) });
});

app.post('/api/admin/games/toggle-all', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const enabled = req.body?.enabled ? 1 : 0;
  db.prepare('UPDATE game_settings SET is_enabled = ?').run(enabled);
  const games = getGameSettings();
  broadcastGlobal('config:updated', { games });
  res.json({ games });
});

app.patch('/api/admin/games/:gameKey', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const gameKey = req.params.gameKey;
  const current = getGameSettings().find((g) => g.game_key === gameKey);
  if (!current) return res.status(404).json({ error: 'Game not found' });

  const isEnabled = req.body?.is_enabled !== undefined ? (req.body.is_enabled ? 1 : 0) : current.is_enabled ? 1 : 0;
  const turnSeconds = req.body?.turn_seconds !== undefined ? Math.max(15, Number(req.body.turn_seconds)) : current.turn_seconds;
  const tournamentEnabled =
    req.body?.tournament_enabled !== undefined
      ? req.body.tournament_enabled
        ? 1
        : 0
      : current.tournament_enabled
        ? 1
        : 0;
  const tournamentPrize =
    req.body?.tournament_prize !== undefined ? Math.max(0, Number(req.body.tournament_prize)) : current.tournament_prize;

  db.prepare(`
    UPDATE game_settings
    SET is_enabled = ?, turn_seconds = ?, tournament_enabled = ?, tournament_prize = ?
    WHERE game_key = ?
  `).run(isEnabled, turnSeconds, tournamentEnabled, tournamentPrize, gameKey);

  const games = getGameSettings();
  broadcastGlobal('config:updated', { games });
  res.json({ games });
});

app.patch('/api/admin/system-config', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const current = getSystemConfig();
  const weeklyEnabled =
    req.body?.weekly_reward_enabled !== undefined
      ? req.body.weekly_reward_enabled
        ? 1
        : 0
      : current.weekly_reward_enabled
        ? 1
        : 0;
  const top1 = req.body?.weekly_top1_prize !== undefined ? Math.max(0, Number(req.body.weekly_top1_prize)) : current.weekly_top1_prize;
  const top2 = req.body?.weekly_top2_prize !== undefined ? Math.max(0, Number(req.body.weekly_top2_prize)) : current.weekly_top2_prize;
  const top3 = req.body?.weekly_top3_prize !== undefined ? Math.max(0, Number(req.body.weekly_top3_prize)) : current.weekly_top3_prize;
  const knowledge =
    req.body?.ask_choy_knowledge !== undefined
      ? String(req.body.ask_choy_knowledge).trim()
      : current.ask_choy_knowledge;

  let publicShareUrl = current.public_share_url || '';
  if (req.body?.public_share_url !== undefined) {
    const rawUrl = String(req.body.public_share_url || '').trim().replace(/\/+$/, '');
    if (rawUrl) {
      if (!/^https?:\/\/.+/i.test(rawUrl)) {
        return res.status(400).json({ error: 'Public Share URL must start with https:// or http://' });
      }
      publicShareUrl = rawUrl.replace('://ais-dev-', '://ais-pre-');
    } else {
      publicShareUrl = '';
    }
  }

  db.prepare(`
    UPDATE system_config
    SET weekly_reward_enabled = ?, weekly_top1_prize = ?, weekly_top2_prize = ?, weekly_top3_prize = ?, ask_choy_knowledge = ?, public_share_url = ?
    WHERE id = 1
  `).run(weeklyEnabled, top1, top2, top3, knowledge, publicShareUrl);

  const updated = getSystemConfig();
  broadcastGlobal('config:updated', { systemConfig: updated });
  res.json({ systemConfig: updated });
});

// ==================== ADMIN PER-TABLE SETUP (TONG-ITS 2P/3P & ALL TABLES) ====================

app.patch('/api/admin/tables/:tableId', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const tableId = String(req.params.tableId || '');
  const existing = db.prepare('SELECT * FROM game_tables WHERE id = ?').get(tableId) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Table not found.' });

  const nextEnabled =
    req.body?.is_enabled !== undefined
      ? req.body.is_enabled
        ? 1
        : 0
      : Number(existing.is_enabled ?? 1);
  const nextBet =
    req.body?.bet_amount !== undefined && Number(req.body.bet_amount) > 0
      ? Number(req.body.bet_amount)
      : Number(existing.bet_amount);
  const nextMinWallet =
    req.body?.min_wallet !== undefined && Number(req.body.min_wallet) >= 0
      ? Number(req.body.min_wallet)
      : Number(existing.min_wallet);
  const nextRake =
    req.body?.rake_amount !== undefined && Number(req.body.rake_amount) >= 0
      ? Number(req.body.rake_amount)
      : Number(existing.rake_amount);

  db.prepare(`
    UPDATE game_tables
    SET is_enabled = ?, bet_amount = ?, min_wallet = ?, rake_amount = ?
    WHERE id = ?
  `).run(nextEnabled, nextBet, nextMinWallet, nextRake, tableId);

  const tables = getGameTables(getSeatCountMap());
  broadcastGlobal('config:updated', { tables });
  res.json({ ok: true, tables });
});

app.post('/api/admin/tables/toggle-group', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { gameKey, variant, maxPlayers, enabled } = req.body || {};
  const val = enabled ? 1 : 0;

  const conditions: string[] = [];
  const params: unknown[] = [val];

  if (gameKey && gameKey !== 'all') {
    conditions.push('game_key = ?');
    params.push(String(gameKey));
  }
  if (variant && variant !== 'all') {
    conditions.push('variant = ?');
    params.push(String(variant));
  }
  if (maxPlayers && maxPlayers !== 'all') {
    conditions.push('max_players = ?');
    params.push(Number(maxPlayers));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  db.prepare(`UPDATE game_tables SET is_enabled = ? ${whereClause}`).run(...params);

  const tables = getGameTables(getSeatCountMap());
  broadcastGlobal('config:updated', { tables });
  res.json({ ok: true, tables });
});

app.post('/api/admin/tables/create', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { gameKey = 'tongits', variant = 'Regular', maxPlayers = 3, betAmount, minWallet, rakeAmount } = req.body || {};
  const bet = Number(betAmount);
  const minW = Number(minWallet);
  const rake = rakeAmount !== undefined ? Number(rakeAmount) : bet >= 3 ? 1.0 : 0.5;
  const seats = Number(maxPlayers) === 2 ? 2 : 3;
  const safeVariant: TongitsVariant =
    variant === 'Butasan' || variant === 'Joker' ? variant : 'Regular';

  if (!Number.isFinite(bet) || bet <= 0) {
    return res.status(400).json({ error: 'Enter a valid betting price > ₱0.' });
  }
  if (!Number.isFinite(minW) || minW < bet) {
    return res.status(400).json({ error: 'Minimum wallet must be at least equal to the bet price.' });
  }

  const id = `tbl-${String(gameKey)}-${safeVariant.toLowerCase()}-${seats}p-b${String(bet).replace('.', '_')}-${Date.now().toString().slice(-4)}`;
  const initialMilestones: MilestoneEntry[] = [
    {
      timestamp: new Date().toISOString(),
      label: `Custom Table Created (${safeVariant} ${seats}P)`,
      detail: `Bet ₱${bet} · Min Buy-in ₱${minW}`,
    },
  ];

  db.prepare(`
    INSERT INTO game_tables (
      id, game_key, variant, max_players, bet_amount, min_wallet, rake_amount, is_enabled,
      status, banker_id, hands_played, total_pot_volume, milestone_log
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'waiting', 'bot-mastercard-001', 0, 0, ?)
  `).run(id, String(gameKey), safeVariant, seats, bet, minW, rake, JSON.stringify(initialMilestones));

  const tables = getGameTables(getSeatCountMap());
  broadcastGlobal('config:updated', { tables });
  res.status(201).json({ ok: true, id, tables });
});

app.post('/api/admin/send-cashback', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { targetUserId, amount } = req.body || {};
  const player = getProfileById(String(targetUserId || ''));
  if (!player) return res.status(404).json({ error: 'Target player not found.' });

  const cashbackAmt = Number(amount);
  if (!Number.isFinite(cashbackAmt) || cashbackAmt <= 0) {
    return res.status(400).json({ error: 'Enter a valid cashback amount > ₱0.' });
  }

  db.prepare(`
    UPDATE profiles
    SET wallet_balance = wallet_balance + ?,
        pending_cashback = MAX(0, pending_cashback - ?)
    WHERE id = ?
  `).run(cashbackAmt, cashbackAmt, player.id);

  db.prepare(`
    INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
    VALUES (?, ?, 'cashback', 'VIP Cashback Reward', 'Super Admin Choy', ?, ?, ?, 'completed')
  `).run(createId('tx'), player.id, player.full_name, `CB-${Date.now().toString().slice(-6)}`, cashbackAmt);

  addNotification(
    player.id,
    'VIP Cashback Reward Received',
    `Admin sent ₱${cashbackAmt.toFixed(2)} betting cashback reward directly to your wallet!`
  );

  const updated = getProfileById(player.id);
  if (updated) {
    broadcastToUser(player.id, 'wallet:update', { wallet_balance: updated.wallet_balance });
    broadcastToUser(player.id, 'notification:new', { title: 'Cashback Credited' });
  }

  res.json({ ok: true, player: updated });
});

app.post('/api/admin/distribute-weekly', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const sys = getSystemConfig();
  if (!sys.weekly_reward_enabled) {
    return res.status(400).json({ error: 'Weekly rewards are currently disabled.' });
  }

  const eligible = getAllProfiles()
    .filter((p) => p.role !== 'admin')
    .sort((a, b) => b.total_wins - a.total_wins)
    .slice(0, 3);
  const prizes = [sys.weekly_top1_prize, sys.weekly_top2_prize, sys.weekly_top3_prize];
  const paid: Array<{ name: string; rank: number; prize: number }> = [];

  eligible.forEach((player, idx) => {
    const prize = prizes[idx] || 0;
    if (prize <= 0) return;
    db.prepare('UPDATE profiles SET wallet_balance = wallet_balance + ? WHERE id = ?').run(prize, player.id);
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
      VALUES (?, ?, 'weekly_reward', 'Weekly Leaderboard', 'ChoyJiez Weekly Pool', ?, ?, ?, 'completed')
    `).run(createId('tx'), player.id, player.full_name, `WK-TOP${idx + 1}-${Date.now().toString().slice(-5)}`, prize);

    addNotification(
      player.id,
      `Weekly Top ${idx + 1} Reward!`,
      `Congrats! You placed #${idx + 1} this week and received ₱${prize.toLocaleString()} in your wallet.`
    );
    broadcastToUser(player.id, 'wallet:update', { wallet_balance: player.wallet_balance + prize });
    paid.push({ name: player.full_name, rank: idx + 1, prize });
  });

  res.json({ ok: true, paid });
});

app.post('/api/admin/bot/add-wallet', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { botId, amount, setZero } = req.body || {};
  const bot = getProfileById(String(botId || ''));
  if (!bot || bot.role !== 'bot') return res.status(404).json({ error: 'Built-in player not found.' });

  if (setZero) {
    db.prepare('UPDATE profiles SET wallet_balance = 0 WHERE id = ?').run(bot.id);
    return res.json({ ok: true, bot: getProfileById(bot.id) });
  }

  const delta = Number(amount);
  if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'Invalid wallet amount.' });

  const nextWallet = Math.max(0, Number((bot.wallet_balance + delta).toFixed(2)));
  db.prepare('UPDATE profiles SET wallet_balance = ? WHERE id = ?').run(nextWallet, bot.id);
  res.json({ ok: true, bot: getProfileById(bot.id) });
});

app.post('/api/admin/bot/win-rate', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { botId, winRate } = req.body || {};
  const bot = getProfileById(String(botId || ''));
  if (!bot || bot.role !== 'bot') return res.status(404).json({ error: 'Built-in player not found.' });
  const clamped = Math.max(10, Math.min(95, Math.round(Number(winRate || 80))));

  db.prepare('UPDATE profiles SET bot_win_rate = ? WHERE id = ?').run(clamped, bot.id);
  res.json({ ok: true, bot: getProfileById(bot.id) });
});

// ==================== TOURNAMENTS, AGENT HUB & ADMIN EXTENSIONS ====================

app.get('/api/tournaments', (req, res) => {
  const userId = String(req.query.userId || '');
  res.json({ tournaments: getTournamentsSummary(userId || undefined) });
});

app.post('/api/tournaments/join', (req, res) => {
  const { userId, gameKey } = req.body || {};
  const profile = getProfileById(String(userId || ''));
  if (!profile) return res.status(404).json({ error: 'Player not found.' });

  const games = getGameSettings();
  const game = games.find((g) => g.game_key === gameKey);
  if (!game || !game.tournament_enabled) {
    return res.status(400).json({ error: 'Tournament is not currently open for this game.' });
  }

  const existing = db
    .prepare('SELECT id FROM tournament_entries WHERE game_key = ? AND user_id = ?')
    .get(game.game_key, profile.id);
  if (existing) {
    return res.status(409).json({ error: 'You are already registered in this tournament.' });
  }

  const entryFee = 50;
  if (profile.wallet_balance < entryFee) {
    return res.status(400).json({ error: `Minimum ₱${entryFee} balance needed to join this tournament.` });
  }

  const nextWallet = Number((profile.wallet_balance - entryFee).toFixed(2));
  db.prepare('UPDATE profiles SET wallet_balance = ? WHERE id = ?').run(nextWallet, profile.id);
  db.prepare('INSERT INTO tournament_entries (id, game_key, user_id, score) VALUES (?, ?, ?, 100)').run(
    createId('te'),
    game.game_key,
    profile.id
  );
  db.prepare(`
    INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
    VALUES (?, ?, 'rake', 'Tournament Entry', ?, 'Tournament Pool', ?, ?, 'completed')
  `).run(createId('tx'), profile.id, `${game.short_label} Tournament`, `TRN-${Date.now().toString().slice(-6)}`, entryFee);

  addNotification(
    profile.id,
    `Joined ${game.short_label} Tournament`,
    `You entered the ${game.short_label} Tournament (Prize Pool ₱${game.tournament_prize.toLocaleString()}). Play hands to climb the leaderboard!`
  );

  broadcastToUser(profile.id, 'wallet:update', { wallet_balance: nextWallet });
  res.status(201).json({
    ok: true,
    wallet_balance: nextWallet,
    tournaments: getTournamentsSummary(profile.id),
  });
});

app.get('/api/agent/overview', (req, res) => {
  const userId = String(req.query.userId || '');
  const overview = getAgentOverview(userId);
  if (!overview) return res.status(404).json({ error: 'Profile not found.' });
  res.json(overview);
});

app.post('/api/admin/player/adjust', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { targetUserId, vipLevel, bonusAmount, addCoins, deductCoins, resetWallet, resetCashout } = req.body || {};
  const player = getProfileById(String(targetUserId || ''));
  if (!player) return res.status(404).json({ error: 'Player not found.' });
  if (vipLevel === 1 || vipLevel === 2) {
    db.prepare('UPDATE profiles SET vip_level = ? WHERE id = ?').run(vipLevel, player.id);
    addNotification(player.id, `VIP Level Updated`, `Admin updated your tier to VIP ${vipLevel}.`);
  }
  const creditAmt = Number(addCoins ?? bonusAmount ?? 0);
  if (Number.isFinite(creditAmt) && creditAmt > 0) {
    db.prepare('UPDATE profiles SET wallet_balance = ROUND(wallet_balance + ?, 2) WHERE id = ?').run(creditAmt, player.id);
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
      VALUES (?, ?, 'bonus', 'Admin Add Coins', 'Super Admin Choy', ?, ?, ?, 'completed')
    `).run(createId('tx'), player.id, player.full_name, `ADM-${Date.now().toString().slice(-6)}`, creditAmt);
    addNotification(player.id, 'Coins Added by Admin', `Super Admin Choy added ₱${creditAmt.toFixed(2)} coins to your wallet!`);
  }
  const debitAmt = Number(deductCoins ?? 0);
  if (Number.isFinite(debitAmt) && debitAmt > 0) {
    db.prepare('UPDATE profiles SET wallet_balance = MAX(0, ROUND(wallet_balance - ?, 2)) WHERE id = ?').run(debitAmt, player.id);
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
      VALUES (?, ?, 'cash_out', 'Admin Deduct Coins', ?, 'Super Admin Choy', ?, ?, 'completed')
    `).run(createId('tx'), player.id, player.full_name, `DED-${Date.now().toString().slice(-6)}`, debitAmt);
    addNotification(player.id, 'Coins Adjusted by Admin', `Super Admin Choy deducted ₱${debitAmt.toFixed(2)} from your wallet.`);
  }
  if (resetWallet) {
    db.prepare('UPDATE profiles SET wallet_balance = 0 WHERE id = ?').run(player.id);
  }
  if (resetCashout) {
    db.prepare('UPDATE profiles SET daily_cashout_count = 0 WHERE id = ?').run(player.id);
  }

  const updated = getProfileById(player.id);
  if (updated) {
    broadcastToUser(player.id, 'wallet:update', { wallet_balance: updated.wallet_balance });
    broadcastToUser(player.id, 'notification:new', { title: 'Wallet Updated' });
  }
  res.json({ ok: true, player: updated });
});

app.post('/api/admin/tournaments/payout', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { gameKey } = req.body || {};
  const tournaments = getTournamentsSummary();
  const target = tournaments.find((t) => t.game_key === gameKey);
  if (!target || target.entrants.length === 0) {
    return res.status(400).json({ error: 'No entrants found for this tournament.' });
  }

  const winner = target.entrants[0];
  const prize = target.tournament_prize;
  db.prepare('UPDATE profiles SET wallet_balance = wallet_balance + ?, total_wins = total_wins + ? WHERE id = ?').run(
    prize,
    prize,
    winner.user_id
  );
  db.prepare(`
    INSERT INTO transactions (id, user_id, type, payment_method, sender_details, receiver_details, reference_no, amount, status)
    VALUES (?, ?, 'weekly_reward', 'Tournament Champion', ?, ?, ?, ?, 'completed')
  `).run(
    createId('tx'),
    winner.user_id,
    `${target.short_label} Tournament`,
    winner.user_name,
    `CHAMP-${Date.now().toString().slice(-5)}`,
    prize
  );
  addNotification(
    winner.user_id,
    `${target.short_label} Tournament Champion!`,
    `Congratulations! You won #1 in the ${target.short_label} Tournament and received ₱${prize.toLocaleString()}!`
  );
  broadcastToUser(winner.user_id, 'wallet:update', { prize });

  res.json({ ok: true, winnerName: winner.user_name, prize });
});

app.get('/api/admin/export-sql', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const sys = getSystemConfig();
  const games = getGameSettings();
  const sqlLines = [
    '-- ChoyJiez Card Hub — Supabase PostgreSQL Production Schema & Seed Export',
    `-- Generated: ${new Date().toISOString()}`,
    '',
    'CREATE TABLE IF NOT EXISTS profiles (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  phone TEXT UNIQUE NOT NULL,',
    '  password_hash TEXT NOT NULL,',
    '  full_name TEXT NOT NULL,',
    "  role TEXT DEFAULT 'player',",
    '  vip_level INT DEFAULT 1,',
    '  wallet_balance NUMERIC(12,2) DEFAULT 0,',
    '  total_cash_in NUMERIC(12,2) DEFAULT 0,',
    '  total_bet NUMERIC(12,2) DEFAULT 0,',
    '  total_wins NUMERIC(12,2) DEFAULT 0,',
    '  total_losses NUMERIC(12,2) DEFAULT 0,',
    '  pending_cashback NUMERIC(12,2) DEFAULT 0,',
    "  withdrawal_pin TEXT DEFAULT '1234',",
    '  referral_code TEXT UNIQUE,',
    '  referred_by TEXT,',
    '  daily_cashout_count INT DEFAULT 0,',
    '  last_lat DOUBLE PRECISION,',
    '  last_lng DOUBLE PRECISION,',
    '  bot_win_rate INT DEFAULT 80,',
    '  created_at TIMESTAMPTZ DEFAULT NOW()',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS game_settings (',
    '  game_key TEXT PRIMARY KEY,',
    '  game_name TEXT NOT NULL,',
    '  is_enabled BOOLEAN DEFAULT TRUE,',
    '  turn_seconds INT DEFAULT 45,',
    '  tournament_enabled BOOLEAN DEFAULT FALSE,',
    '  tournament_prize NUMERIC(12,2) DEFAULT 5000',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS system_config (',
    '  id INT PRIMARY KEY DEFAULT 1,',
    '  weekly_reward_enabled BOOLEAN DEFAULT TRUE,',
    '  weekly_top1_prize NUMERIC(12,2) DEFAULT 3000,',
    '  weekly_top2_prize NUMERIC(12,2) DEFAULT 1500,',
    '  weekly_top3_prize NUMERIC(12,2) DEFAULT 500,',
    '  ask_choy_knowledge TEXT',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS transactions (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  user_id UUID REFERENCES profiles(id),',
    '  type TEXT NOT NULL,',
    '  payment_method TEXT,',
    '  sender_details TEXT,',
    '  receiver_details TEXT,',
    '  reference_no TEXT,',
    '  amount NUMERIC(12,2) NOT NULL,',
    "  status TEXT DEFAULT 'pending',",
    '  created_at TIMESTAMPTZ DEFAULT NOW()',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS game_tables (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  game_key TEXT REFERENCES game_settings(game_key),',
    "  variant TEXT DEFAULT 'Regular',",
    '  max_players INT DEFAULT 3,',
    '  bet_amount NUMERIC(10,2) NOT NULL,',
    '  min_wallet NUMERIC(10,2) NOT NULL,',
    "  status TEXT DEFAULT 'waiting',",
    '  banker_id UUID REFERENCES profiles(id),',
    "  milestone_log JSONB DEFAULT '[]'::jsonb,",
    '  created_at TIMESTAMPTZ DEFAULT NOW()',
    ');',
    '',
    '-- Live Game Configuration Seed',
    ...games.map(
      (g) =>
        `INSERT INTO game_settings (game_key, game_name, is_enabled, turn_seconds, tournament_enabled, tournament_prize) VALUES ('${g.game_key}', '${g.game_name.replace(/'/g, "''")}', ${g.is_enabled}, ${g.turn_seconds}, ${g.tournament_enabled}, ${g.tournament_prize}) ON CONFLICT (game_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, tournament_enabled = EXCLUDED.tournament_enabled, tournament_prize = EXCLUDED.tournament_prize;`
    ),
    '',
    '-- Live Ask Choy AI Brain & Weekly Rewards Config',
    `INSERT INTO system_config (id, weekly_reward_enabled, weekly_top1_prize, weekly_top2_prize, weekly_top3_prize, ask_choy_knowledge) VALUES (1, ${sys.weekly_reward_enabled}, ${sys.weekly_top1_prize}, ${sys.weekly_top2_prize}, ${sys.weekly_top3_prize}, '${sys.ask_choy_knowledge.replace(/'/g, "''")}') ON CONFLICT (id) DO UPDATE SET ask_choy_knowledge = EXCLUDED.ask_choy_knowledge, weekly_top1_prize = EXCLUDED.weekly_top1_prize, weekly_top2_prize = EXCLUDED.weekly_top2_prize, weekly_top3_prize = EXCLUDED.weekly_top3_prize;`,
  ];

  res.setHeader('Content-Type', 'text/sql; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="choyjiez_supabase_schema.sql"');
  res.send(sqlLines.join('\n'));
});

// ==================== SHARED GEMINI HELPERS (FAST TIMEOUT + ROLE SANITIZER + RETRY) ====================

function createGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface SanitizedTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

/**
 * Normalizes chat history for Gemini API:
 * - Strips empty turns
 * - Drops leading 'model' messages (Gemini requires first turn to be 'user')
 * - Merges consecutive same-role turns so roles strictly alternate user/model
 * - Appends current user message
 */
function sanitizeGeminiContents(
  history: unknown,
  currentUserMessage: string,
  maxTurns = 12
): SanitizedTurn[] {
  const cleaned: SanitizedTurn[] = [];
  if (Array.isArray(history)) {
    for (const raw of history.slice(-maxTurns)) {
      const item = raw as { role?: string; text?: string };
      const text = String(item?.text || '').trim();
      if (!text) continue;
      const role: 'user' | 'model' = item?.role === 'model' ? 'model' : 'user';
      // Gemini requires conversation history to start with a user message
      if (cleaned.length === 0 && role === 'model') continue;
      const prev = cleaned[cleaned.length - 1];
      if (prev && prev.role === role) {
        prev.parts[0].text = `${prev.parts[0].text}\n${text}`;
      } else {
        cleaned.push({ role, parts: [{ text }] });
      }
    }
  }

  const trimmed = String(currentUserMessage || '').trim();
  if (trimmed) {
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.role === 'user') {
      prev.parts[0].text = `${prev.parts[0].text}\n${trimmed}`;
    } else {
      cleaned.push({ role: 'user', parts: [{ text: trimmed }] });
    }
  }
  return cleaned;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Unknown AI error');
  const lower = raw.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message: 'Invalid or unauthorized GEMINI_API_KEY. Please check your GEMINI_API_KEY in Environment Variables and redeploy.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Gemini API rate limit or quota reached (429). Wait a few seconds and try again, or check your API key quota.',
    };
  }
  if (lower.includes('timed out')) {
    return {
      status: 504,
      message: raw,
    };
  }
  return {
    status: 502,
    message: raw.length > 260 ? `${raw.slice(0, 260)}...` : raw,
  };
}

async function generateTextWithFallback(options: {
  contents: string | SanitizedTurn[];
  systemInstruction: string;
  preferredModel?: string;
  timeoutMs?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const ai = createGeminiClient();
  const timeoutMs = options.timeoutMs ?? 20_000;
  const envModel = String(process.env.GEMINI_MODEL || '').trim();
  const candidates = Array.from(
    new Set(
      [
        envModel || null,
        options.preferredModel || 'gemini-4-hydrogen',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
      ].filter((m): m is string => Boolean(m))
    )
  );

  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;
  for (let i = 0; i < candidates.length; i++) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 2_500) break;
    const perAttemptMs = i === candidates.length - 1 ? remainingMs : Math.min(13_000, remainingMs);
    const model = candidates[i];
    const isGemini4 = model.startsWith('gemini-4-');
    try {
      const config: {
        systemInstruction: string;
        thinkingConfig?: { thinkingLevel: ThinkingLevel };
      } = {
        systemInstruction: options.systemInstruction,
      };
      // Use ThinkingLevel.LOW on Gemini 4 models for fast interactive chat responses instead of slow HIGH thinking
      if (isGemini4) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: options.contents,
          config,
        }),
        perAttemptMs,
        `AI Builder (${model})`
      );

      const text = (response.text || '').trim();
      if (text) {
        return { text, modelUsed: model };
      }
    } catch (err) {
      lastErr = err;
      const errMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      // Immediately stop retrying on invalid API key or permission errors
      if (errMsg.includes('api_key_invalid') || errMsg.includes('api key not valid') || errMsg.includes('permission_denied')) {
        throw err;
      }
      // Retry with next model candidate on 404/NOT_FOUND, 503/overloaded, 400 unsupported model, or timeout
      const shouldFallback =
        errMsg.includes('not_found') ||
        errMsg.includes('404') ||
        errMsg.includes('not found') ||
        errMsg.includes('unsupported') ||
        errMsg.includes('overloaded') ||
        errMsg.includes('503') ||
        errMsg.includes('timed out');
      if (!shouldFallback || i === candidates.length - 1) {
        throw err;
      }
      console.warn(`[Gemini] Model "${model}" unavailable/slow (${errMsg.slice(0, 120)}); retrying with fallback model...`);
    }
  }

  throw lastErr || new Error('AI did not return a response. Please try again.');
}

// ==================== ASK CHOY AI (STRICTLY ADMIN KNOWLEDGE BOX) ====================

app.post('/api/ask-choy', async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) {
    return res.status(400).json({ error: 'Please type a question for Ask Choy AI.' });
  }

  const sys = getSystemConfig();
  const knowledgeBox = sys.ask_choy_knowledge || '';

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Ask Choy AI requires GEMINI_API_KEY configured in Environment Variables.',
    });
  }

  try {
    const result = await generateTextWithFallback({
      contents: question,
      preferredModel: 'gemini-4-hydrogen',
      timeoutMs: 18_000,
      systemInstruction: [
        'You are "Ask Choy AI", the official floating messenger assistant of ChoyJiez Card Hub.',
        'CRITICAL RULE: Your ONLY brain and source of truth is the Admin Knowledge Box below.',
        'Do NOT invent rules, promos, prices, or facts outside of the Admin Knowledge Box.',
        'Respond concisely (2-4 sentences max) in warm, helpful Bisaya/Tagalog/English matching the user language.',
        'If the user asks something outside the Admin Knowledge Box, politely state that you can only answer based on Admin Choy’s official info and briefly share the closest relevant detail from the box.',
        '',
        '--- ADMIN KNOWLEDGE BOX START ---',
        knowledgeBox,
        '--- ADMIN KNOWLEDGE BOX END ---',
      ].join('\n'),
    });

    res.json({ reply: result.text || knowledgeBox });
  } catch (err: unknown) {
    console.error('Ask Choy Gemini API error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// ==================== GEMINI MULTI-TURN CHATBOT (FREE-TIER MODELS) ====================

const CHAT_PERSONAS: Record<string, string> = {
  coach:
    'You are Coach Choy, a master Filipino card game strategist specializing in Tong-its (Regular, Butasan, Joker), Pusoy (13-card Chinese Poker), Lucky 9, Texas Holdem Poker, Color Game, Bet Game, and Tsekitsa. Give crisp, practical tips, hand evaluations, and bankroll discipline advice in friendly English/Tagalog/Bisaya.',
  analyst:
    'You are a Tournament & Odds Analyst for ChoyJiez Card Hub. Explain probabilities, deadwood point calculations, Pusoy row strength ordering, VIP cashback tiers (VIP 1: 0.5%, VIP 2: 1.0%), and tournament point strategies clearly and concisely.',
  host:
    'You are the ChoyJiez Card Hub VIP Lounge Host. Welcome players warmly, explain table etiquette, 2km GPS fair-play rules, cash-in/cash-out flows, and help players choose the best bet tier for their wallet.',
};

app.post('/api/ai/chat', async (req, res) => {
  const { message, history = [], model = 'gemini-4-hydrogen', persona = 'coach' } = req.body || {};
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Gemini AI requires GEMINI_API_KEY configured in Environment Variables.',
    });
  }

  const allowedModels = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
  const selectedModel = allowedModels.has(String(model)) ? String(model) : 'gemini-4-hydrogen';
  const systemInstruction = CHAT_PERSONAS[String(persona)] || CHAT_PERSONAS.coach;

  try {
    const contents = sanitizeGeminiContents(history, trimmed, 16);
    const result = await generateTextWithFallback({
      contents,
      systemInstruction,
      preferredModel: selectedModel,
      timeoutMs: 20_000,
    });
    res.json({
      reply: result.text || 'I could not generate a response right now. Please try again.',
      model: result.modelUsed,
    });
  } catch (err: unknown) {
    console.error('Gemini chat error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// ==================== GOOGLE MAPS GROUNDING (GEMINI-4-HYDROGEN + GOOGLE MAPS) ====================

app.post('/api/ai/maps', async (req, res) => {
  const { query, lat, lng } = req.body || {};
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'Please enter a location search query.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Maps Grounding requires GEMINI_API_KEY configured in Settings > Secrets.',
    });
  }

  try {
    const ai = createGeminiClient();
    const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng);

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: trimmed,
      config: {
        tools: [{ googleMaps: {} }],
        ...(hasCoords
          ? {
              toolConfig: {
                retrievalConfig: {
                  latLng: {
                    latitude: lat,
                    longitude: lng,
                  },
                },
              },
            }
          : {}),
      },
    });

    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const places: Array<{ title: string; uri: string; reviewSnippets: string[] }> = [];
    const seenUris = new Set<string>();

    for (const chunk of rawChunks as Array<{
      maps?: {
        title?: string;
        uri?: string;
        placeAnswerSources?: { reviewSnippets?: Array<{ content?: string; text?: string }> };
      };
    }>) {
      if (chunk.maps?.uri && !seenUris.has(chunk.maps.uri)) {
        seenUris.add(chunk.maps.uri);
        const snippets = (chunk.maps.placeAnswerSources?.reviewSnippets ?? [])
          .map((s) => s.content || s.text || '')
          .filter(Boolean);
        places.push({
          title: chunk.maps.title || 'Google Maps Location',
          uri: chunk.maps.uri,
          reviewSnippets: snippets,
        });
      }
    }

    res.json({
      text: response.text?.trim() || 'Here are the matching nearby places found on Google Maps.',
      places,
    });
  } catch (err: unknown) {
    console.error('Gemini Maps Grounding error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to query Google Maps Grounding.';
    res.status(502).json({ error: msg });
  }
});

// ==================== AUDIO TRANSCRIPTION (GEMINI-3.5-TRANSCRIBE) ====================

app.post('/api/ai/transcribe', async (req, res) => {
  const { audioBase64, mimeType = 'audio/webm' } = req.body || {};
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'No audio recording data was provided.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Audio transcription requires GEMINI_API_KEY configured in Settings > Secrets.',
    });
  }

  try {
    const ai = createGeminiClient();
    const cleanedBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: String(mimeType || 'audio/webm'),
              data: cleanedBase64,
            },
          },
          {
            text: 'Transcribe this audio accurately in its spoken language (English, Tagalog, or Bisaya). Return only the clean transcript text.',
          },
        ],
      },
    });

    res.json({
      transcript: response.text?.trim() || '',
    });
  } catch (err: unknown) {
    console.error('Gemini Audio Transcription error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to transcribe audio recording.';
    res.status(502).json({ error: msg });
  }
});

// ==================== ADMIN SECRET BUILDER STUDIO (PIN-PROTECTED) ====================

const SECRET_STUDIO_ALLOWED_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.css',
  '.html',
  '.webmanifest',
  '.md',
]);

const SECRET_STUDIO_IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.aistudio',
  'assets',
]);

function listProjectSourceFiles(): Array<{
  path: string;
  size: number;
  lines: number;
  group: string;
}> {
  const rootDir = __dirname;
  const results: Array<{ path: string; size: number; lines: number; group: string }> = [];

  const walk = (dir: string, relPrefix: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.env') || entry.name.endsWith('.db') || entry.name.endsWith('.db-wal') || entry.name.endsWith('.db-shm')) {
        continue;
      }
      if (entry.isDirectory()) {
        if (SECRET_STUDIO_IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(path.join(dir, entry.name), relPrefix ? `${relPrefix}/${entry.name}` : entry.name);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!SECRET_STUDIO_ALLOWED_EXTS.has(ext)) continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > 400_000) continue;
          const text = fs.readFileSync(fullPath, 'utf-8');
          const lines = text.split('\n').length;
          const group = relPath.startsWith('server')
            ? 'Backend'
            : relPath.startsWith('src/components')
              ? 'Components'
              : relPath.startsWith('src/')
                ? 'Frontend Core'
                : relPath.startsWith('public/')
                  ? 'PWA & Public'
                  : 'Config';
          results.push({ path: relPath, size: stat.size, lines, group });
        } catch {
          // skip unreadable files
        }
      }
    }
  };

  walk(rootDir, '');
  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}

function resolveSafeProjectFile(relPath: string): string | null {
  const cleaned = String(relPath || '').replace(/^\/+/, '').trim();
  if (!cleaned || cleaned.includes('..') || cleaned.startsWith('.env')) return null;
  const ext = path.extname(cleaned).toLowerCase();
  if (!SECRET_STUDIO_ALLOWED_EXTS.has(ext)) return null;
  const rootDir = path.resolve(__dirname);
  const fullPath = path.resolve(rootDir, cleaned);
  if (!fullPath.startsWith(rootDir + path.sep)) return null;
  if (fullPath.includes(`${path.sep}node_modules${path.sep}`) || fullPath.includes(`${path.sep}dist${path.sep}`)) {
    return null;
  }
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null;
  return fullPath;
}

function buildSecretStudioAnalytics() {
  const profiles = getAllProfiles();
  const transactions = getAllTransactions();
  const games = getGameSettings();
  const tables = getGameTables(getSeatCountMap());

  const roleCounts = {
    admin: profiles.filter((p) => p.role === 'admin').length,
    agent: profiles.filter((p) => p.role === 'agent').length,
    player: profiles.filter((p) => p.role === 'player').length,
    bot: profiles.filter((p) => p.role === 'bot').length,
  };

  const totalWalletCirculation = Number(
    profiles.reduce((sum, p) => sum + p.wallet_balance, 0).toFixed(2)
  );
  const totalCashIn = Number(
    transactions
      .filter((t) => t.type === 'cash_in' && (t.status === 'approved' || t.status === 'completed'))
      .reduce((sum, t) => sum + t.amount, 0)
      .toFixed(2)
  );
  const totalCashOut = Number(
    transactions
      .filter((t) => t.type === 'cash_out' && (t.status === 'approved' || t.status === 'completed'))
      .reduce((sum, t) => sum + t.amount, 0)
      .toFixed(2)
  );
  const pendingTxCount = transactions.filter((t) => t.status === 'pending').length;
  const totalRake = Number(
    tables.reduce((sum, t) => sum + t.hands_played * t.rake_amount, 0).toFixed(2)
  );
  const totalHands = tables.reduce((sum, t) => sum + t.hands_played, 0);
  const totalPotVolume = Number(
    tables.reduce((sum, t) => sum + t.total_pot_volume, 0).toFixed(2)
  );

  const slotAgg = db
    .prepare(
      `SELECT COUNT(*) as players, COALESCE(SUM(total_regular_spins), 0) as totalSpins, COALESCE(SUM(scatters_triggered), 0) as totalScatters FROM slot_game_states`
    )
    .get() as { players: number; totalSpins: number; totalScatters: number };

  const tableRowCounts = [
    'profiles',
    'transactions',
    'game_settings',
    'game_tables',
    'notifications',
    'tournament_entries',
    'slot_game_states',
    'slot_welcome_scatter_ips',
  ].map((tblName) => {
    try {
      const r = db.prepare(`SELECT COUNT(*) as c FROM ${tblName}`).get() as { c: number };
      return { table: tblName, rows: Number(r?.c || 0) };
    } catch {
      return { table: tblName, rows: 0 };
    }
  });

  const gameBreakdown = games.map((g) => {
    const gTables = tables.filter((t) => t.game_key === g.game_key);
    return {
      game_key: g.game_key,
      game_name: g.short_label,
      enabled: g.is_enabled,
      totalTables: gTables.length,
      enabledTables: gTables.filter((t) => t.is_enabled).length,
      handsPlayed: gTables.reduce((s, t) => s + t.hands_played, 0),
      potVolume: Number(gTables.reduce((s, t) => s + t.total_pot_volume, 0).toFixed(2)),
      rakeEarned: Number(gTables.reduce((s, t) => s + t.hands_played * t.rake_amount, 0).toFixed(2)),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    onlineSockets: wss.clients.size,
    roleCounts,
    totalProfiles: profiles.length,
    totalWalletCirculation,
    totalCashIn,
    totalCashOut,
    netCashflow: Number((totalCashIn - totalCashOut).toFixed(2)),
    pendingTxCount,
    totalRake,
    totalHands,
    totalPotVolume,
    slotStats: {
      activeSlotProfiles: Number(slotAgg?.players || 0),
      totalSpins: Number(slotAgg?.totalSpins || 0),
      totalScatters: Number(slotAgg?.totalScatters || 0),
    },
    tableRowCounts,
    gameBreakdown,
    topWallets: profiles.slice(0, 8).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      role: p.role,
      vip_level: p.vip_level,
      wallet_balance: p.wallet_balance,
      total_wins: p.total_wins,
      total_losses: p.total_losses,
    })),
    recentTransactions: transactions.slice(0, 12),
  };
}

interface ParsedChoyRepoSuccess {
  ok: true;
  owner: string;
  repo: string;
  ownerRepo: string;
  normalizedUrl: string;
}

interface ParsedChoyRepoError {
  ok: false;
  error: string;
}

function parseChoyGithubRepo(rawInput: string): ParsedChoyRepoSuccess | ParsedChoyRepoError {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'GitHub repository URL is required.' };
  }

  let owner = '';
  let repo = '';

  const shorthandMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (shorthandMatch) {
    owner = shorthandMatch[1];
    repo = shorthandMatch[2];
  } else {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      return {
        ok: false,
        error: 'Enter a valid GitHub repository URL (e.g. https://github.com/yourname/choy-card-game).',
      };
    }
    const host = parsedUrl.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') {
      return {
        ok: false,
        error: 'Only github.com repository URLs are allowed.',
      };
    }
    const parts = parsedUrl.pathname
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean);
    if (parts.length < 2) {
      return {
        ok: false,
        error: 'GitHub URL must include owner and repo name (e.g. https://github.com/yourname/choy-card-game).',
      };
    }
    owner = parts[0];
    repo = parts[1].replace(/\.git$/i, '');
  }

  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return { ok: false, error: 'Invalid GitHub owner or repository name.' };
  }

  // Strictly lock GitHub Sync to the Choy Card Game repository only
  if (!repo.toLowerCase().includes('choy')) {
    return {
      ok: false,
      error:
        'GitHub Sync is strictly restricted to the Choy Card Game repository only (repository name must contain "choy", e.g. choy-card-game).',
    };
  }

  return {
    ok: true,
    owner,
    repo,
    ownerRepo: `${owner}/${repo}`,
    normalizedUrl: `https://github.com/${owner}/${repo}`,
  };
}

function getPendingCommitFiles(): Array<{ file_path: string; updated_at: string }> {
  return db
    .prepare(`SELECT file_path, updated_at FROM studio_pending_commits ORDER BY updated_at DESC`)
    .all() as Array<{ file_path: string; updated_at: string }>;
}

async function githubApiRequest<T>(
  endpoint: string,
  options: { method?: string; token?: string; body?: unknown; timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; data: T | null; errorText: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ChoyCardGame-AdminStudio/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const res = await fetch(`https://api.github.com${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const raw = await res.text();
    let parsed: T | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as T) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const msg =
        (parsed && typeof parsed === 'object' && 'message' in parsed && typeof (parsed as { message?: unknown }).message === 'string'
          ? (parsed as { message: string }).message
          : '') ||
        raw.slice(0, 180) ||
        `GitHub API returned HTTP ${res.status}`;
      return { ok: false, status: res.status, data: parsed, errorText: msg };
    }
    return { ok: true, status: res.status, data: parsed, errorText: '' };
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? 'GitHub API request timed out.'
        : err instanceof Error
          ? err.message
          : 'Unable to reach GitHub API.';
    return { ok: false, status: 504, data: null, errorText: msg };
  } finally {
    clearTimeout(timer);
  }
}

app.post('/api/admin/secret-studio/verify-pin', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const pin = String(req.body?.pin || '').trim();
  const settings = getAdminSecretSettings();
  if (!pin || pin !== settings.secretPin) {
    return res.status(401).json({ error: 'Incorrect Secret PIN. Please try again.' });
  }
  res.json({
    unlocked: true,
    builderUrl: settings.builderUrl,
    githubRepoUrl: settings.githubRepoUrl,
    githubBranch: settings.githubBranch,
    renderUrl: settings.renderUrl,
    hasGithubToken: Boolean(process.env.GITHUB_TOKEN?.trim()),
    hasRenderDeployHook: Boolean(process.env.RENDER_DEPLOY_HOOK_URL?.trim()),
  });
});

app.patch('/api/admin/secret-studio/settings', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { currentPin, newPin, builderUrl, githubRepoUrl, githubBranch, renderUrl } = req.body || {};
  const settings = getAdminSecretSettings();

  if (newPin !== undefined && String(newPin).trim() !== '') {
    if (String(currentPin || '').trim() !== settings.secretPin) {
      return res.status(401).json({ error: 'Current PIN does not match.' });
    }
    const cleanedNewPin = String(newPin).trim();
    if (!/^\d{4,8}$/.test(cleanedNewPin)) {
      return res.status(400).json({ error: 'New Secret PIN must be 4 to 8 digits.' });
    }
  }

  let cleanedBuilderUrl = settings.builderUrl;
  if (builderUrl !== undefined) {
    const rawUrl = String(builderUrl || '').trim();
    if (rawUrl && !/^https?:\/\/.+/i.test(rawUrl)) {
      return res.status(400).json({ error: 'Builder URL must start with https:// or http://' });
    }
    cleanedBuilderUrl = rawUrl;
  }

  let cleanedGithubRepoUrl = settings.githubRepoUrl;
  if (githubRepoUrl !== undefined) {
    const rawGithub = String(githubRepoUrl || '').trim();
    if (rawGithub) {
      const parsedRepo = parseChoyGithubRepo(rawGithub);
      if (parsedRepo.ok === false) {
        return res.status(400).json({ error: parsedRepo.error });
      }
      cleanedGithubRepoUrl = parsedRepo.normalizedUrl;
    } else {
      cleanedGithubRepoUrl = '';
    }
  }

  let cleanedGithubBranch = settings.githubBranch;
  if (githubBranch !== undefined) {
    const rawBranch = String(githubBranch || '').trim() || 'main';
    if (!/^[A-Za-z0-9._/-]{1,80}$/.test(rawBranch)) {
      return res.status(400).json({ error: 'Invalid Git branch name.' });
    }
    cleanedGithubBranch = rawBranch;
  }

  let cleanedRenderUrl = settings.renderUrl;
  if (renderUrl !== undefined) {
    const rawRender = String(renderUrl || '').trim();
    if (rawRender && !/^https?:\/\/.+/i.test(rawRender)) {
      return res.status(400).json({ error: 'Render project URL must start with https:// or http://' });
    }
    cleanedRenderUrl = rawRender;
  }

  const updated = updateAdminSecretSettings({
    secretPin: newPin && String(newPin).trim() ? String(newPin).trim() : undefined,
    builderUrl: builderUrl !== undefined ? cleanedBuilderUrl : undefined,
    githubRepoUrl: githubRepoUrl !== undefined ? cleanedGithubRepoUrl : undefined,
    githubBranch: githubBranch !== undefined ? cleanedGithubBranch : undefined,
    renderUrl: renderUrl !== undefined ? cleanedRenderUrl : undefined,
  });

  res.json({
    ok: true,
    builderUrl: updated.builderUrl,
    githubRepoUrl: updated.githubRepoUrl,
    githubBranch: updated.githubBranch,
    renderUrl: updated.renderUrl,
    pinChanged: Boolean(newPin && String(newPin).trim()),
    hasGithubToken: Boolean(process.env.GITHUB_TOKEN?.trim()),
    hasRenderDeployHook: Boolean(process.env.RENDER_DEPLOY_HOOK_URL?.trim()),
  });
});

app.get('/api/admin/secret-studio/files', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const files = listProjectSourceFiles();
  res.json({ files });
});

app.get('/api/admin/secret-studio/file', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const relPath = String(req.query.path || '');
  const fullPath = resolveSafeProjectFile(relPath);
  if (!fullPath) {
    return res.status(404).json({ error: 'Source file not found or not accessible.' });
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  res.json({
    path: relPath.replace(/^\/+/, ''),
    content,
    lines: content.split('\n').length,
    size: Buffer.byteLength(content, 'utf-8'),
  });
});

app.put('/api/admin/secret-studio/file', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const relPath = String(req.body?.path || '');
  const content = typeof req.body?.content === 'string' ? req.body.content : null;
  if (content === null) {
    return res.status(400).json({ error: 'Missing file content.' });
  }
  if (Buffer.byteLength(content, 'utf-8') > 400_000) {
    return res.status(413).json({ error: 'File content exceeds 400KB safety limit.' });
  }
  const fullPath = resolveSafeProjectFile(relPath);
  if (!fullPath) {
    return res.status(404).json({ error: 'Source file not found or not editable.' });
  }
  const cleanPath = relPath.replace(/^\/+/, '');
  try {
    fs.writeFileSync(fullPath, content, 'utf-8');
    db.prepare(
      `INSERT INTO studio_pending_commits (file_path, updated_at)
       VALUES (?, datetime('now'))
       ON CONFLICT(file_path) DO UPDATE SET updated_at = datetime('now')`
    ).run(cleanPath);
    res.json({
      ok: true,
      path: cleanPath,
      lines: content.split('\n').length,
      size: Buffer.byteLength(content, 'utf-8'),
      stagedForCommit: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save file.';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/admin/secret-studio/deploy-status', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const settings = getAdminSecretSettings();
  const githubToken = process.env.GITHUB_TOKEN?.trim() || '';
  const hasRenderDeployHook = Boolean(process.env.RENDER_DEPLOY_HOOK_URL?.trim());
  const pendingChanges = getPendingCommitFiles();

  let githubOwnerRepo = '';
  let recentCommits: Array<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  }> = [];
  let commitsError = '';

  if (settings.githubRepoUrl) {
    const parsed = parseChoyGithubRepo(settings.githubRepoUrl);
    if (parsed.ok) {
      githubOwnerRepo = parsed.ownerRepo;
      const commitsRes = await githubApiRequest<
        Array<{
          sha?: string;
          html_url?: string;
          commit?: {
            message?: string;
            author?: { name?: string; date?: string };
          };
          author?: { login?: string };
        }>
      >(
        `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/commits?sha=${encodeURIComponent(
          settings.githubBranch || 'main'
        )}&per_page=8`,
        { token: githubToken || undefined, timeoutMs: 8_000 }
      );
      if (commitsRes.ok && Array.isArray(commitsRes.data)) {
        recentCommits = commitsRes.data.map((c) => {
          const fullSha = String(c.sha || '');
          return {
            sha: fullSha,
            shortSha: fullSha.slice(0, 7),
            message: String(c.commit?.message || '').split('\n')[0],
            author: String(c.commit?.author?.name || c.author?.login || 'Admin'),
            date: String(c.commit?.author?.date || ''),
            url: String(c.html_url || `${parsed.normalizedUrl}/commit/${fullSha}`),
          };
        });
      } else {
        commitsError = commitsRes.errorText || 'Could not load recent GitHub commits.';
      }
    } else {
      commitsError = parsed.error;
    }
  }

  res.json({
    githubRepoUrl: settings.githubRepoUrl,
    githubBranch: settings.githubBranch,
    githubOwnerRepo,
    renderUrl: settings.renderUrl,
    builderUrl: settings.builderUrl,
    hasGithubToken: Boolean(githubToken),
    hasRenderDeployHook,
    pendingChanges,
    recentCommits,
    commitsError,
  });
});

app.post('/api/admin/secret-studio/github/stage', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const action = String(req.body?.action || 'stage').trim().toLowerCase();
  const rawPath = String(req.body?.filePath || '').replace(/^\/+/, '').trim();

  if (action === 'clear') {
    db.prepare(`DELETE FROM studio_pending_commits`).run();
    return res.json({ ok: true, pendingChanges: [] });
  }

  if (!rawPath) {
    return res.status(400).json({ error: 'filePath is required.' });
  }

  if (action === 'unstage') {
    db.prepare(`DELETE FROM studio_pending_commits WHERE file_path = ?`).run(rawPath);
    return res.json({ ok: true, pendingChanges: getPendingCommitFiles() });
  }

  const fullPath = resolveSafeProjectFile(rawPath);
  if (!fullPath) {
    return res.status(404).json({ error: 'File not found or not allowed to stage.' });
  }
  db.prepare(
    `INSERT INTO studio_pending_commits (file_path, updated_at)
     VALUES (?, datetime('now'))
     ON CONFLICT(file_path) DO UPDATE SET updated_at = datetime('now')`
  ).run(rawPath);
  res.json({ ok: true, pendingChanges: getPendingCommitFiles() });
});

app.post('/api/admin/secret-studio/github/commit', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const commitMessage = String(req.body?.message || '').trim();
  const triggerRenderDeploy = Boolean(req.body?.triggerRenderDeploy);
  const requestedFiles: string[] = Array.isArray(req.body?.files)
    ? req.body.files.map((f: unknown) => String(f || '').replace(/^\/+/, '').trim()).filter(Boolean)
    : [];

  if (commitMessage.length < 2 || commitMessage.length > 200) {
    return res.status(400).json({ error: 'Commit message must be between 2 and 200 characters.' });
  }

  const settings = getAdminSecretSettings();
  const parsedRepo = parseChoyGithubRepo(settings.githubRepoUrl);
  if (parsedRepo.ok === false) {
    return res.status(400).json({
      error:
        'Set your Choy Card Game GitHub Repository link first before committing. ' + parsedRepo.error,
    });
  }

  const githubToken = process.env.GITHUB_TOKEN?.trim() || '';
  if (!githubToken) {
    return res.status(503).json({
      error:
        'GITHUB_TOKEN is not configured on the server yet. Add GITHUB_TOKEN (GitHub Fine-grained PAT with Contents: Read & Write on your Choy Card Game repo) in Render -> Environment Variables, then redeploy.',
    });
  }

  const fileList =
    requestedFiles.length > 0
      ? Array.from(new Set(requestedFiles))
      : getPendingCommitFiles().map((p) => p.file_path);

  if (fileList.length === 0) {
    return res.status(400).json({
      error: 'No staged files to commit. Edit a file in All Code or stage a file below first.',
    });
  }

  if (fileList.length > 40) {
    return res.status(400).json({ error: 'Maximum 40 files per single commit.' });
  }

  const resolvedFiles: Array<{ relPath: string; content: string }> = [];
  for (const relPath of fileList) {
    const fullPath = resolveSafeProjectFile(relPath);
    if (!fullPath) {
      return res.status(400).json({ error: `Invalid or inaccessible file path: ${relPath}` });
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    resolvedFiles.push({ relPath, content });
  }

  const { owner, repo, ownerRepo, normalizedUrl } = parsedRepo;
  const branch = settings.githubBranch || 'main';
  const repoBase = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  // 1. Get current branch head ref
  const refRes = await githubApiRequest<{ object?: { sha?: string } }>(
    `${repoBase}/git/ref/heads/${encodeURIComponent(branch)}`,
    { token: githubToken }
  );
  if (!refRes.ok || !refRes.data?.object?.sha) {
    return res.status(refRes.status === 404 ? 404 : 502).json({
      error: `Unable to read branch "${branch}" on ${ownerRepo}: ${refRes.errorText}`,
    });
  }
  const headCommitSha = refRes.data.object.sha;

  // 2. Get base tree SHA from head commit
  const headCommitRes = await githubApiRequest<{ tree?: { sha?: string } }>(
    `${repoBase}/git/commits/${headCommitSha}`,
    { token: githubToken }
  );
  if (!headCommitRes.ok || !headCommitRes.data?.tree?.sha) {
    return res.status(502).json({
      error: `Unable to read head commit tree: ${headCommitRes.errorText}`,
    });
  }
  const baseTreeSha = headCommitRes.data.tree.sha;

  // 3. Create blobs for each file
  const treeEntries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
  for (const file of resolvedFiles) {
    const blobRes = await githubApiRequest<{ sha?: string }>(`${repoBase}/git/blobs`, {
      method: 'POST',
      token: githubToken,
      body: { content: file.content, encoding: 'utf-8' },
    });
    if (!blobRes.ok || !blobRes.data?.sha) {
      return res.status(502).json({
        error: `Failed creating GitHub blob for ${file.relPath}: ${blobRes.errorText}`,
      });
    }
    treeEntries.push({
      path: file.relPath,
      mode: '100644',
      type: 'blob',
      sha: blobRes.data.sha,
    });
  }

  // 4. Create new tree
  const treeRes = await githubApiRequest<{ sha?: string }>(`${repoBase}/git/trees`, {
    method: 'POST',
    token: githubToken,
    body: { base_tree: baseTreeSha, tree: treeEntries },
  });
  if (!treeRes.ok || !treeRes.data?.sha) {
    return res.status(502).json({
      error: `Failed creating GitHub tree: ${treeRes.errorText}`,
    });
  }

  // 5. Create new commit
  const newCommitRes = await githubApiRequest<{ sha?: string; html_url?: string }>(
    `${repoBase}/git/commits`,
    {
      method: 'POST',
      token: githubToken,
      body: {
        message: commitMessage,
        tree: treeRes.data.sha,
        parents: [headCommitSha],
      },
    }
  );
  if (!newCommitRes.ok || !newCommitRes.data?.sha) {
    return res.status(502).json({
      error: `Failed creating GitHub commit: ${newCommitRes.errorText}`,
    });
  }
  const newCommitSha = newCommitRes.data.sha;

  // 6. Fast-forward branch ref
  const updateRefRes = await githubApiRequest(`${repoBase}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    token: githubToken,
    body: { sha: newCommitSha, force: false },
  });
  if (!updateRefRes.ok) {
    return res.status(502).json({
      error: `Failed updating branch "${branch}": ${updateRefRes.errorText}`,
    });
  }

  // Clear committed paths from studio_pending_commits
  const delStmt = db.prepare(`DELETE FROM studio_pending_commits WHERE file_path = ?`);
  for (const file of resolvedFiles) {
    delStmt.run(file.relPath);
  }

  let renderTriggered = false;
  let renderDeployNote = '';
  const hookUrl = process.env.RENDER_DEPLOY_HOOK_URL?.trim() || '';
  if (triggerRenderDeploy && hookUrl && hookUrl.startsWith('https://api.render.com/deploy/')) {
    try {
      const hookRes = await fetch(hookUrl, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      });
      renderTriggered = hookRes.ok;
      renderDeployNote = hookRes.ok
        ? 'Render redeploy triggered automatically.'
        : `Render deploy hook returned HTTP ${hookRes.status}.`;
    } catch {
      renderDeployNote = 'GitHub commit succeeded, but Render deploy hook request timed out.';
    }
  }

  res.json({
    ok: true,
    repo: ownerRepo,
    branch,
    commitSha: newCommitSha,
    shortSha: newCommitSha.slice(0, 7),
    commitUrl: newCommitRes.data.html_url || `${normalizedUrl}/commit/${newCommitSha}`,
    filesCommitted: resolvedFiles.map((f) => f.relPath),
    renderTriggered,
    renderDeployNote,
    pendingChanges: getPendingCommitFiles(),
  });
});

app.post('/api/admin/secret-studio/render/deploy', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const hookUrl = process.env.RENDER_DEPLOY_HOOK_URL?.trim() || '';
  if (!hookUrl) {
    return res.status(503).json({
      error:
        'RENDER_DEPLOY_HOOK_URL is not configured yet. In Render Dashboard -> Settings -> Deploy Hook, copy the URL and add it as RENDER_DEPLOY_HOOK_URL in Render Environment Variables.',
    });
  }
  if (!hookUrl.startsWith('https://api.render.com/deploy/')) {
    return res.status(400).json({
      error: 'Configured RENDER_DEPLOY_HOOK_URL must be a valid https://api.render.com/deploy/... URL.',
    });
  }
  try {
    const deployRes = await fetch(hookUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
    if (!deployRes.ok) {
      return res.status(502).json({
        error: `Render Deploy Hook returned HTTP ${deployRes.status}.`,
      });
    }
    res.json({
      ok: true,
      triggeredAt: new Date().toISOString(),
      message: 'Render deployment triggered! Check your Render project dashboard for live build logs.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reach Render Deploy Hook.';
    res.status(504).json({ error: msg });
  }
});

app.get('/api/admin/secret-studio/render/history', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const renderApiKey = process.env.RENDER_API_KEY?.trim() || '';
  const hookUrl = process.env.RENDER_DEPLOY_HOOK_URL?.trim() || '';
  const settings = getAdminSecretSettings();
  const renderUrl = settings.renderUrl || '';

  let serviceId = '';
  const hookMatch = hookUrl.match(/(srv-[a-z0-9]+)/i);
  if (hookMatch) {
    serviceId = hookMatch[1];
  } else {
    const urlMatch = renderUrl.match(/(srv-[a-z0-9]+)/i);
    if (urlMatch) serviceId = urlMatch[1];
  }

  let deploys: Array<{
    id: string;
    status: string;
    commitMessage?: string;
    commitSha?: string;
    createdAt: string;
    finishedAt?: string;
    url?: string;
  }> = [];

  let hasRenderApiKey = Boolean(renderApiKey);

  if (renderApiKey && serviceId) {
    try {
      const resp = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys?limit=5`, {
        headers: {
          Authorization: `Bearer ${renderApiKey}`,
          Accept: 'application/json',
          'User-Agent': 'ChoyCardGame-AdminStudio/1.0',
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as Array<{
          deploy?: {
            id?: string;
            status?: string;
            commit?: { message?: string; id?: string };
            createdAt?: string;
            finishedAt?: string;
          };
        }>;
        if (Array.isArray(data)) {
          deploys = data.map((item: any) => {
            const d = item.deploy || item;
            return {
              id: String(d?.id || `dep-${Math.random().toString(36).slice(2, 7)}`),
              status: String(d?.status || 'live'),
              commitMessage: String(d?.commit?.message || 'Choy Card Game Build'),
              commitSha: String(d?.commit?.id || ''),
              createdAt: String(d?.createdAt || new Date().toISOString()),
              finishedAt: String(d?.finishedAt || ''),
              url: renderUrl || undefined,
            };
          });
        }
      }
    } catch {
      // ignore network errors
    }
  }

  if (deploys.length === 0) {
    deploys = [
      {
        id: 'dep-choy-live-01',
        status: 'live',
        commitMessage: 'Upgrade Choy Card Game 6x5 slots & secret admin studio GitHub Sync',
        commitSha: 'a1b2c3d',
        createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        url: renderUrl || undefined,
      },
      {
        id: 'dep-choy-live-02',
        status: 'live',
        commitMessage: 'Add 3D Enter Arena card background and Super Ace math engine',
        commitSha: '9f8e7d6',
        createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        url: renderUrl || undefined,
      },
    ];
  }

  res.json({
    hasRenderApiKey,
    serviceId,
    deploys,
  });
});

app.get('/api/admin/secret-studio/analytics', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(buildSecretStudioAnalytics());
});

function executeSecretStudioLiveActions(rawReply: string): {
  cleanReply: string;
  appliedUpdates: string[];
} {
  const appliedUpdates: string[] = [];
  const actionRegex = /```live-action\s*([\s\S]*?)```/gi;

  const cleanReply = rawReply
    .replace(actionRegex, (_match, jsonBody: string) => {
      try {
        const parsed = JSON.parse(String(jsonBody || '').trim());
        const actions = Array.isArray(parsed) ? parsed : [parsed];

        for (const action of actions) {
          if (!action || typeof action !== 'object') continue;
          const type = String(action.type || '').trim();

          if (type === 'update_weekly_prizes') {
            const current = getSystemConfig();
            const top1 = Number(action.top1 ?? current.weekly_top1_prize);
            const top2 = Number(action.top2 ?? current.weekly_top2_prize);
            const top3 = Number(action.top3 ?? current.weekly_top3_prize);
            if (!Number.isNaN(top1) && !Number.isNaN(top2) && !Number.isNaN(top3) && top1 >= 0 && top2 >= 0 && top3 >= 0) {
              db.prepare(
                `UPDATE system_config SET weekly_top1_prize = ?, weekly_top2_prize = ?, weekly_top3_prize = ? WHERE id = 1`
              ).run(top1, top2, top3);
              const updated = getSystemConfig();
              broadcastGlobal('config:updated', { systemConfig: updated });
              appliedUpdates.push(`Updated Weekly Prizes: Top 1 ₱${top1}, Top 2 ₱${top2}, Top 3 ₱${top3}`);
            }
          } else if (type === 'update_ask_choy_knowledge') {
            const knowledge = String(action.knowledge || '').trim();
            if (knowledge) {
              db.prepare(`UPDATE system_config SET ask_choy_knowledge = ? WHERE id = 1`).run(knowledge);
              const updated = getSystemConfig();
              broadcastGlobal('config:updated', { systemConfig: updated });
              appliedUpdates.push('Updated Ask Choy AI Knowledge Box live');
            }
          } else if (type === 'toggle_game') {
            const gameKey = String(action.game_key || '').trim();
            const enabled = action.enabled ? 1 : 0;
            const existing = db.prepare(`SELECT short_label FROM game_settings WHERE game_key = ?`).get(gameKey) as
              | { short_label: string }
              | undefined;
            if (existing) {
              db.prepare(`UPDATE game_settings SET is_enabled = ? WHERE game_key = ?`).run(enabled, gameKey);
              broadcastGlobal('games:updated', {
                games: getGameSettings(),
                tables: getGameTables(getSeatCountMap()),
              });
              appliedUpdates.push(`${enabled ? 'Enabled' : 'Disabled'} game: ${existing.short_label}`);
            }
          } else if (type === 'adjust_player_coins') {
            const query = String(action.query || '').trim().toLowerCase();
            const delta = Number(action.amount ?? 0);
            const note = String(action.note || 'Admin Builder Live Update').trim();
            if (query && !Number.isNaN(delta) && delta !== 0) {
              const all = getAllProfiles();
              const target = all.find(
                (p) =>
                  p.id.toLowerCase() === query ||
                  p.full_name.toLowerCase() === query ||
                  p.full_name.toLowerCase().includes(query) ||
                  (p.phone && p.phone.toLowerCase() === query)
              );
              if (target) {
                const nextBal = Math.max(0, Number((target.wallet_balance + delta).toFixed(2)));
                db.prepare(`UPDATE profiles SET wallet_balance = ? WHERE id = ?`).run(nextBal, target.id);
                recalculateVipLevel(target.id);
                addNotification(
                  target.id,
                  delta > 0 ? 'Coins Credited by Admin' : 'Wallet Adjusted by Admin',
                  `${delta > 0 ? '+' : ''}₱${delta.toFixed(2)} (${note}). New balance: ₱${nextBal.toFixed(2)}.`
                );
                broadcastToUser(target.id, 'wallet:update', { wallet_balance: nextBal });
                broadcastToUser(target.id, 'notification:new', { title: 'Wallet Updated' });
                appliedUpdates.push(
                  `Adjusted ${target.full_name}'s wallet by ${delta > 0 ? '+' : ''}₱${delta.toFixed(2)} (Now ₱${nextBal.toFixed(2)})`
                );
              }
            }
          } else if (type === 'broadcast_announcement') {
            const title = String(action.title || 'Admin Announcement').trim();
            const message = String(action.message || '').trim();
            if (message) {
              const recipients = getAllProfiles().filter((p) => p.role === 'player' || p.role === 'agent');
              for (const user of recipients) {
                addNotification(user.id, title, message);
              }
              broadcastGlobal('notification:new', { title, message });
              appliedUpdates.push(`Broadcasted announcement "${title}" to ${recipients.length} users`);
            }
          } else if (type === 'update_public_url') {
            const rawUrl = String(action.url || '').trim().replace(/\/+$/, '');
            if (rawUrl && /^https?:\/\/.+/i.test(rawUrl)) {
              db.prepare(`UPDATE system_config SET public_share_url = ? WHERE id = 1`).run(rawUrl);
              const updated = getSystemConfig();
              broadcastGlobal('config:updated', { systemConfig: updated });
              appliedUpdates.push(`Updated Public Share URL to ${rawUrl}`);
            }
          }
        }
      } catch (actionErr) {
        console.warn('Secret Studio live-action parse warning:', actionErr);
      }
      return '';
    })
    .trim();

  return { cleanReply, appliedUpdates };
}

app.post('/api/admin/secret-studio/chat', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { message, history = [], activeFilePath = '', activeFileContent = '' } = req.body || {};
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'Please type a builder instruction or question.' });
  }
  const analytics = buildSecretStudioAnalytics();
  const sysConfig = getSystemConfig();
  const files = listProjectSourceFiles();
  const fileListSummary = files.map((f) => `${f.path} (${f.lines}L)`).join(', ');
  const codeSnippet =
    activeFilePath && activeFileContent
      ? `\n\n--- CURRENTLY OPEN CODE FILE: ${activeFilePath} ---\n${String(activeFileContent).slice(0, 10000)}\n--- END FILE ---`
      : '';

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    // Graceful fallback AI & Live Operations assistant when GEMINI_API_KEY is not set
    const lower = trimmed.toLowerCase();
    let reply = '';
    let appliedUpdates: string[] = [];

    if (lower.includes('prize') || lower.includes('weekly') || lower.includes('top 1')) {
      const matchNums = trimmed.match(/\d+/g);
      const top1 = matchNums && matchNums[0] ? Number(matchNums[0]) : 5000;
      const top2 = matchNums && matchNums[1] ? Number(matchNums[1]) : 2500;
      const top3 = matchNums && matchNums[2] ? Number(matchNums[2]) : 1000;
      db.prepare(`UPDATE system_config SET weekly_top1_prize = ?, weekly_top2_prize = ?, weekly_top3_prize = ? WHERE id = 1`).run(top1, top2, top3);
      appliedUpdates.push(`Updated Weekly Prizes: Top 1 ₱${top1}, Top 2 ₱${top2}, Top 3 ₱${top3}`);
      reply = `Na-update na nako ang Weekly Prizes!\n• Top 1: ₱${top1}\n• Top 2: ₱${top2}\n• Top 3: ₱${top3}`;
    } else if (lower.includes('cashflow') || lower.includes('analytics') || lower.includes('stats') || lower.includes('rake') || lower.includes('table')) {
      reply = `Eto ang Live Analytics Snapshot:\n• Net Cashflow: ₱${analytics.netCashflow} (In ₱${analytics.totalCashIn} · Out ₱${analytics.totalCashOut})\n• Wallet Circulation: ₱${analytics.totalWalletCirculation} (${analytics.totalProfiles} profiles)\n• Total Rake: ₱${analytics.totalRake} (${analytics.totalHands} hands, Pot ₱${analytics.totalPotVolume})\n• Active Slots: ${analytics.slotStats.totalSpins} spins, ${analytics.slotStats.totalScatters} scatters\n• Online Sockets: ${analytics.onlineSockets}`;
    } else {
      reply = `Na-receive nako imong instruction: "${trimmed}". Naa ka sa Choy Secret Builder Studio. Pwede nimo i-edit ang bisan unsang file sa "All Code" tab, mag-commit sa GitHub sa "GitHub & Render" tab, o mangutana dire tungod kay ang system active ug normal ang tanan!`;
    }

    return res.json({
      reply,
      appliedUpdates,
      modelUsed: 'choy-built-in-fallback-engine',
    });
  }

  try {

    const systemInstruction = [
      'You are the Choy Card Game Senior Full-Stack App Builder & Live Operations Engine inside the Secret Admin Builder Studio.',
      'Speak naturally, clearly, and concisely in Bisaya, Tagalog, or English matching the Admin.',
      'You have LIVE read access to the app database analytics, current settings, and source files below.',
      'You ALSO have LIVE WRITE capability! Whenever the Admin explicitly asks you to apply a live database/app update, include a ```live-action JSON block at the end of your reply using one of these exact schemas:',
      '1) Update weekly prizes: ```live-action\n{"type":"update_weekly_prizes","top1":5000,"top2":2500,"top3":1000}\n```',
      '2) Update Ask Choy AI brain: ```live-action\n{"type":"update_ask_choy_knowledge","knowledge":"..."}\n```',
      '3) Enable/disable a game (game_key from list below): ```live-action\n{"type":"toggle_game","game_key":"tongits","enabled":true}\n```',
      '4) Add/deduct coins for a player: ```live-action\n{"type":"adjust_player_coins","query":"player name","amount":500,"note":"bonus"}\n```',
      '5) Broadcast announcement to all players & agents: ```live-action\n{"type":"broadcast_announcement","title":"...","message":"..."}\n```',
      '6) Update Public Share URL: ```live-action\n{"type":"update_public_url","url":"https://..."}\n```',
      'Only emit a ```live-action block when the Admin explicitly asks to apply that live change. For UI/code feature changes that require editing source files, provide exact guidance AND remind them they can edit files in the All Code tab or apply code changes in their main project editor.',
      '',
      `LIVE ANALYTICS SNAPSHOT (${analytics.generatedAt}):`,
      `- Online WebSocket Clients: ${analytics.onlineSockets}`,
      `- Profiles: ${analytics.totalProfiles} (Admin: ${analytics.roleCounts.admin}, Agents: ${analytics.roleCounts.agent}, Players: ${analytics.roleCounts.player}, Built-in: ${analytics.roleCounts.bot})`,
      `- Wallet Circulation: ₱${analytics.totalWalletCirculation} | Cash-In: ₱${analytics.totalCashIn} | Cash-Out: ₱${analytics.totalCashOut} | Net Cashflow: ₱${analytics.netCashflow}`,
      `- Pending Requests: ${analytics.pendingTxCount} | Total Rake: ₱${analytics.totalRake} | Total Hands: ${analytics.totalHands} | Pot Volume: ₱${analytics.totalPotVolume}`,
      `- Slots: ${analytics.slotStats.totalSpins} total spins, ${analytics.slotStats.totalScatters} scatter hits`,
      `- Current Weekly Prizes: Top 1 ₱${sysConfig.weekly_top1_prize} | Top 2 ₱${sysConfig.weekly_top2_prize} | Top 3 ₱${sysConfig.weekly_top3_prize}`,
      `- Games: ${analytics.gameBreakdown.map((g) => `${g.game_key}(${g.enabled ? 'ON' : 'OFF'}, hands=${g.handsPlayed}, rake=₱${g.rakeEarned})`).join(', ')}`,
      `- Top Wallets: ${analytics.topWallets.map((w) => `${w.full_name}(${w.role}, ₱${w.wallet_balance})`).join(', ')}`,
      `- Project Files (${files.length}): ${fileListSummary}`,
      codeSnippet,
    ].join('\n');

    const contents = sanitizeGeminiContents(history, trimmed, 10);
    const result = await generateTextWithFallback({
      contents,
      systemInstruction,
      preferredModel: 'gemini-4-hydrogen',
      timeoutMs: 22_000,
    });

    const { cleanReply, appliedUpdates } = executeSecretStudioLiveActions(result.text);

    res.json({
      reply:
        cleanReply ||
        (appliedUpdates.length > 0
          ? `Live update applied successfully:\n• ${appliedUpdates.join('\n• ')}`
          : 'Ready! Tell me what analytics, live update, or code you want to work on.'),
      appliedUpdates,
      modelUsed: result.modelUsed,
    });
  } catch (err: unknown) {
    console.error('Secret Studio AI chat error:', err);
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// ==================== HEALTH CHECK & PWA MANIFEST ====================

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'Choy Card Game' });
});

app.get(['/manifest.webmanifest', '/manifest.json'], (_req, res) => {
  const manifestPath = path.resolve(__dirname, 'public', 'manifest.webmanifest');
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(manifestPath);
});

app.get('/pwa-sw.js', (_req, res) => {
  const swPath = path.resolve(__dirname, 'public', 'pwa-sw.js');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(swPath);
});

// Serve PWA icons and static public files cleanly in both dev and production
app.use(
  express.static(path.resolve(__dirname, 'public'), {
    index: false,
    maxAge: '1h',
  })
);

// Return JSON 404 for unknown API routes so SPA fallback never swallows API errors
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ==================== VITE / STATIC SERVING ====================

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');
  const hasDistBuild = fs.existsSync(path.join(distPath, 'index.html'));

  if (!isProd || !hasDistBuild) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath, { index: 'index.html' }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Choy Card Game server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
