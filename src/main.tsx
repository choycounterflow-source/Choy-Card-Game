import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AudioProvider } from './contexts/AudioContext.tsx';
import './index.css';

// Register our clean installable PWA service worker and remove any legacy broken dev-sw registrations
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
          if (scriptUrl && !scriptUrl.includes('/pwa-sw.js')) {
            reg.unregister().catch(() => {});
          }
        }
        return navigator.serviceWorker.register('/pwa-sw.js', { scope: '/' });
      })
      .catch(() => {});
  });
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected display error.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#031c16] text-emerald-50 flex items-center justify-center p-6">
          <div className="max-w-sm w-full rounded-2xl border border-emerald-700/70 bg-[#052920] p-6 text-center shadow-2xl space-y-4">
            <h1 className="text-lg font-bold text-amber-300">Choy Card Game</h1>
            <p className="text-xs text-emerald-200/80">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-emerald-950 hover:bg-amber-300 cursor-pointer"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <AudioProvider>
      <App />
    </AudioProvider>
  </RootErrorBoundary>
);
