import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Eye,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  KeyRound,
  Link2,
  Lock,
  MessageSquareCode,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Square,
  Tablet,
  Trash2,
  Unlock,
  UploadCloud,
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
  isError?: boolean;
  retryPrompt?: string;
  appliedUpdates?: string[];
}

interface PendingCommitFile {
  file_path: string;
  updated_at: string;
}

interface RecentGithubCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface DeployStatusData {
  githubRepoUrl: string;
  githubBranch: string;
  githubOwnerRepo: string;
  renderUrl: string;
  builderUrl: string;
  hasGithubToken: boolean;
  hasRenderDeployHook: boolean;
  pendingChanges: PendingCommitFile[];
  recentCommits: RecentGithubCommit[];
  commitsError: string;
}

const INITIAL_CHAT: StudioChatMessage[] = [
  {
    id: 'welcome-builder',
    role: 'model',
    text: 'Welcome sa Secret Admin Builder Studio! Pwede ka mangutana dire about live analytics, mag-apply og LIVE updates (weekly prizes, Ask Choy AI brain, toggle games, add player coins, broadcast announcement), ug mag-inspect o mag-edit sa source code.',
  },
];

export const AdminSecretStudio: React.FC<AdminSecretStudioProps> = ({ admin, onClose }) => {
  // PIN Gate State
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');

  // Saved External Builder, GitHub (Choy Repo Only) & Render Links State
  const [builderUrl, setBuilderUrl] = useState('');
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [renderUrl, setRenderUrl] = useState('');
  const [hasGithubToken, setHasGithubToken] = useState(false);
  const [hasRenderDeployHook, setHasRenderDeployHook] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [builderUrlDraft, setBuilderUrlDraft] = useState('');
  const [githubRepoDraft, setGithubRepoDraft] = useState('');
  const [githubBranchDraft, setGithubBranchDraft] = useState('main');
  const [renderUrlDraft, setRenderUrlDraft] = useState('');
  const [currentPinDraft, setCurrentPinDraft] = useState('');
  const [newPinDraft, setNewPinDraft] = useState('');
  const [settingsStatus, setSettingsStatus] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Workspace Layout & Tabs
  const [rightTab, setRightTab] = useState<'preview' | 'code' | 'deploy' | 'analytics'>('preview');
  const [mobilePane, setMobilePane] = useState<'chat' | 'workspace'>('chat');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('mobile');
  const [previewKey, setPreviewKey] = useState(1);

  // Code Explorer State
  const [files, setFiles] = useState<SourceFileMeta[]>([]);
  const [fileSearch, setFileSearch] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [selectedFileContent, setSelectedFileContent] = useState('');
  const [editingFile, setEditingFile] = useState(false);
  const [fileDraft, setFileDraft] = useState('');
  const [savingFile, setSavingFile] = useState(false);
  const [fileSaveNotice, setFileSaveNotice] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [attachFileToChat, setAttachFileToChat] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // GitHub Sync & Render Deploy State
  const [deployStatus, setDeployStatus] = useState<DeployStatusData | null>(null);
  const [loadingDeploy, setLoadingDeploy] = useState(false);
  const [stageSelectPath, setStageSelectPath] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [triggerRenderOnCommit, setTriggerRenderOnCommit] = useState(false);
  const [committingGithub, setCommittingGithub] = useState(false);
  const [deployFeedback, setDeployFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
    commitUrl?: string;
    shortSha?: string;
  } | null>(null);
  const [triggeringRender, setTriggeringRender] = useState(false);

  // Live Data Analytics State
  const [analytics, setAnalytics] = useState<StudioAnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // AI Builder Chat State
  const [chatMessages, setChatMessages] = useState<StudioChatMessage[]>(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatElapsedSec, setChatElapsedSec] = useState(0);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

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
      setEditingFile(false);
      setFileSaveNotice('');
      setLoadingFile(true);
      try {
        const res = await fetch(
          `/api/admin/secret-studio/file?adminId=${encodeURIComponent(admin.id)}&path=${encodeURIComponent(relPath)}`,
          { headers: { 'x-admin-id': admin.id } }
        );
        const data = await res.json();
        if (res.ok) {
          const content = data.content || '';
          setSelectedFileContent(content);
          setFileDraft(content);
        } else {
          setSelectedFileContent(`// Error: ${data.error || 'Unable to load file'}`);
          setFileDraft('');
        }
      } catch {
        setSelectedFileContent('// Network error loading source file.');
        setFileDraft('');
      } finally {
        setLoadingFile(false);
      }
    },
    [admin.id]
  );

  const handleSaveFile = async () => {
    if (!selectedFilePath || savingFile) return;
    setSavingFile(true);
    setFileSaveNotice('');
    try {
      const res = await fetch('/api/admin/secret-studio/file', {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          adminId: admin.id,
          path: selectedFilePath,
          content: fileDraft,
        }),
      });
      const raw = await res.text();
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: `Server returned status ${res.status}` };
      }
      if (!res.ok) {
        setFileSaveNotice(data.error || 'Failed to save file.');
      } else {
        setSelectedFileContent(fileDraft);
        setEditingFile(false);
        setFileSaveNotice('Saved & staged for GitHub commit!');
        setPreviewKey((k) => k + 1);
        loadFiles();
        loadDeployStatus();
        setTimeout(() => setFileSaveNotice(''), 4500);
      }
    } catch {
      setFileSaveNotice('Network error while saving file.');
    } finally {
      setSavingFile(false);
    }
  };

  const loadDeployStatus = useCallback(async () => {
    setLoadingDeploy(true);
    try {
      const res = await fetch(
        `/api/admin/secret-studio/deploy-status?adminId=${encodeURIComponent(admin.id)}`,
        { headers: { 'x-admin-id': admin.id } }
      );
      if (!res.ok) return;
      const data = (await res.json()) as DeployStatusData;
      setDeployStatus(data);
      setGithubRepoUrl(data.githubRepoUrl || '');
      setGithubBranch(data.githubBranch || 'main');
      setRenderUrl(data.renderUrl || '');
      setHasGithubToken(Boolean(data.hasGithubToken));
      setHasRenderDeployHook(Boolean(data.hasRenderDeployHook));
    } catch {
      // ignore
    } finally {
      setLoadingDeploy(false);
    }
  }, [admin.id]);

  const handleStageAction = async (action: 'stage' | 'unstage' | 'clear', filePath?: string) => {
    setDeployFeedback(null);
    try {
      const res = await fetch('/api/admin/secret-studio/github/stage', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ adminId: admin.id, action, filePath }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeployFeedback({ type: 'err', text: data.error || 'Could not update staged files.' });
        return;
      }
      setDeployStatus((prev) =>
        prev ? { ...prev, pendingChanges: data.pendingChanges || [] } : prev
      );
      if (action === 'stage') setStageSelectPath('');
    } catch {
      setDeployFeedback({ type: 'err', text: 'Network error updating staged files.' });
    }
  };

  const handleCommitGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (committingGithub) return;
    const msg = commitMessage.trim();
    if (msg.length < 2) {
      setDeployFeedback({ type: 'err', text: 'Enter a commit message first.' });
      return;
    }
    setCommittingGithub(true);
    setDeployFeedback(null);
    try {
      const res = await fetch('/api/admin/secret-studio/github/commit', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          adminId: admin.id,
          message: msg,
          triggerRenderDeploy: triggerRenderOnCommit && hasRenderDeployHook,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeployFeedback({ type: 'err', text: data.error || 'GitHub commit failed.' });
      } else {
        setCommitMessage('');
        const committedCount = Array.isArray(data.filesCommitted) ? data.filesCommitted.length : 0;
        const extraRender = data.renderDeployNote ? ` ${data.renderDeployNote}` : '';
        setDeployFeedback({
          type: 'ok',
          text: `Committed ${committedCount} file(s) to ${data.repo} (${data.branch}).${extraRender}`,
          commitUrl: data.commitUrl,
          shortSha: data.shortSha,
        });
        loadDeployStatus();
      }
    } catch {
      setDeployFeedback({ type: 'err', text: 'Network error while committing to GitHub.' });
    } finally {
      setCommittingGithub(false);
    }
  };

  const handleTriggerRenderDeploy = async () => {
    if (triggeringRender) return;
    setTriggeringRender(true);
    setDeployFeedback(null);
    try {
      const res = await fetch('/api/admin/secret-studio/render/deploy', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ adminId: admin.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeployFeedback({ type: 'err', text: data.error || 'Could not trigger Render deploy.' });
      } else {
        setDeployFeedback({
          type: 'ok',
          text: data.message || 'Render deploy triggered!',
        });
      }
    } catch {
      setDeployFeedback({ type: 'err', text: 'Network error reaching Render Deploy Hook.' });
    } finally {
      setTriggeringRender(false);
    }
  };

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
      loadDeployStatus();
    }
  }, [unlocked, loadFiles, loadAnalytics, loadDeployStatus]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatBusy]);

  useEffect(() => {
    if (!chatBusy) {
      setChatElapsedSec(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setChatElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [chatBusy]);

  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
    };
  }, []);

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
        setGithubRepoUrl(data.githubRepoUrl || '');
        setGithubRepoDraft(data.githubRepoUrl || '');
        setGithubBranch(data.githubBranch || 'main');
        setGithubBranchDraft(data.githubBranch || 'main');
        setRenderUrl(data.renderUrl || '');
        setRenderUrlDraft(data.renderUrl || '');
        setHasGithubToken(Boolean(data.hasGithubToken));
        setHasRenderDeployHook(Boolean(data.hasRenderDeployHook));
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
          githubRepoUrl: githubRepoDraft.trim(),
          githubBranch: githubBranchDraft.trim() || 'main',
          renderUrl: renderUrlDraft.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsStatus(data.error || 'Could not save settings.');
      } else {
        setBuilderUrl(data.builderUrl || '');
        setGithubRepoUrl(data.githubRepoUrl || '');
        setGithubRepoDraft(data.githubRepoUrl || '');
        setGithubBranch(data.githubBranch || 'main');
        setGithubBranchDraft(data.githubBranch || 'main');
        setRenderUrl(data.renderUrl || '');
        setRenderUrlDraft(data.renderUrl || '');
        setHasGithubToken(Boolean(data.hasGithubToken));
        setHasRenderDeployHook(Boolean(data.hasRenderDeployHook));
        if (data.pinChanged && newPinDraft.trim()) {
          setCurrentPinDraft(newPinDraft.trim());
          setNewPinDraft('');
        }
        setSettingsStatus(
          data.pinChanged
            ? 'Saved Links & updated Secret PIN!'
            : 'Saved GitHub Repo, Render & Builder Links!'
        );
        loadDeployStatus();
      }
    } catch {
      setSettingsStatus('Network error while saving settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleStopChat = () => {
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
      chatAbortRef.current = null;
    }
    setChatBusy(false);
  };

  const handleSendChat = async (promptOverride?: string) => {
    const text = (promptOverride ?? chatInput).trim();
    if (!text || chatBusy) return;

    // Exclude static welcome bubble and previous error bubbles from API turn history
    const cleanHistory = chatMessages
      .filter((m) => m.id !== 'welcome-builder' && !m.isError)
      .slice(-10)
      .map((m) => ({ role: m.role, text: m.text }));

    const userMsg: StudioChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    if (!promptOverride) setChatInput('');
    setChatBusy(true);

    const controller = new AbortController();
    chatAbortRef.current = controller;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 28_000);

    try {
      const res = await fetch('/api/admin/secret-studio/chat', {
        method: 'POST',
        headers: adminHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          adminId: admin.id,
          message: text,
          history: cleanHistory,
          activeFilePath: attachFileToChat ? selectedFilePath : '',
          activeFileContent: attachFileToChat ? selectedFileContent : '',
        }),
      });

      const rawText = await res.text();
      let data: { reply?: string; error?: string; appliedUpdates?: string[] } = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {
          error:
            res.status === 502 || res.status === 504
              ? `Server took too long to respond (HTTP ${res.status}). If Render just woke up from sleep, tap Retry.`
              : `Unexpected server response (HTTP ${res.status}). Tap Retry.`,
        };
      }

      if (res.ok) {
        const appliedUpdates = Array.isArray(data.appliedUpdates) ? data.appliedUpdates : [];
        setChatMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: 'model',
            text: data.reply || 'Done! Ready for your next instruction.',
            appliedUpdates,
          },
        ]);
        if (appliedUpdates.length > 0) {
          setPreviewKey((k) => k + 1);
          loadAnalytics();
        }
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'model',
            text: data.error || `Builder AI returned an error (HTTP ${res.status}).`,
            isError: true,
            retryPrompt: text,
          },
        ]);
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: isAbort
            ? timedOut
              ? 'Request timed out after 28s. Server or Gemini API was slow to reply — tap Retry.'
              : 'Request cancelled.'
            : 'Network error reaching Builder AI. Check your internet or Render server status and tap Retry.',
          isError: true,
          retryPrompt: text,
        },
      ]);
    } finally {
      clearTimeout(timeoutId);
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
      }
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
              AI Builder Chat · Live Preview · All Source Code · GitHub &amp; Render · Analytics
            </p>
          </div>
        </div>

        {/* Right-Pane Mode Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-emerald-800 bg-[#02140f] p-1 overflow-x-auto max-w-full">
          {[
            { id: 'preview' as const, label: 'Preview', icon: Eye, badge: 0 },
            { id: 'code' as const, label: 'All Code', icon: Code2, badge: 0 },
            {
              id: 'deploy' as const,
              label: 'GitHub & Render',
              icon: GitBranch,
              badge: deployStatus?.pendingChanges?.length || 0,
            },
            { id: 'analytics' as const, label: 'Analytics', icon: BarChart3, badge: 0 },
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
                  if (tab.id === 'deploy') loadDeployStatus();
                  if ((tab.id === 'code' || tab.id === 'deploy') && files.length === 0) loadFiles();
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  rightTab === tab.id
                    ? 'bg-amber-400 text-emerald-950'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono-num text-[10px] font-extrabold leading-none ${
                      rightTab === tab.id
                        ? 'bg-emerald-950 text-amber-300'
                        : 'bg-amber-400 text-emerald-950'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Direct GitHub + Render + Builder Links + Settings + Lock Exit */}
        <div className="flex items-center gap-1.5">
          {githubRepoUrl && (
            <a
              href={githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-600/80 bg-[#052920] px-2.5 py-1.5 text-xs font-bold text-emerald-100 hover:border-amber-400 hover:text-amber-200 transition whitespace-nowrap"
              title="Open Choy Card Game GitHub Repository"
            >
              <GitBranch className="h-3.5 w-3.5 text-amber-300" />
              <span className="hidden md:inline">GitHub</span>
            </a>
          )}

          {renderUrl && (
            <a
              href={renderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-sky-500/60 bg-sky-950/50 px-2.5 py-1.5 text-xs font-bold text-sky-200 hover:border-sky-300 hover:text-white transition whitespace-nowrap"
              title="Open Render Deploy Project"
            >
              <Rocket className="h-3.5 w-3.5 text-sky-300" />
              <span className="hidden md:inline">Render</span>
            </a>
          )}

          {builderUrl ? (
            <a
              href={builderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-1.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 transition whitespace-nowrap"
              title="Open your saved direct builder/editor workspace link"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Editor</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRightTab('deploy');
                setMobilePane('workspace');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/60 bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-400/25 cursor-pointer whitespace-nowrap"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Setup Links</span>
              <span className="sm:hidden">Links</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            title="Secret PIN, GitHub Repo & Render Link Settings"
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

      {/* Mobile Pane Toggle (Chat vs Workspace) */}
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
          {rightTab === 'preview'
            ? 'Live Preview'
            : rightTab === 'code'
              ? 'All Code'
              : rightTab === 'deploy'
                ? 'GitHub & Render'
                : 'Data Analytics'}
        </button>
      </div>

      {/* Collapsible PIN, GitHub Repo, Render & Builder Link Settings Drawer */}
      {settingsOpen && (
        <form
          onSubmit={handleSaveSettings}
          className="border-b border-amber-400/40 bg-[#063026] px-4 py-3.5 shrink-0 space-y-3"
        >
          <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label className="flex items-center gap-1 text-[11px] font-bold text-amber-300 mb-1">
                <GitBranch className="h-3.5 w-3.5" />
                Choy Card Game GitHub Repo URL (Choy Repo Only)
              </label>
              <input
                type="url"
                value={githubRepoDraft}
                onChange={(e) => setGithubRepoDraft(e.target.value)}
                placeholder="https://github.com/yourname/choy-card-game"
                className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs text-white placeholder-emerald-500 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-emerald-200 mb-1">
                Git Branch
              </label>
              <input
                type="text"
                value={githubBranchDraft}
                onChange={(e) => setGithubBranchDraft(e.target.value)}
                placeholder="main"
                className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs font-mono-num text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="md:col-span-5">
              <label className="flex items-center gap-1 text-[11px] font-bold text-sky-300 mb-1">
                <Rocket className="h-3.5 w-3.5" />
                Render Deploy Project Link
              </label>
              <input
                type="url"
                value={renderUrlDraft}
                onChange={(e) => setRenderUrlDraft(e.target.value)}
                placeholder="https://dashboard.render.com/web/srv-... or https://your-app.onrender.com"
                className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs text-white placeholder-emerald-500 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label className="flex items-center gap-1 text-[11px] font-bold text-emerald-200 mb-1">
                <Link2 className="h-3.5 w-3.5" />
                Direct Builder / Project Editor Bookmark URL (Optional)
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
                New Secret PIN
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
                {savingSettings ? 'Saving...' : 'Save All Settings'}
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
            <p className="mx-auto max-w-6xl text-xs font-semibold text-amber-300">
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
              'Update weekly prizes to Top 1 ₱5000, Top 2 ₱2500, Top 3 ₱1000',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={chatBusy}
                onClick={() => handleSendChat(chip)}
                className="rounded-lg border border-emerald-800 bg-[#052920] px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:border-amber-400 hover:text-amber-200 disabled:opacity-50 cursor-pointer"
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
                    : msg.isError
                      ? 'mr-3 border border-red-500/60 bg-red-950/50 text-red-100'
                      : 'mr-3 border border-emerald-800/90 bg-[#052920] text-emerald-50'
                }`}
              >
                {msg.isError && (
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-red-300">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Builder AI Notice
                  </div>
                )}
                {msg.appliedUpdates && msg.appliedUpdates.length > 0 && (
                  <div className="mb-2 rounded-xl border border-emerald-400/50 bg-emerald-950/80 p-2 text-[11px] text-emerald-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-extrabold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Live Update Applied (Preview Reloaded)
                    </div>
                    {msg.appliedUpdates.map((item, idx) => (
                      <div key={idx} className="pl-5 text-[10px] text-emerald-100">
                        • {item}
                      </div>
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words font-sans">{msg.text}</div>
                <div className="mt-2 flex items-center justify-end gap-1.5 opacity-90">
                  {msg.isError && msg.retryPrompt && (
                    <button
                      type="button"
                      disabled={chatBusy}
                      onClick={() => handleSendChat(msg.retryPrompt)}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </button>
                  )}
                  {msg.role === 'model' && !msg.isError && (
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
              <div className="mr-3 flex items-center justify-between gap-2 rounded-2xl border border-amber-400/50 bg-[#052920] px-3.5 py-2.5 text-xs text-amber-300">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>
                    Builder AI processing{chatElapsedSec > 0 ? ` (${chatElapsedSec}s)` : '...'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleStopChat}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-400/60 bg-red-950/70 px-2 py-1 text-[10px] font-bold text-red-200 hover:bg-red-900 cursor-pointer"
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  Stop
                </button>
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
              placeholder="Type a live update, analytics question, or code task..."
              className="flex-1 resize-none rounded-xl border border-emerald-700 bg-[#021611] px-3 py-2 text-xs text-white placeholder-emerald-400/70 focus:border-amber-400 focus:outline-none"
            />
            {chatBusy ? (
              <button
                type="button"
                onClick={handleStopChat}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white hover:bg-red-400 cursor-pointer"
                aria-label="Stop Builder AI request"
                title="Stop request"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-emerald-950 hover:bg-amber-300 disabled:opacity-45 cursor-pointer"
                aria-label="Send to Builder AI"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      {fileSaveNotice && (
                        <div className="inline-flex items-center gap-1.5 mr-1">
                          <span className="text-[11px] font-bold text-emerald-300">
                            {fileSaveNotice}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setRightTab('deploy');
                              loadDeployStatus();
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer"
                          >
                            <GitCommitHorizontal className="h-3 w-3" />
                            Commit
                          </button>
                        </div>
                      )}
                      {editingFile ? (
                        <>
                          <button
                            type="button"
                            disabled={savingFile}
                            onClick={handleSaveFile}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950 hover:bg-emerald-300 disabled:opacity-50 cursor-pointer"
                          >
                            <Save className="h-3 w-3" />
                            {savingFile ? 'Saving...' : 'Save File'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFile(false);
                              setFileDraft(selectedFileContent);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-700 bg-[#031c16] px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setFileDraft(selectedFileContent);
                            setEditingFile(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-[#052920] px-2.5 py-1 text-[11px] font-bold text-emerald-100 hover:border-amber-400 cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                      )}
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
                        Ask AI
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copyTextReliable(editingFile ? fileDraft : selectedFileContent);
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
                    editingFile ? (
                      <textarea
                        value={fileDraft}
                        onChange={(e) => setFileDraft(e.target.value)}
                        spellCheck={false}
                        className="h-full min-h-[420px] w-full resize-none rounded-xl border border-amber-400/60 bg-[#02140f] p-3 font-mono-num text-[11px] leading-5 text-emerald-50 focus:outline-none"
                      />
                    ) : (
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
                    )
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-emerald-400 gap-2 p-6">
                      <Code2 className="h-10 w-10 text-amber-400/70" />
                      <p className="text-xs max-w-xs">
                        Browse and edit all {files.length} source files of Choy Card Game (`server.ts`, `server/db.ts`, `src/components/*`, PWA manifest, and more).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GITHUB SYNC (CHOY REPO ONLY) & RENDER DEPLOY */}
          {rightTab === 'deploy' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-extrabold text-white flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-amber-400" />
                    GitHub Sync &amp; Render Deploy Hub
                  </h2>
                  <p className="text-[11px] text-emerald-300">
                    Locked exclusively to the <strong className="text-amber-300">Choy Card Game</strong> repository · Edit in All Code → Commit Changes → Upgrade on Render
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadDeployStatus}
                  disabled={loadingDeploy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700 bg-[#052920] px-3 py-1.5 text-xs font-bold text-emerald-100 hover:border-amber-400 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingDeploy ? 'animate-spin' : ''}`} />
                  Refresh Sync
                </button>
              </div>

              {/* Feedback Banner */}
              {deployFeedback && (
                <div
                  className={`rounded-2xl border p-3.5 text-xs flex flex-wrap items-center justify-between gap-2 ${
                    deployFeedback.type === 'ok'
                      ? 'border-emerald-400/60 bg-emerald-950/70 text-emerald-100'
                      : 'border-red-400/60 bg-red-950/60 text-red-100'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {deployFeedback.type === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-300 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{deployFeedback.text}</span>
                  </div>
                  {deployFeedback.commitUrl && (
                    <a
                      href={deployFeedback.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950 hover:bg-amber-300 shrink-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Commit {deployFeedback.shortSha || 'View'}
                    </a>
                  )}
                </div>
              )}

              {/* Card 1: Choy Card Game Repo & Render Links */}
              <form
                onSubmit={handleSaveSettings}
                className="rounded-2xl border border-emerald-800 bg-[#052920] p-4 space-y-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                    <h3 className="font-display text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      Choy Card Game Repo &amp; Render Links
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span
                      className={`rounded-md px-2 py-0.5 border ${
                        hasGithubToken
                          ? 'border-emerald-400/50 bg-emerald-950 text-emerald-300'
                          : 'border-amber-400/40 bg-amber-950/50 text-amber-200'
                      }`}
                    >
                      {hasGithubToken ? 'GitHub Sync Token: Ready' : 'Set GITHUB_TOKEN on Render'}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 border ${
                        hasRenderDeployHook
                          ? 'border-sky-400/50 bg-sky-950 text-sky-300'
                          : 'border-emerald-700 bg-[#031c16] text-emerald-300'
                      }`}
                    >
                      {hasRenderDeployHook ? 'Render Deploy Hook: Ready' : 'Deploy Hook Optional'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-6">
                    <label className="block text-[11px] font-bold text-emerald-200 mb-1">
                      GitHub Repository URL (Choy Card Game Only)
                    </label>
                    <input
                      type="url"
                      value={githubRepoDraft}
                      onChange={(e) => setGithubRepoDraft(e.target.value)}
                      placeholder="https://github.com/yourname/choy-card-game"
                      className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs text-white placeholder-emerald-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-emerald-200 mb-1">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={githubBranchDraft}
                      onChange={(e) => setGithubBranchDraft(e.target.value)}
                      placeholder="main"
                      className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs font-mono-num text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-bold text-sky-300 mb-1">
                      Render Deploy Project Link
                    </label>
                    <input
                      type="url"
                      value={renderUrlDraft}
                      onChange={(e) => setRenderUrlDraft(e.target.value)}
                      placeholder="https://dashboard.render.com/web/..."
                      className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs text-white placeholder-emerald-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingSettings ? 'Saving...' : 'Save Links'}
                  </button>

                  {githubRepoUrl && (
                    <a
                      href={githubRepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-[#031c16] px-3.5 py-2 text-xs font-bold text-emerald-100 hover:border-amber-400 hover:text-amber-200"
                    >
                      <GitBranch className="h-3.5 w-3.5 text-amber-300" />
                      Open Choy GitHub Repo
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {renderUrl && (
                    <a
                      href={renderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/70 bg-sky-950/60 px-3.5 py-2 text-xs font-bold text-sky-200 hover:border-sky-300 hover:text-white"
                    >
                      <Rocket className="h-3.5 w-3.5 text-sky-300" />
                      Open Render Project
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleTriggerRenderDeploy}
                    disabled={triggeringRender}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
                  >
                    <Rocket className={`h-3.5 w-3.5 ${triggeringRender ? 'animate-bounce' : ''}`} />
                    {triggeringRender ? 'Deploying...' : 'Trigger Render Deploy'}
                  </button>
                </div>

                {settingsStatus && (
                  <p className="text-xs font-semibold text-amber-300">{settingsStatus}</p>
                )}
              </form>

              {/* Card 2: Commit Changes & Sync to GitHub (Choy Card Game Only) */}
              <div className="rounded-2xl border border-emerald-800 bg-[#052920] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <GitCommitHorizontal className="h-4 w-4" />
                      Commit Changes to Choy Card Game Repo
                    </h3>
                    <p className="text-[11px] text-emerald-300 mt-0.5">
                      Files edited in <strong className="text-white">All Code</strong> are automatically staged here, or pick any project file below.
                    </p>
                  </div>
                  {(deployStatus?.pendingChanges?.length || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => handleStageAction('clear')}
                      className="rounded-lg border border-red-400/50 bg-red-950/50 px-2.5 py-1 text-[11px] font-bold text-red-200 hover:bg-red-900/60 cursor-pointer"
                    >
                      Clear Staged ({deployStatus?.pendingChanges.length})
                    </button>
                  )}
                </div>

                {/* Add Any Project File to Stage */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={stageSelectPath}
                    onChange={(e) => setStageSelectPath(e.target.value)}
                    className="flex-1 min-w-[200px] rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs font-mono-num text-emerald-100 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="">+ Stage a source file for commit...</option>
                    {files.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.path} ({f.lines}L)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!stageSelectPath}
                    onClick={() => handleStageAction('stage', stageSelectPath)}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-400/70 bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/25 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Stage File
                  </button>
                </div>

                {/* Staged Files List */}
                <div className="rounded-xl border border-emerald-800/90 bg-[#031c16] p-3 space-y-1.5">
                  <div className="text-[11px] font-bold text-emerald-300">
                    Staged Files Ready to Commit ({deployStatus?.pendingChanges?.length || 0})
                  </div>
                  {deployStatus?.pendingChanges && deployStatus.pendingChanges.length > 0 ? (
                    <div className="space-y-1.5">
                      {deployStatus.pendingChanges.map((item) => (
                        <div
                          key={item.file_path}
                          className="flex items-center justify-between gap-2 rounded-lg border border-emerald-800 bg-[#052920] px-2.5 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCode2 className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                            <span className="font-mono-num text-emerald-100 truncate">
                              {item.file_path}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                openFile(item.file_path);
                                setRightTab('code');
                              }}
                              className="text-[10px] font-bold text-amber-300 hover:underline cursor-pointer"
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStageAction('unstage', item.file_path)}
                              className="rounded p-0.5 text-red-300 hover:bg-red-950 cursor-pointer"
                              title="Remove from staged list"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-emerald-500">
                      No staged files yet. Edit and save any file in <strong className="text-emerald-300">All Code</strong> or select a file above.
                    </p>
                  )}
                </div>

                {/* Commit Message + Push Button */}
                <form onSubmit={handleCommitGithub} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-200 mb-1">
                      Commit Message
                    </label>
                    <input
                      type="text"
                      maxLength={200}
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="e.g. Upgrade Choy Card Game slot payout & lobby UI"
                      className="w-full rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2.5 text-xs text-white placeholder-emerald-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-emerald-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={triggerRenderOnCommit}
                        disabled={!hasRenderDeployHook}
                        onChange={(e) => setTriggerRenderOnCommit(e.target.checked)}
                        className="h-4 w-4 rounded border-emerald-600 accent-amber-400"
                      />
                      <span className={!hasRenderDeployHook ? 'opacity-60' : ''}>
                        Auto-trigger Render Deploy after commit
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={
                        committingGithub ||
                        !githubRepoUrl ||
                        !commitMessage.trim() ||
                        (deployStatus?.pendingChanges?.length || 0) === 0
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-300 disabled:opacity-45 cursor-pointer"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {committingGithub
                        ? 'Committing & Syncing...'
                        : `Commit & Sync to ${deployStatus?.githubOwnerRepo || 'Choy Repo'} (${githubBranch})`}
                    </button>
                  </div>
                </form>
              </div>

              {/* Card 3: Recent Commits on Choy Card Game Repo */}
              <div className="rounded-2xl border border-emerald-800 bg-[#052920] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Recent Commits ({deployStatus?.githubOwnerRepo || 'Not Linked Yet'} · {githubBranch})
                  </h3>
                  {githubRepoUrl && (
                    <a
                      href={`${githubRepoUrl}/commits/${encodeURIComponent(githubBranch)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:underline"
                    >
                      All Commits <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {deployStatus?.commitsError && (
                  <p className="rounded-xl border border-amber-400/40 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200">
                    {deployStatus.commitsError}
                  </p>
                )}

                {deployStatus?.recentCommits && deployStatus.recentCommits.length > 0 ? (
                  <div className="divide-y divide-emerald-800/70 rounded-xl border border-emerald-800 bg-[#031c16]">
                    {deployStatus.recentCommits.map((c) => (
                      <a
                        key={c.sha}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-emerald-900/30 transition"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{c.message}</p>
                          <p className="text-[10px] text-emerald-400">
                            {c.author} · {c.date ? new Date(c.date).toLocaleString() : ''}
                          </p>
                        </div>
                        <span className="rounded-md border border-emerald-700 bg-[#052920] px-2 py-0.5 font-mono-num text-[11px] font-bold text-amber-300 shrink-0">
                          {c.shortSha}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400">
                    {githubRepoUrl
                      ? 'No commits loaded yet — tap Refresh Sync or verify your branch name and repository access.'
                      : 'Paste your Choy Card Game GitHub Repository link above and click Save Links to view recent commits and enable Commit & Sync.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LIVE DATA ANALYTICS */}
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
