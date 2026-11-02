import React, { useEffect, useState } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 text-emerald-600" />
        Install App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          Install on iOS
        </button>
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 border border-slate-200 shadow-lg">
              <h3 className="text-base font-semibold text-slate-900">Install NutriSync on iOS</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                1. Tap the <strong>Share</strong> icon in your Safari toolbar.<br />
                2. Select <strong>Add to Home Screen</strong> to launch NutriSync in standalone mode.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-md">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Offline Mode — Showing cached clinical meal data</span>
    </div>
  );
};
