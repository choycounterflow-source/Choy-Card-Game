import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Check,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Eye,
  FileCode2,
  KeyRound,
  Link2,
  Lock,
  MessageSquareCode,
  Monitor,
  RefreshCw,
  Search,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import type { Transaction, UserProfile } from '../types';
import { copyTextReliable } from '../lib/shareUrl';

interface AdminSecretStudioProps {
  admin: UserProfile;
  onClose: () => void;
}

interface SourceFileMeta {
  path: string;
  size: number;
  lines: number;
  group: string;
}

interface StudioAnalyticsData {
  generatedAt: string;
  onlineSockets: number;
  roleCounts: { admin: number; agent: number; player: number; bot: number };
  totalProfiles: number;
  totalWalletCirculation: number;
  totalCashIn: number;
  totalCashOut: number;
  netCashflow: number;
  pendingTxCount: number;
  totalRake: number;
  totalHands: number;
  totalPotVolume: number;
  slotStats: {
    activeSlotProfiles: number;
    totalSpins: number;
    totalScatters: number;
  };
  tableRowCounts: Array<{ table: string; rows: number }>;
  gameBreakdown: Array<{
    game_key: string;
    game_name: string;
    enabled: boolean;
    totalTables: number;
    enabledTables: number;
    handsPlayed: number;
    potVolume: number;
    rakeEarned: number;
  }>;
  topWallets: Array<{
    id: string;
    full_name: string;
    role: string;
    vip_level: number;
    wallet_balance: number;
    total_wins: number;
    total_losses: number;
  }>;
  recentTransactions: Transaction[];
}

interface StudioChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const INITIAL_CHAT: StudioChatMessage[] = [
  {
    id: 'welcome-builder',
    role: 'model',
    text: 'Welcome sa Secret Admin Builder Studio! Pwede ka mangutana dire about live analytics, tan-awon ang source code, i-test ang Live Preview sa tuo, o maghimo og bag-ong feature prompt nga pwede nimo i-apply diretso.',
  },
];

export const AdminSecretStudio: React.FC<AdminSecretStudioProps> = ({ admin, onClose }) => {
  // PIN Gate State
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');

  // Saved External Builder Link & Settings State
  const [builderUrl, setBuilderUrl] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [builderUrlDraft, setBuilderUrlDraft] = useState('');
  const [currentPinDraft, setCurrentPinDraft] = useState('');
  const [newPinDraft, setNewPinDraft] = useState('');
  const [settingsStatus, setSettingsStatus] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Workspace Layout & Tabs
  const [rightTab, setRightTab] = useState<'preview' | 'code' | 'analytics'>('preview');
  const [mobilePane, setMobilePane] = useState<'chat' | 'workspace'>('chat');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('mobile');
  const [previewKey, setPreviewKey] = useState(1);

  // Code Explorer State
  const [files, setFiles] = useState<SourceFileMeta[]>([]);
  const [fileSearch, setFileSearch] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [selectedFileContent, setSelectedFileContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [attachFileToChat, setAttachFileToChat] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Live Data Analytics State
  const [analytics, setAnalytics] = useState<StudioAnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // AI Builder Chat State
  const [chatMessages, setChatMessages] = useState<StudioChatMessage[]>(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  const adminHeaders = {
    'Content-Type': 'application/json',
    'x-admin-id': admin.id,
  };

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/secret-studio/files?adminId=${encodeURIComponent(admin.id)}`,
        { headers: { 'x-admin-id': admin.id } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      // ignore
    }
  }, [admin.id]);

  const openFile = useCallback(
    async (relPath: string) => {
      setSelectedFilePath(relPath);
      setLoadingFile(true);
      try {
        const res = await fetch(
          `/api/admin/secret-studio/file?adminId=${encodeURIComponent(admin.id)}&path=${encodeURIComponent(relPath)}`,
          { headers: { 'x-admin-id': admin.id } }
        );
        const data = await res.json();
        if (res.ok) {
          setSelectedFileContent(data.content || '');
        } else {
          setSelectedFileContent(`// Error: ${data.error || 'Unable to load file'}`);
        }
      } catch {
        setSelectedFileContent('// Network error loading source file.');
      } finally {
        setLoadingFile(false);
      }
    },
    [admin.id]
  );

  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(
        `/api/admin/secret-studio/analytics?adminId=${encodeURIComponent(admin.id)}`,
        { headers: { 'x-admin-id': admin.id } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setAnalytics(data);
    } catch {
      // ignore
    } finally {
      setLoadingAnalytics(false);
    }
  }, [admin.id]);

  useEffect(() => {
    if (unlocked) {
      loadFiles();
      loadAnalytics();
    }
  }, [unlocked, loadFiles, loadAnalytics]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatBusy]);

  const handleVerifyPin = async (overridePin?: string) => {
    const pinToTest = (overridePin ?? pinInput).trim();
    if (!pinToTest) {
      setPinError('Enter your Secret PIN.');
      return;
    }
    setPinBusy(true);
    setPinError('');
    try {
      const res = await fetch('/api/admin/secret-studio/verify-pin', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ adminId: admin.id, pin: pinToTest }),
      });
      const data = await res.json();
      if (!res.ok || !data.unlocked) {
        setPinError(data.error || 'Incorrect Secret PIN.');
        setPinInput('');
      } else {
        setBuilderUrl(data.builderUrl || '');
        setBuilderUrlDraft(data.builderUrl || '');
        setCurrentPinDraft(pinToTest);
        setUnlocked(true);
      }
    } catch {
      setPinError('Unable to reach server.');
    } finally {
      setPinBusy(false);
    }
  };

  const handleKeypadDigit = (digit: string) => {
    if (pinInput.length >= 8) return;
    setPinError('');
    setPinInput((prev) => prev + digit);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsStatus('');
    try {
      const res = await fetch('/api/admin/secret-studio/settings', {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({
          adminId: admin.id,
          currentPin: currentPinDraft,
          newPin: newPinDraft.trim() || undefined,
          builderUrl: builderUrlDraft.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsStatus(data.error || 'Could not save settings.');
      } else {
        setBuilderUrl(data.builderUrl || '');
        if (data.pinChanged && newPinDraft.trim()) {
          setCurrentPinDraft(newPinDraft.trim());
          setNewPinDraft('');
        }
        setSettingsStatus(
          data.pinChanged
            ? 'Saved Builder Link & updated Secret PIN!'
            : 'Saved Direct Builder Link!'
        );
      }
    } catch {
      setSettingsStatus('Network error while saving settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendChat = async (promptOverride?: string) => {
    const text = (promptOverride ?? chatInput).trim();
    if (!text || chatBusy) return;

    const userMsg: StudioChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    if (!promptOverride) setChatInput('');
    setChatBusy(true);

    try {
      const res = await fetch('/api/admin/secret-studio/chat', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          adminId: admin.id,
          message: text,
          history: chatMessages.slice(-10).map((m) => ({ role: m.role, text: m.text })),
          activeFilePath: attachFileToChat ? selectedFilePath : '',
          activeFileContent: attachFileToChat ? selectedFileContent : '',
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: res.ok ? data.reply : data.error || 'Builder AI could not respond.',
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: 'Network error reaching Builder AI. Please try again.',
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(fileSearch.trim().toLowerCase())
  );

  const previewUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/?studio_preview=1` : '/?studio_preview=1';

  // ==================== LOCKED PIN GATE ====================
  if (!unlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl border border-amber-400/50 bg-[#052920] p-6 shadow-2xl space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-emerald-950 shadow-lg">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold text-white">
                  Secret Admin Studio
                </h2>
                <p className="text-[11px] text-emerald-300">
                  Enter Admin Secret PIN to open Builder Chat, Preview &amp; Code
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close PIN modal"
              className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-900 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyPin();
            }}
            className="space-y-4"
          >
            <div>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  setPinError('');
                  setPinInput(e.target.value.replace(/\D/g, ''));
                }}
                placeholder="Enter PIN (Default: 2026)"
                className="w-full rounded-2xl border border-emerald-700 bg-[#031c16] px-4 py-3 text-center font-mono-num text-xl font-extrabold tracking-[0.4em] text-amber-300 placeholder:tracking-normal placeholder:text-xs placeholder:font-normal placeholder:text-emerald-500 focus:border-amber-400 focus:outline-none"
              />
              {pinError && (
                <p className="mt-2 text-center text-xs font-semibold text-red-300">{pinError}</p>
              )}
            </div>

            {/* Touch-friendly Numeric PIN Pad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleKeypadDigit(d)}
                  className="rounded-xl border border-emerald-800 bg-[#031c16] py-3 font-mono-num text-base font-extrabold text-white hover:border-amber-400 hover:bg-emerald-900/50 active:scale-95 transition cursor-pointer"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPinInput('');
                  setPinError('');
                }}
                className="rounded-xl border border-emerald-800 bg-[#031c16] py-3 text-xs font-bold text-red-300 hover:border-red-400 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadDigit('0')}
                className="rounded-xl border border-emerald-800 bg-[#031c16] py-3 font-mono-num text-base font-extrabold text-white hover:border-amber-400 hover:bg-emerald-900/50 active:scale-95 transition cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPinInput((p) => p.slice(0, -1))}
                className="rounded-xl border border-emerald-800 bg-[#031c16] py-3 text-xs font-bold text-emerald-200 hover:border-amber-400 cursor-pointer"
              >
                Del
              </button>
            </div>

            <button
              type="submit"
              disabled={pinBusy || pinInput.length < 4}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3 text-sm font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
            >
              <Unlock className="h-4 w-4" />
              {pinBusy ? 'Verifying PIN...' : 'Unlock Secret Studio'}
            </button>
          </form>

          <p className="text-center text-[11px] text-emerald-400">
            Default Secret PIN: <strong className="font-mono-num text-amber-300">2026</strong> (pwede ilisan sulod sa Settings)
          </p>
        </div>
      </div>
    );
  }

  // ==================== UNLOCKED SPLIT BUILDER STUDIO ====================
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#02140f] text-emerald-50">
      {/* Top Studio Control Bar */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/90 bg-[#04241c] px-3 sm:px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-emerald-950 shadow">
            <MessageSquareCode className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-display text-sm sm:text-base font-extrabold text-white leading-tight">
              Choy Secret Builder Studio
            </h1>
            <p className="text-[10px] text-emerald-300 hidden sm:block">
              AI Builder Chat · Live Preview · All Source Code · Live Data Analytics
            </p>
          </div>
        </div>

        {/* Right-Pane Mode Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-emerald-800 bg-[#02140f] p-1">
          {[
            { id: 'preview' as const, label: 'Preview', icon: Eye },
            { id: 'code' as const, label: 'All Code', icon: Code2 },
            { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setRightTab(tab.id);
                  setMobilePane('workspace');
                  if (tab.id === 'analytics') loadAnalytics();
                  if (tab.id === 'code' && files.length === 0) loadFiles();
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  rightTab === tab.id
                    ? 'bg-amber-400 text-emerald-950'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Direct External Editor Link + Settings + Lock Exit */}
        <div className="flex items-center gap-1.5">
          {builderUrl ? (
            <a
              href={builderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-1.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 transition whitespace-nowrap"
              title="Open your saved direct builder/editor workspace link"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open Builder Link</span>
              <span className="sm:hidden">Editor</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/60 bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-400/25 cursor-pointer whitespace-nowrap"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Set Builder Link</span>
              <span className="sm:hidden">Link</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            title="Secret PIN & Direct Builder Link Settings"
            className={`rounded-xl border p-2 transition cursor-pointer ${
              settingsOpen
                ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                : 'border-emerald-700 bg-[#031c16] text-emerald-200 hover:border-amber-400'
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-xl border border-red-400/60 bg-red-950/60 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-900/70 cursor-pointer whitespace-nowrap"
          >
            <Lock className="h-3.5 w-3.5" />
            Lock
          </button>
        </div>
      </header>

      {/* Mobile Pane Toggle (Chat vs Preview/Code/Analytics) */}
      <div className="lg:hidden grid grid-cols-2 gap-1 border-b border-emerald-800/80 bg-[#031c16] p-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobilePane('chat')}
          className={`rounded-lg py-1.5 text-xs font-extrabold cursor-pointer ${
            mobilePane === 'chat' ? 'bg-amber-400 text-emerald-950' : 'text-emerald-200'
          }`}
        >
          Builder AI Chat
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('workspace')}
          className={`rounded-lg py-1.5 text-xs font-extrabold cursor-pointer ${
            mobilePane === 'workspace' ? 'bg-amber-400 text-emerald-950' : 'text-emerald-200'
          }`}
        >
          {rightTab === 'preview' ? 'Live Preview' : rightTab === 'code' ? 'All Code' : 'Data Analytics'}
        </button>
      </div>

      {/* Collapsible PIN & Direct Builder Link Settings Drawer */}
      {settingsOpen && (
        <form
          onSubmit={handleSaveSettings}
          className="border-b border-amber-400/40 bg-[#063026] px-4 py-3.5 shrink-0"
        >
          <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label className="flex items-center gap-1 text-[11px] font-bold text-amber-300 mb-1">
                <Link2 className="h-3.5 w-3.5" />
                Direct Builder / Project Editor Bookmark URL
              </label>
              <input
                type="url"
                value={builderUrlDraft}
                onChange={(e) => setBuilderUrlDraft(e.target.value)}
                placeholder="Paste your direct project editor link (https://...)"
                className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs text-white placeholder-emerald-500 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-1 text-[11px] font-bold text-emerald-200 mb-1">
                <KeyRound className="h-3 w-3" />
                Current PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={currentPinDraft}
                onChange={(e) => setCurrentPinDraft(e.target.value.replace(/\D/g, ''))}
                placeholder="2026"
                className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs font-mono-num text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-emerald-200 mb-1">
                New Secret PIN (Optional)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={newPinDraft}
                onChange={(e) => setNewPinDraft(e.target.value.replace(/\D/g, ''))}
                placeholder="4-8 digits"
                className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs font-mono-num text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="md:col-span-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="flex-1 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs font-bold text-emerald-200 hover:text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
          {settingsStatus && (
            <p className="mx-auto max-w-6xl mt-2 text-xs font-semibold text-amber-300">
              {settingsStatus}
            </p>
          )}
        </form>
      )}

      {/* MAIN SPLIT WORKSPACE */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* ==================== LEFT PANE: AI BUILDER CHAT ==================== */}
        <section
          className={`${
            mobilePane === 'chat' ? 'flex' : 'hidden'
          } lg:flex w-full lg:w-[400px] xl:w-[440px] shrink-0 flex-col border-r border-emerald-800/90 bg-[#031c16]`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-emerald-800/80 px-3.5 py-2.5 bg-[#04241c]">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="font-display text-xs font-bold text-amber-300">
                AI Builder &amp; Analyst Chat
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChatMessages(INITIAL_CHAT)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-400/50 bg-red-950/60 px-2 py-1 text-[10px] font-bold text-red-200 hover:bg-red-900/70 cursor-pointer"
              title="Clear chat history"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>

          {/* Quick Starter Chips */}
          <div className="flex flex-wrap gap-1.5 border-b border-emerald-800/60 px-3 py-2 bg-[#021611]">
            {[
              'Analyze live cashflow & rake',
              'Check active tables & slots stats',
              'Write prompt to add a new feature',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSendChat(chip)}
                className="rounded-lg border border-emerald-800 bg-[#052920] px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:border-amber-400 hover:text-amber-200 cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Attached File Indicator */}
          {attachFileToChat && selectedFilePath && (
            <div className="flex items-center justify-between gap-2 border-b border-amber-400/30 bg-amber-950/35 px-3 py-1.5 text-[11px] text-amber-200">
              <span className="truncate font-mono-num">
                Attached code: <strong>{selectedFilePath}</strong>
              </span>
              <button
                type="button"
                onClick={() => setAttachFileToChat(false)}
                className="text-amber-300 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Messages Stream */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-2xl p-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-6 bg-amber-400 text-emerald-950 font-semibold'
                    : 'mr-3 border border-emerald-800/90 bg-[#052920] text-emerald-50'
                }`}
              >
                <div className="whitespace-pre-wrap break-words font-sans">{msg.text}</div>
                <div className="mt-2 flex items-center justify-end gap-1.5 opacity-80">
                  {msg.role === 'model' && (
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyTextReliable(msg.text);
                        if (ok) {
                          setCopiedMsgId(msg.id);
                          setTimeout(() => setCopiedMsgId(null), 1800);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-700 bg-[#031c16] px-2 py-0.5 text-[10px] font-bold text-emerald-200 hover:border-amber-400 cursor-pointer"
                    >
                      {copiedMsgId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedMsgId === msg.id ? 'Copied' : 'Copy'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setChatMessages((prev) => prev.filter((item) => item.id !== msg.id))
                    }
                    className={`rounded-md p-1 cursor-pointer ${
                      msg.role === 'user'
                        ? 'text-emerald-950/70 hover:text-red-900'
                        : 'text-red-300/75 hover:bg-red-950/60 hover:text-red-200'
                    }`}
                    title="Delete message"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {chatBusy && (
              <div className="mr-6 rounded-2xl border border-emerald-800 bg-[#052920] px-3.5 py-2.5 text-xs text-amber-300">
                Analyzing project code &amp; live database...
              </div>
            )}
          </div>

          {/* Chat Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="border-t border-emerald-800/80 bg-[#04241c] p-2.5 flex items-end gap-2 shrink-0"
          >
            <textarea
              ref={chatInputRef}
              rows={2}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              placeholder="Ask about analytics, code, or plan an edit..."
              className="flex-1 resize-none rounded-xl border border-emerald-700 bg-[#021611] px-3 py-2 text-xs text-white placeholder-emerald-400/70 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={chatBusy || !chatInput.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-emerald-950 hover:bg-amber-300 disabled:opacity-45 cursor-pointer"
              aria-label="Send to Builder AI"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>

        {/* ==================== RIGHT PANE: LIVE PREVIEW / ALL CODE / DATA ANALYTICS ==================== */}
        <section
          className={`${
            mobilePane === 'workspace' ? 'flex' : 'hidden'
          } lg:flex flex-1 min-w-0 flex-col bg-[#02140f]`}
        >
          {/* TAB 1: LIVE PREVIEW */}
          {rightTab === 'preview' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/80 bg-[#031c16] px-3.5 py-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'mobile' as const, label: 'Mobile', icon: Smartphone },
                    { id: 'tablet' as const, label: 'Tablet', icon: Tablet },
                    { id: 'desktop' as const, label: 'Full', icon: Monitor },
                  ].map((d) => {
                    const Icon = d.icon;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setPreviewDevice(d.id)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                          previewDevice === d.id
                            ? 'bg-amber-400 text-emerald-950'
                            : 'border border-emerald-800 text-emerald-200 hover:border-amber-400'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline font-mono-num text-[11px] text-emerald-400 truncate max-w-[260px]">
                    {previewUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewKey((k) => k + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-1 text-[11px] font-bold text-emerald-100 hover:border-amber-400 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reload
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-auto bg-[#010d0a] flex items-center justify-center p-2 sm:p-4">
                <div
                  className={`h-full bg-[#031c16] border-2 border-emerald-700/80 rounded-2xl overflow-hidden shadow-2xl transition-all duration-200 ${
                    previewDevice === 'mobile'
                      ? 'w-[390px] max-w-full'
                      : previewDevice === 'tablet'
                        ? 'w-[768px] max-w-full'
                        : 'w-full'
                  }`}
                >
                  <iframe
                    key={previewKey}
                    src={previewUrl}
                    title="Live App Preview"
                    className="h-full w-full border-0 bg-[#031c16]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALL CODE EXPLORER */}
          {rightTab === 'code' && (
            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
              {/* File Tree Sidebar */}
              <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-emerald-800/80 bg-[#031c16] flex flex-col max-h-48 md:max-h-none">
                <div className="p-2.5 border-b border-emerald-800/70">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-emerald-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fileSearch}
                      onChange={(e) => setFileSearch(e.target.value)}
                      placeholder="Filter source files..."
                      className="w-full rounded-lg border border-emerald-800 bg-[#02140f] pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-emerald-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {filteredFiles.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() => openFile(f.path)}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-mono-num transition cursor-pointer ${
                        selectedFilePath === f.path
                          ? 'bg-amber-400 text-emerald-950 font-bold'
                          : 'text-emerald-200 hover:bg-emerald-900/50'
                      }`}
                    >
                      <span className="truncate inline-flex items-center gap-1.5">
                        <FileCode2 className="h-3.5 w-3.5 shrink-0 opacity-80" />
                        {f.path}
                      </span>
                      <span className="text-[10px] opacity-70 shrink-0">{f.lines}L</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Code Viewer Pane */}
              <div className="flex-1 min-w-0 flex flex-col bg-[#010e0b]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/80 bg-[#04241c] px-3.5 py-2 shrink-0">
                  <span className="font-mono-num text-xs font-bold text-amber-300 truncate">
                    {selectedFilePath || 'Select a file on the left to inspect source code'}
                  </span>
                  {selectedFilePath && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAttachFileToChat(true);
                          setMobilePane('chat');
                          chatInputRef.current?.focus();
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" />
                        Ask AI About File
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copyTextReliable(selectedFileContent);
                          if (ok) {
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 1800);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-700 bg-[#031c16] px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:border-amber-400 cursor-pointer"
                      >
                        {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copiedCode ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-auto p-3 font-mono-num text-[11px] leading-5 text-emerald-100">
                  {loadingFile ? (
                    <p className="text-amber-300 p-4">Loading source file...</p>
                  ) : selectedFilePath ? (
                    <pre className="whitespace-pre">
                      {selectedFileContent.split('\n').map((line, idx) => (
                        <div key={idx} className="flex hover:bg-emerald-900/20">
                          <span className="w-10 shrink-0 select-none pr-3 text-right text-emerald-600">
                            {idx + 1}
                          </span>
                          <span className="flex-1">{line}</span>
                        </div>
                      ))}
                    </pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-emerald-400 gap-2 p-6">
                      <Code2 className="h-10 w-10 text-amber-400/70" />
                      <p className="text-xs max-w-xs">
                        Browse all {files.length} source files of Choy Card Game (`server.ts`, `server/db.ts`, `src/components/*`, PWA manifest, and more).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LIVE DATA ANALYTICS */}
          {rightTab === 'analytics' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-extrabold text-white flex items-center gap-2">
                    <Database className="h-4 w-4 text-amber-400" />
                    Live Database &amp; Financial Analytics
                  </h2>
                  {analytics && (
                    <p className="text-[11px] text-emerald-400 font-mono-num">
                      Updated: {new Date(analytics.generatedAt).toLocaleTimeString()} · Online Live Sockets: {analytics.onlineSockets}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={loadAnalytics}
                  disabled={loadingAnalytics}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                  Refresh Live Data
                </button>
              </div>

              {analytics ? (
                <>
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-emerald-800 bg-[#052920] p-3.5">
                      <span className="text-[11px] text-emerald-300 block">Net Cashflow</span>
                      <strong className="font-mono-num text-lg font-extrabold text-amber-300">
                        ₱{analytics.netCashflow.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </strong>
                      <span className="block text-[10px] text-emerald-400 mt-0.5">
                        In ₱{analytics.totalCashIn.toLocaleString()} · Out ₱{analytics.totalCashOut.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-emerald-800 bg-[#052920] p-3.5">
                      <span className="text-[11px] text-emerald-300 block">Wallet Circulation</span>
                      <strong className="font-mono-num text-lg font-extrabold text-white">
                        ₱{analytics.totalWalletCirculation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </strong>
                      <span className="block text-[10px] text-emerald-400 mt-0.5">
                        {analytics.totalProfiles} accounts ({analytics.roleCounts.player} players · {analytics.roleCounts.agent} agents)
                      </span>
                    </div>
                    <div className="rounded-2xl border border-emerald-800 bg-[#052920] p-3.5">
                      <span className="text-[11px] text-emerald-300 block">Total Auto-Rake</span>
                      <strong className="font-mono-num text-lg font-extrabold text-sky-300">
                        ₱{analytics.totalRake.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </strong>
                      <span className="block text-[10px] text-emerald-400 mt-0.5">
                        {analytics.totalHands} hands · Pot ₱{analytics.totalPotVolume.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-emerald-800 bg-[#052920] p-3.5">
                      <span className="text-[11px] text-emerald-300 block">Real Slot Activity</span>
                      <strong className="font-mono-num text-lg font-extrabold text-emerald-300">
                        {analytics.slotStats.totalSpins.toLocaleString()} Spins
                      </strong>
                      <span className="block text-[10px] text-emerald-400 mt-0.5">
                        {analytics.slotStats.totalScatters} scatter hits · {analytics.pendingTxCount} pending tx
                      </span>
                    </div>
                  </div>

                  {/* SQLite Table Row Counts */}
                  <div className="rounded-2xl border border-emerald-800 bg-[#052920] p-4 space-y-2.5">
                    <h3 className="font-display text-xs font-bold uppercase tracking-wider text-amber-300">
                      SQLite Database Tables
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {analytics.tableRowCounts.map((t) => (
                        <div
                          key={t.table}
                          className="rounded-xl border border-emerald-800/90 bg-[#031c16] px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <span className="font-mono-num text-[11px] text-emerald-200 truncate">
                            {t.table}
                          </span>
                          <strong className="font-mono-num text-xs text-amber-300">{t.rows}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Game Breakdown Table */}
                  <div className="rounded-2xl border border-emerald-800 bg-[#052920] p-4 space-y-2.5">
                    <h3 className="font-display text-xs font-bold uppercase tracking-wider text-amber-300">
                      Games &amp; Tables Matrix Health
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-emerald-800 text-[11px] text-emerald-300">
                            <th className="py-2 pr-3">Game</th>
                            <th className="py-2 px-2">Status</th>
                            <th className="py-2 px-2 text-right">Tables ON</th>
                            <th className="py-2 px-2 text-right">Hands</th>
                            <th className="py-2 px-2 text-right">Pot Volume</th>
                            <th className="py-2 pl-2 text-right">Rake</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-800/60 font-mono-num">
                          {analytics.gameBreakdown.map((g) => (
                            <tr key={g.game_key}>
                              <td className="py-2 pr-3 font-sans font-bold text-white">{g.game_name}</td>
                              <td className="py-2 px-2">
                                <span className={g.enabled ? 'text-emerald-300 font-bold' : 'text-red-300'}>
                                  {g.enabled ? 'ON' : 'OFF'}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right text-emerald-200">
                                {g.enabledTables}/{g.totalTables}
                              </td>
                              <td className="py-2 px-2 text-right text-white">{g.handsPlayed}</td>
                              <td className="py-2 px-2 text-right text-amber-200">
                                ₱{g.potVolume.toLocaleString()}
                              </td>
                              <td className="py-2 pl-2 text-right text-sky-300">
                                ₱{g.rakeEarned.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-emerald-300">Loading live analytics...</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
