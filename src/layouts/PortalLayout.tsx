import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Info,
  ShoppingBag,
  ArrowUpRight,
} from 'lucide-react';
import { useApp, UserRole } from '../context/AppContext';
import { PWAInstallButton, OfflineIndicator } from '../components/PWAWidgets';

export interface PortalNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

interface PortalLayoutProps {
  roleTitle: string;
  subtitle: string;
  navItems: PortalNavItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

const DEMO_SWITCH_ACCOUNTS: { role: UserRole; label: string; email: string; path: string }[] = [
  { role: 'patient', label: 'Patient', email: 'patient@nutrisync.demo', path: '/portal/patient' },
  { role: 'dietitian', label: 'Dietitian', email: 'dietitian@nutrisync.demo', path: '/portal/dietitian' },
  { role: 'chef', label: 'Kitchen', email: 'chef@nutrisync.demo', path: '/portal/kitchen' },
  { role: 'delivery', label: 'Delivery', email: 'delivery@nutrisync.demo', path: '/portal/delivery' },
  { role: 'admin', label: 'Admin', email: 'admin@nutrisync.demo', path: '/portal/admin' },
];

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  roleTitle,
  subtitle,
  navItems,
  activeTab,
  onSelectTab,
  headerAction,
  children,
}) => {
  const {
    user,
    lang,
    setLang,
    logout,
    loginWithCredentials,
    cart,
    toasts,
    dismissToast,
    pushToast,
  } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const navigate = useNavigate();

  const totalCartItems = cart.reduce((acc, c) => acc + c.quantity, 0);
  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label || 'Overview';

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const handleDemoSwitch = async (email: string, path: string) => {
    if (switchingRole) return;
    setSwitchingRole(true);
    try {
      await loginWithCredentials(email, 'Demo@1234');
      navigate(path);
    } catch {
      pushToast('Unable to switch demo role', 'error');
    } finally {
      setSwitchingRole(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Workspace Sidebar (256px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
            <Link to="/" className="text-base font-bold tracking-tight text-slate-900">
              NutriSync
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-500 hover:text-slate-900"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-emerald-700">{roleTitle}</p>
            <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
              {user?.name || 'Authenticated User'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>

          <nav className="p-3 space-y-1 flex-1">
            {navItems.map((item) => {
              const isActive = item.id === activeTab;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        isActive ? 'text-emerald-300' : 'text-slate-500'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Role Preview Switcher for Demo Evaluation */}
          <div className="px-4 py-3 border-t border-slate-100 space-y-2">
            <p className="text-[11px] font-medium text-slate-400">
              Switch Demo Workspace
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_SWITCH_ACCOUNTS.map((acct) => {
                const current = user?.role === acct.role;
                return (
                  <button
                    key={acct.role}
                    type="button"
                    disabled={current || switchingRole}
                    onClick={() => void handleDemoSwitch(acct.email, acct.path)}
                    className={`px-2 py-1.5 rounded-md text-[11px] font-medium text-left transition-colors ${
                      current
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                    }`}
                  >
                    {acct.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <Link
            to="/marketplace"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <span>Browse Meal Marketplace</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Context Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                <span>{roleTitle}</span>
                <span aria-hidden="true">/</span>
                <span className="font-semibold text-slate-900 truncate">{activeNavLabel}</span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {user?.role === 'patient' && (
              <button
                type="button"
                onClick={() => onSelectTab('checkout')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tray</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  ({totalCartItems})
                </span>
              </button>
            )}

            <div className="hidden sm:inline-flex items-center bg-slate-100 p-0.5 rounded-md">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 text-[11px] font-medium rounded ${
                  lang === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`px-2 py-1 text-[11px] font-medium rounded ${
                  lang === 'hi' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                हिं
              </button>
            </div>

            <PWAInstallButton />
            {headerAction}
          </div>
        </header>

        {/* Workspace Canvas */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Toast Stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((tst) => (
          <div
            key={tst.id}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-800 shadow-lg"
          >
            {tst.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {tst.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            {tst.type === 'info' && <Info className="w-4 h-4 text-slate-700 shrink-0" />}
            <span className="flex-1">{tst.title}</span>
            <button
              type="button"
              onClick={() => dismissToast(tst.id)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <OfflineIndicator />
    </div>
  );
};
