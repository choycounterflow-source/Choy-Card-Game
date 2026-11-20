import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Rocket,
   XCircle,
} from 'lucide-react';

interface DeployItem {
  id: string;
  status: 'live' | 'build_failed' | 'update' | 'canceled' | 'created';
  commitMessage?: string;
  commitSha?: string;
  createdAt: string;
  finishedAt?: string;
  trigger?: string;
  url?: string;
}

interface DeploymentHistoryProps {
  adminId: string;
  renderUrl?: string;
}

export const DeploymentHistory: React.FC<DeploymentHistoryProps> = ({ adminId, renderUrl }) => {
  const [deploys, setDeploys] = useState<DeployItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasRenderApiKey, setHasRenderApiKey] = useState(false);

  const fetchDeployHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/secret-studio/render/history?adminId=${encodeURIComponent(adminId)}`, {
        headers: { 'x-admin-id': adminId },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load deployment history.');
      } else {
        setDeploys(Array.isArray(data.deploys) ? data.deploys : []);
        setHasRenderApiKey(Boolean(data.hasRenderApiKey));
      }
    } catch {
      setError('Network error fetching deployment history.');
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    fetchDeployHistory();
  }, [fetchDeployHistory]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-950 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Success (Live)
          </span>
        );
      case 'build_failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-400/50 bg-red-950 px-2.5 py-0.5 text-[11px] font-extrabold text-red-300">
            <XCircle className="h-3.5 w-3.5 text-red-400" />
            Build Failed
          </span>
        );
      case 'canceled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-950 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            Canceled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/50 bg-sky-950 px-2.5 py-0.5 text-[11px] font-extrabold text-sky-300">
            <Clock className="h-3.5 w-3.5 text-sky-400 animate-spin" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-800 bg-[#052920] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Rocket className="h-4 w-4 text-sky-400" />
            Render Deployment History (Last 5 Builds)
          </h3>
          <p className="text-[11px] text-emerald-300 mt-0.5">
            {hasRenderApiKey
              ? 'Fetched live from Render Deployments API'
              : 'Add RENDER_API_KEY in Render Environment Variables for live deploy logs'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {renderUrl && (
            <a
              href={renderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/60 bg-sky-950/60 px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:text-white"
            >
              <ExternalLink className="h-3 w-3" />
              Render Dashboard
            </a>
          )}
          <button
            type="button"
            onClick={fetchDeployHistory}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-700 bg-[#031c16] px-2.5 py-1 text-[11px] font-bold text-emerald-100 hover:border-amber-400 cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200">
          {error}
        </p>
      )}

      {deploys.length > 0 ? (
        <div className="divide-y divide-emerald-800/80 rounded-xl border border-emerald-800 bg-[#031c16]">
          {deploys.slice(0, 5).map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  {getStatusBadge(d.status)}
                  <span className="font-mono-num text-xs font-bold text-white truncate max-w-[280px]">
                    {d.commitMessage || 'Choy Card Game Build'}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400 font-mono-num">
                  ID: {d.id} · Triggered: {new Date(d.createdAt).toLocaleString()} {d.commitSha ? `· Commit ${d.commitSha.slice(0, 7)}` : ''}
                </p>
              </div>
              {d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-[10px] font-extrabold text-emerald-950 hover:bg-amber-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Build
                </a>
              ) : (
                <span className="text-[10px] text-emerald-500 font-mono-num">Render Hook</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-800 bg-[#031c16] p-4 text-center text-xs text-emerald-300 space-y-1">
          <p>No deployment history records found or RENDER_API_KEY is not configured.</p>
          <p className="text-[10px] text-emerald-500">
            Render Deploy Hook triggers builds successfully. Add <strong className="text-amber-300">RENDER_API_KEY</strong> in Render Environment Variables to view live build logs here.
          </p>
        </div>
      )}
    </div>
  );
};
