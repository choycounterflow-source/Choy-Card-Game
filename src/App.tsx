import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, RotateCcw, Share2, Shield, Volume2, VolumeX } from 'lucide-react';
import { setAudioMuted } from './lib/audio';
import {
  BET_TIERS,
  type ActiveTableSession,
  type BetTier,
  type GameSetting,
  type GameTableSummary,
  type NotificationItem,
  type SlotGameKey,
  type SystemConfig,
  type TableChatMessage,
  type TongitsVariant,
  type Transaction,
  type UserProfile,
} from './types';
import { LoginView } from './components/LoginView';
import {
  PlayerDashboard,
  type VipDirectoryItem,
  type WeeklyLeaderItem,
} from './components/PlayerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { GameTableView } from './components/GameTableView';
import { AskChoyBubble } from './components/AskChoyBubble';
import { CashInModal, CashOutModal, TableBuyInModal } from './components/WalletModals';
import { InfoModal, type FooterModalType } from './components/InfoModals';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { AIHubSuite } from './components/AIHubSuite';
import { ThreeDiceArena } from './components/ThreeDiceArena';
import { SuperAceSlotView } from './components/SuperAceSlotView';
import { ShareAppModal } from './components/ShareAppModal';
import { FALLBACK_SHARED_APP_URL, normalizeToPublicShareUrl } from './lib/shareUrl';
import { exitGameFullscreen, requestGameFullscreenLandscape } from './lib/fullscreen';
import { clearAppCacheAndReload } from './lib/cache';
import choyAppIconImg from './assets/images/choyjiez_app_icon_1795076018851.jpg';

type ActiveView = 'login' | 'player' | 'admin' | 'table' | 'ai_studio' | 'arena3d' | 'superace';

export default function App() {
  const [view, setView] = useState<ActiveView>('login');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeSlotKey, setActiveSlotKey] = useState<SlotGameKey>('superace');

  // Global Sound Effects setting persisted in localStorage
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('choy_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [soundToast, setSoundToast] = useState<string | null>(null);

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      setSoundToast(next ? 'Sound Effects Enabled 🔊' : 'Sound Effects Muted 🔇');
      setTimeout(() => setSoundToast(null), 2200);
      return next;
    });
  };

  useEffect(() => {
    setAudioMuted(!soundEnabled);
    localStorage.setItem('choy_sound_enabled', String(soundEnabled));
  }, [soundEnabled]);

  // Dashboard state
  const [games, setGames] = useState<GameSetting[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    id: 1,
    weekly_reward_enabled: true,
    weekly_top1_prize: 3000,
    weekly_top2_prize: 1500,
    weekly_top3_prize: 500,
    ask_choy_knowledge: '',
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [tables, setTables] = useState<GameTableSummary[]>([]);
  const [weeklyTop3, setWeeklyTop3] = useState<WeeklyLeaderItem[]>([]);
  const [vipDirectory, setVipDirectory] = useState<VipDirectoryItem[]>([]);

  // Active table & real-time WebSocket chat
  const [activeSession, setActiveSession] = useState<ActiveTableSession | null>(null);
  const [tableMessages, setTableMessages] = useState<TableChatMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Modals
  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [selectedGameToJoin, setSelectedGameToJoin] = useState<GameSetting | null>(null);
  const [footerModal, setFooterModal] = useState<FooterModalType>(null);

  // Public Share URL state & live reachability check
  const [shareOrigin, setShareOrigin] = useState<string>(() =>
    normalizeToPublicShareUrl(typeof window !== 'undefined' ? window.location.origin : FALLBACK_SHARED_APP_URL)
  );
  const [defaultShareOrigin, setDefaultShareOrigin] = useState<string>(FALLBACK_SHARED_APP_URL);
  const [customShareOrigin, setCustomShareOrigin] = useState<string>('');
  const [isPublicLive, setIsPublicLive] = useState<boolean>(false);
  const [shareHttpStatus, setShareHttpStatus] = useState<number>(0);

  const refreshShareConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/share-config');
      if (!res.ok) return;
      const data = await res.json();
      if (data.shareUrl) setShareOrigin(normalizeToPublicShareUrl(data.shareUrl));
      if (data.defaultShareUrl) setDefaultShareOrigin(normalizeToPublicShareUrl(data.defaultShareUrl));
      setCustomShareOrigin(String(data.customShareUrl || ''));
      setIsPublicLive(Boolean(data.isPublicLive));
      setShareHttpStatus(Number(data.httpStatus || 0));
    } catch {
      // ignore offline
    }
  }, []);

  useEffect(() => {
    refreshShareConfig();
  }, [systemConfig.public_share_url, refreshShareConfig]);

  // GPS 2km anti-collusion coordinates
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('2km GPS Checking');

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('2km GPS Active (Fallback)');
      setGpsCoords({ lat: 9.5992, lng: 125.6947 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(coords);
        setGpsStatus('2km GPS Lock Active');
      },
      () => {
        setGpsCoords({ lat: 9.5992, lng: 125.6947 });
        setGpsStatus('2km GPS Ready');
      },
      { enableHighAccuracy: false, timeout: 6000 }
    );
  }, []);

  const loadPlayerDashboard = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/player/dashboard?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setUser(data.profile);
      setGames(data.games || []);
      setSystemConfig(data.systemConfig);
      setTransactions(data.transactions || []);
      setNotifications(data.notifications || []);
      setTables(data.tables || []);
      setWeeklyTop3(data.weeklyTop3 || []);
      setVipDirectory(data.vipDirectory || []);
    } catch {
      // Keep existing state on offline retry
    }
  }, []);

  // Real-time WebSocket connection for multiplayer chat, presence, wallet & config sync
  useEffect(() => {
    if (!user) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            event: 'auth:identify',
            payload: { userId: user.id, userName: user.full_name },
          })
        );
        if (activeSession?.tableId) {
          socket?.send(
            JSON.stringify({
              event: 'table:subscribe',
              payload: { tableId: activeSession.tableId },
            })
          );
        }
      };

      socket.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          if (parsed.event === 'table:chat' && parsed.payload) {
            setTableMessages((prev) => {
              if (prev.some((m) => m.id === parsed.payload.id)) return prev;
              return [...prev.slice(-49), parsed.payload];
            });
          } else if (parsed.event === 'wallet:update' || parsed.event === 'notification:new' || parsed.event === 'config:updated') {
            loadPlayerDashboard(user.id);
          }
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        if (!closed) {
          setTimeout(connect, 2500);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      socket?.close();
    };
  }, [user?.id, activeSession?.tableId, loadPlayerDashboard]);

  const handleAuthSuccess = async (loggedUser: UserProfile) => {
    setUser(loggedUser);
    if (gpsCoords) {
      fetch('/api/player/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loggedUser.id, lat: gpsCoords.lat, lng: gpsCoords.lng }),
      }).catch(() => {});
    }
    await loadPlayerDashboard(loggedUser.id);
    if (loggedUser.role === 'admin') {
      setView('admin');
    } else {
      setView('player');
    }
  };

  const handleConfirmJoinTable = async (
    tier: BetTier,
    variant: TongitsVariant,
    maxPlayers: number,
    bringInAmount: number,
    tableId?: string
  ): Promise<string | null> => {
    if (!user || !selectedGameToJoin) return 'Missing session';
    // Trigger full-screen + landscape immediately inside the user click gesture
    requestGameFullscreenLandscape();
    try {
      const res = await fetch('/api/table/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          gameKey: selectedGameToJoin.game_key,
          tableId,
          betAmount: tier.bet,
          bringInAmount,
          variant,
          maxPlayers,
          lat: gpsCoords?.lat ?? null,
          lng: gpsCoords?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return data.error || 'Could not join table.';
      }
      setActiveSession(data.session);
      setTableMessages([]);
      setSelectedGameToJoin(null);
      setView('table');
      loadPlayerDashboard(user.id);
      return null;
    } catch {
      return 'Network error while seating at table.';
    }
  };

  const handleExitTable = async () => {
    exitGameFullscreen();
    if (user && activeSession) {
      await fetch('/api/table/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tableId: activeSession.tableId }),
      }).catch(() => {});
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'table:unsubscribe' }));
      }
      await loadPlayerDashboard(user.id);
    }
    setActiveSession(null);
    setView('player');
  };

  const handleSwitchTable = async (
    nextBet: number,
    nextVariant: TongitsVariant,
    nextMaxPlayers?: number,
    nextTableId?: string
  ): Promise<string | null> => {
    if (!user || !activeSession) return 'No active table session.';
    const matchedTbl = nextTableId ? tables.find((t) => t.id === nextTableId) : undefined;
    const tier = BET_TIERS.find((t) => t.bet === nextBet) || BET_TIERS[0];
    const reqMinWallet = matchedTbl ? matchedTbl.min_wallet : tier.minWallet;
    if (user.wallet_balance < reqMinWallet) {
      return `Insufficient wallet balance. Bet ₱${nextBet} requires at least ₱${reqMinWallet} in your wallet.`;
    }
    const nextBringIn = Math.max(
      reqMinWallet,
      Math.min(user.wallet_balance, activeSession.bringInWallet)
    );

    try {
      await fetch('/api/table/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tableId: activeSession.tableId }),
      }).catch(() => {});

      const res = await fetch('/api/table/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          gameKey: activeSession.gameKey,
          tableId: nextTableId,
          betAmount: nextBet,
          bringInAmount: nextBringIn,
          variant: nextVariant,
          maxPlayers: nextMaxPlayers ?? activeSession.maxPlayers,
          lat: gpsCoords?.lat ?? null,
          lng: gpsCoords?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return data.error || 'Could not switch to the selected table.';
      }
      setActiveSession(data.session);
      setTableMessages([]);
      loadPlayerDashboard(user.id);
      return null;
    } catch {
      return 'Network error while switching table.';
    }
  };

  const handleSendTableChat = (text: string, isEmoji = false) => {
    if (!user || !activeSession) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'table:chat',
          payload: {
            tableId: activeSession.tableId,
            senderId: user.id,
            senderName: user.full_name,
            text,
            isEmoji,
          },
        })
      );
    } else {
      setTableMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          tableId: activeSession.tableId,
          senderId: user.id,
          senderName: user.full_name,
          text,
          isEmoji,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleMarkNotificationsRead = async () => {
    if (!user) return;
    await fetch('/api/player/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!user) return;
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    await fetch(
      `/api/player/notifications/${encodeURIComponent(notificationId)}?userId=${encodeURIComponent(user.id)}`,
      { method: 'DELETE' }
    ).catch(() => {});
  };

  const handleClearAllNotifications = async () => {
    if (!user) return;
    setNotifications([]);
    await fetch(`/api/player/notifications?userId=${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  const handleClearCache = async () => {
    if (clearingCache) return;
    setClearingCache(true);
    await clearAppCacheAndReload();
  };

  const handleLogout = () => {
    exitGameFullscreen();
    setActiveSession(null);
    setUser(null);
    setView('login');
  };

  const isFullScreenGame = view === 'table' || view === 'superace' || view === 'arena3d';

  return (
    <div
      className={
        isFullScreenGame
          ? 'h-[100dvh] w-screen overflow-hidden bg-[#02140f] text-emerald-50'
          : 'min-h-screen flex flex-col justify-between bg-[#031c16] text-emerald-50'
      }
    >
      {/* Clean 3-Zone Top Navigation Bar (Hidden during full-screen gameplay) */}
      {!isFullScreenGame && (
      <header className="sticky top-0 z-40 border-b border-emerald-800/80 bg-[#031c16]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-6 px-4 py-3">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              if (!user) setView('login');
              else if (user.role === 'admin') setView('admin');
              else setView('player');
            }}
            className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight text-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img
              src={choyAppIconImg}
              alt="Choy Card Game App Icon"
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-xl object-cover border border-amber-400/70 shadow-md"
            />
            Choy Card Game
          </button>

          {/* Zone 2: Concise Single-line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-emerald-200">
            {user && (
              <button
                type="button"
                onClick={() => setView('player')}
                className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  view === 'player' ? 'text-amber-300 underline underline-offset-4' : ''
                }`}
              >
                Game Lobby
              </button>
            )}
            {user && (
              <button
                type="button"
                onClick={() => {
                  requestGameFullscreenLandscape();
                  setActiveSlotKey('superace');
                  setView('superace');
                }}
                className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Super Ace
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                requestGameFullscreenLandscape();
                setView('arena3d');
              }}
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              3D VIP Arena
            </button>
            <button
              type="button"
              onClick={() => setView('ai_studio')}
              className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'ai_studio' ? 'text-amber-300 underline underline-offset-4' : ''
              }`}
            >
              AI & Maps
            </button>
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setView('admin')}
                className={`inline-flex items-center gap-1 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  view === 'admin' ? 'text-amber-300 underline underline-offset-4' : ''
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin Panel
              </button>
            )}
          </nav>

          {/* Zone 3: Primary Action (Install App / Logout) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setView('arena3d')}
              className="md:hidden rounded-lg border border-amber-400/60 bg-[#052920] px-2.5 py-2 text-xs font-bold text-amber-300 whitespace-nowrap cursor-pointer"
            >
              3D
            </button>
            <button
              type="button"
              onClick={() => setView('ai_studio')}
              className="md:hidden rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-2 text-xs font-bold text-emerald-100 whitespace-nowrap cursor-pointer"
            >
              AI
            </button>
            <button
              type="button"
              onClick={handleClearCache}
              disabled={clearingCache}
              title="Clear app cache & reload latest version"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-2 text-xs font-bold text-emerald-200 hover:border-amber-400 hover:text-amber-200 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${clearingCache ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{clearingCache ? 'Clearing...' : 'Clear Cache'}</span>
            </button>
            <button
              type="button"
              onClick={handleToggleSound}
              title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer active:scale-95 ${
                soundEnabled
                  ? 'border-amber-400/80 bg-amber-400/20 text-amber-200 hover:bg-amber-400/35 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                  : 'border-zinc-700 bg-zinc-900/85 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-zinc-400" />
              )}
              <span className="hidden sm:inline">{soundEnabled ? 'Sound: ON' : 'Sound: OFF'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/70 bg-amber-400/15 px-3 py-2 text-xs font-extrabold text-amber-200 hover:bg-amber-400 hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share App</span>
            </button>
            <PWAInstallButton />
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-[#052920] px-3 py-2 text-xs font-bold text-emerald-200 hover:border-red-500 hover:text-red-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            )}
          </div>
        </div>
      </header>
      )}

      {/* MAIN APPLICATION VIEWS */}
      <main className={isFullScreenGame ? 'h-full w-full' : 'flex-1'}>
        {view === 'login' && (
          <LoginView gpsStatus={gpsStatus} onAuthSuccess={handleAuthSuccess} />
        )}

        {view === 'player' && user && (
          <PlayerDashboard
            profile={user}
            games={games}
            systemConfig={systemConfig}
            transactions={transactions}
            notifications={notifications}
            tables={tables}
            weeklyTop3={weeklyTop3}
            vipDirectory={vipDirectory}
            gpsStatus={gpsStatus}
            onOpenCashIn={() => setCashInOpen(true)}
            onOpenCashOut={() => setCashOutOpen(true)}
            onOpenGameSetup={(game) => setSelectedGameToJoin(game)}
            onOpenSlotGame={(slotKey) => {
              requestGameFullscreenLandscape();
              setActiveSlotKey(slotKey);
              setView('superace');
            }}
            onMarkNotificationsRead={handleMarkNotificationsRead}
            onDeleteNotification={handleDeleteNotification}
            onClearAllNotifications={handleClearAllNotifications}
            onRefresh={() => loadPlayerDashboard(user.id)}
            publicShareOrigin={shareOrigin}
            onOpenShareModal={() => setShareModalOpen(true)}
            onBackToAdmin={user.role === 'admin' ? () => setView('admin') : undefined}
          />
        )}

        {view === 'superace' && user && (
          <SuperAceSlotView
            gameKey={activeSlotKey}
            user={user}
            onExit={() => {
              exitGameFullscreen();
              loadPlayerDashboard(user.id);
              setView('player');
            }}
            onOpenCashIn={() => setCashInOpen(true)}
            onProfileUpdated={(updated) => setUser(updated)}
          />
        )}

        {view === 'admin' && user?.role === 'admin' && (
          <AdminDashboard
            admin={user}
            onPreviewLobby={() => {
              loadPlayerDashboard(user.id);
              setView('player');
            }}
          />
        )}

        {view === 'table' && user && activeSession && (
          <GameTableView
            user={user}
            session={activeSession}
            tables={tables}
            wsRef={wsRef}
            incomingMessages={tableMessages}
            onSendChat={handleSendTableChat}
            onDeleteChatMessage={(messageId) =>
              setTableMessages((prev) => prev.filter((m) => m.id !== messageId))
            }
            onClearChatMessages={() => setTableMessages([])}
            onOpenAddCoins={() => setCashInOpen(true)}
            onSwitchTable={handleSwitchTable}
            onExitTable={handleExitTable}
            onRoundSettled={(updated) => setUser(updated)}
          />
        )}

        {view === 'ai_studio' && (
          <AIHubSuite
            gpsCoords={gpsCoords}
            onOpen3DArena={() => setView('arena3d')}
          />
        )}
      </main>

      {/* FULL-VIEWPORT THREE.JS 3D VIP DICE ARENA (ZERO WEBSITE CHROME) */}
      {view === 'arena3d' && (
        <ThreeDiceArena
          user={user}
          onExit={() => {
            exitGameFullscreen();
            setView(user ? (user.role === 'admin' ? 'admin' : 'player') : 'login');
          }}
          onWalletUpdated={(updated) => setUser(updated)}
        />
      )}

      {/* CLEAN FOOTER: Contact Us · About Us · Blog · 2026choyjiez all rights reserved */}
      {!isFullScreenGame && (
      <footer className="mt-10 border-t border-emerald-900/90 bg-[#021611] px-4 py-5 text-center text-xs text-emerald-300">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-5 font-semibold text-amber-300">
            <button
              type="button"
              onClick={() => setFooterModal('contact')}
              className="hover:underline cursor-pointer"
            >
              Contact Us
            </button>
            <button
              type="button"
              onClick={() => setFooterModal('about')}
              className="hover:underline cursor-pointer"
            >
              About Us
            </button>
            <button
              type="button"
              onClick={() => setFooterModal('blog')}
              className="hover:underline cursor-pointer"
            >
              Blog
            </button>
          </div>
          <p className="text-emerald-400">© 2026choyjiez all rights reserved</p>
        </div>
      </footer>
      )}

      {/* MODALS */}
      {cashInOpen && user && (
        <CashInModal
          user={user}
          onClose={() => setCashInOpen(false)}
          onSubmitted={() => loadPlayerDashboard(user.id)}
        />
      )}
      {cashOutOpen && user && (
        <CashOutModal
          user={user}
          onClose={() => setCashOutOpen(false)}
          onSubmitted={() => loadPlayerDashboard(user.id)}
        />
      )}
      {selectedGameToJoin && user && (
        <TableBuyInModal
          user={user}
          game={selectedGameToJoin}
          tables={tables}
          gpsLabel={gpsStatus}
          onClose={() => setSelectedGameToJoin(null)}
          onOpenCashIn={() => setCashInOpen(true)}
          onConfirm={handleConfirmJoinTable}
        />
      )}
      <InfoModal type={footerModal} onClose={() => setFooterModal(null)} />
      {shareModalOpen && (
        <ShareAppModal
          user={user}
          shareOrigin={shareOrigin}
          defaultShareOrigin={defaultShareOrigin}
          customShareOrigin={customShareOrigin}
          isPublicLive={isPublicLive}
          shareHttpStatus={shareHttpStatus}
          onRecheckShareConfig={refreshShareConfig}
          onClose={() => setShareModalOpen(false)}
          onUpdatedShareOrigin={(nextOrigin, nextCustom) => {
            setShareOrigin(nextOrigin);
            setCustomShareOrigin(nextCustom);
          }}
        />
      )}

      {/* Sound Toast Notification Popup */}
      {soundToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border border-amber-400/80 bg-emerald-950/95 px-4 py-2 text-xs font-extrabold text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.6)] backdrop-blur-md animate-bounce">
          <span>{soundToast}</span>
        </div>
      )}

      {/* FLOATING ASK CHOY AI MESSENGER BUBBLE — Visible on Login, Dashboard, Admin, AI Studio */}
      {!isFullScreenGame && <AskChoyBubble />}
      <OfflineIndicator />
    </div>
  );
}
