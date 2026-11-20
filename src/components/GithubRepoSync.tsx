import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  RefreshCw,
   ShieldCheck,
  XCircle,
} from 'lucide-react';
import { copyTextReliable } from '../lib/shareUrl';

interface GithubRepoSyncProps {
  adminId: string;
  githubRepoUrl?: string;
  githubBranch?: string;
  githubOwnerRepo?: string;
  hasGithubToken: boolean;
  recentCommits: Array<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  }>;
  commitsError?: string;
  onRefresh: () => void;
  loading: boolean;
}

export const GithubRepoSync: React.FC<GithubRepoSyncProps> = ({
  githubRepoUrl,
  githubBranch = 'main',
  githubOwnerRepo,
  hasGithubToken,
  recentCommits,
  commitsError,
  onRefresh,
  loading,
}) => {
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const lastCommit = recentCommits && recentCommits.length > 0 ? recentCommits[0] : null;

  return (
    <div className="rounded-2xl border border-emerald-800 bg-[#052920] p-4 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-emerald-950 shadow">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-xs font-extrabold uppercase tracking-wider text-amber-300">
              GitHub Repository Sync
            </h3>
            <p className="text-[11px] text-emerald-300">
              {githubOwnerRepo ? `Connected to ${githubOwnerRepo}` : 'No Choy Card Game repository linked yet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold border ${
              hasGithubToken
                ? 'border-emerald-400/60 bg-emerald-950 text-emerald-300'
                : 'border-amber-400/60 bg-amber-950/70 text-amber-200'
            }`}
          >
            {hasGithubToken ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <XCircle className="h-3 w-3 text-amber-300" />}
            {hasGithubToken ? 'GITHUB_TOKEN Active' : 'Token Not Set'}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-700 bg-[#031c16] px-2.5 py-1 text-[11px] font-bold text-emerald-100 hover:border-amber-400 cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Sync GitHub
          </button>
        </div>
      </div>

      {commitsError && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200">
          {commitsError}
        </p>
      )}

      {/* Repo Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-800 bg-[#031c16] p-3">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">Current Branch</span>
          <strong className="font-mono-num text-xs font-extrabold text-amber-300 flex items-center gap-1">
            <GitBranch className="h-3.5 w-3.5" />
            {githubBranch || 'main'}
          </strong>
        </div>

        <div className="rounded-xl border border-emerald-800 bg-[#031c16] p-3">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">Last Commit Hash</span>
          {lastCommit ? (
            <div className="flex items-center justify-between gap-1">
              <strong className="font-mono-num text-xs font-extrabold text-white truncate">
                {lastCommit.shortSha}
              </strong>
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyTextReliable(lastCommit.sha);
                  if (ok) {
                    setCopiedSha(lastCommit.sha);
                    setTimeout(() => setCopiedSha(null), 1800);
                  }
                }}
                className="inline-flex items-center gap-1 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] text-emerald-200 hover:text-white cursor-pointer"
                title="Copy full commit SHA"
              >
                {copiedSha === lastCommit.sha ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedSha === lastCommit.sha ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <span className="font-mono-num text-xs text-emerald-500">No commits loaded</span>
          )}
        </div>

        <div className="rounded-xl border border-emerald-800 bg-[#031c16] p-3">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">Repository Access</span>
          <strong className="font-mono-num text-xs font-extrabold text-sky-300 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            {githubOwnerRepo ? 'Choy Repo Secured' : 'Unlinked'}
          </strong>
        </div>
      </div>

      {/* Last Commit Message Box */}
      {lastCommit ? (
        <div className="rounded-xl border border-emerald-800 bg-[#031c16] p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
              <GitCommitHorizontal className="h-3.5 w-3.5" />
              Latest Commit Message
            </span>
            <a
              href={lastCommit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:underline"
            >
              View on GitHub <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-xs font-semibold text-white leading-snug break-words">
            {lastCommit.message}
          </p>
          <p className="text-[10px] text-emerald-400 font-mono-num">
            Author: <strong className="text-emerald-200">{lastCommit.author}</strong> · Date:{' '}
            {lastCommit.date ? new Date(lastCommit.date).toLocaleString() : 'N/A'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-800 bg-[#031c16] p-4 text-center text-xs text-emerald-400">
          {githubRepoUrl
            ? 'Linking repository and verifying GITHUB_TOKEN access...'
            : 'Enter your Choy Card Game repository URL in the settings above to start syncing with GitHub.'}
        </div>
      )}
    </div>
  );
};
