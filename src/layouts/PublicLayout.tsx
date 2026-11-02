import React, { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton, OfflineIndicator } from '../components/PWAWidgets';
import { MealImage } from '../components/MealImage';

export const PublicLayout: React.FC = () => {
  const { user, lang, setLang, t, cart, updateCartQty, toasts, dismissToast } = useApp();
  const [cartOpen, setCartOpen] = useState(false);
  const navigate = useNavigate();

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const subtotalInr = cart.reduce((sum, c) => sum + c.priceInr * c.quantity, 0);

  const getPortalRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'dietitian':
        return '/portal/dietitian';
      case 'chef':
        return '/portal/kitchen';
      case 'delivery':
        return '/portal/delivery';
      case 'admin':
        return '/portal/admin';
      default:
        return '/portal/patient';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Single text element wordmark */}
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            NutriSync
          </Link>

          {/* Zone 2: 5 concise single-line text links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <Link to="/marketplace" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              {t('marketplace')}
            </Link>
            <Link to="/how-it-works" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              {t('howItWorks')}
            </Link>
            <Link to="/dietitians" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              {t('dietitians')}
            </Link>
            <Link to="/pricing" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              {t('pricing')}
            </Link>
            <Link to="/about" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              {t('about')}
            </Link>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <Link
              to={user ? getPortalRoute() : '/login'}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              {user ? t('dashboard') : t('signIn')}
            </Link>
          </div>
        </div>
      </header>

      {/* Secondary Utility Strip below header for Cart, Language & Mobile Nav */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6 py-2 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-4 overflow-x-auto md:hidden">
            <Link to="/marketplace" className="hover:text-slate-900 whitespace-nowrap shrink-0">{t('marketplace')}</Link>
            <Link to="/how-it-works" className="hover:text-slate-900 whitespace-nowrap shrink-0">{t('howItWorks')}</Link>
            <Link to="/dietitians" className="hover:text-slate-900 whitespace-nowrap shrink-0">{t('dietitians')}</Link>
            <Link to="/pricing" className="hover:text-slate-900 whitespace-nowrap shrink-0">{t('pricing')}</Link>
          </div>
          <p className="hidden md:block text-slate-500">
            {t('tagline')}
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-md">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  lang === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  lang === 'hi' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिंदी
              </button>
            </div>

            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('cart')} ({totalItems})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Slide-over Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div className="w-full max-w-md bg-white h-full flex flex-col border-l border-slate-200 shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Your Clinical Meal Tray</h2>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Close tray"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-slate-600">Your meal tray is currently empty.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCartOpen(false);
                      navigate('/marketplace');
                    }}
                    className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                  >
                    Browse Verified Meals
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.mealId}
                    className="flex items-start gap-3 pb-4 border-b border-slate-100"
                  >
                    <MealImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                        {item.calories} kcal · {item.sodium}mg Na · ₹{item.priceInr}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.mealId, item.quantity - 1)}
                          className="w-7 h-7 rounded border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                        >
                          -
                        </button>
                        <span className="text-xs font-mono tabular-nums w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.mealId, item.quantity + 1)}
                          className="w-7 h-7 rounded border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.mealId, 0)}
                          className="ml-auto text-slate-400 hover:text-red-600 p-1"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    ₹{subtotalInr}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    if (!user) {
                      navigate('/login?redirect=/portal/patient?tab=checkout');
                    } else {
                      navigate('/portal/patient?tab=checkout');
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Proceed to Verified Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notifications */}
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

      {/* Quiet Clinical Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
          <div className="space-y-3">
            <p className="font-bold text-slate-900 text-base">NutriSync</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your Health. Your Nutrition. Your Personalized Plate. Clinical nutrition plans reviewed by Registered Dietitians and prepared in allergen-segregated kitchens.
            </p>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">Platform</p>
            <ul className="space-y-1.5">
              <li><Link to="/marketplace" className="hover:text-slate-900">Smart Meal Marketplace</Link></li>
              <li><Link to="/dietitians" className="hover:text-slate-900">Certified Dietitian Directory</Link></li>
              <li><Link to="/pricing" className="hover:text-slate-900">Meal Subscriptions</Link></li>
              <li><Link to="/nutrition-approach" className="hover:text-slate-900">Our Nutrition Approach</Link></li>
            </ul>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">Support & Governance</p>
            <ul className="space-y-1.5">
              <li><Link to="/how-it-works" className="hover:text-slate-900">How NutriSync Works</Link></li>
              <li><Link to="/faq" className="hover:text-slate-900">Frequently Asked Questions</Link></li>
              <li><Link to="/contact" className="hover:text-slate-900">Contact Clinical Care</Link></li>
              <li><Link to="/login" className="hover:text-slate-900">Partner & Clinician Sign In</Link></li>
            </ul>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">Medical & Legal</p>
            <ul className="space-y-1.5">
              <li><Link to="/privacy" className="hover:text-slate-900">Privacy & Health Data Policy</Link></li>
              <li><Link to="/terms" className="hover:text-slate-900">Terms & Medical Disclaimer</Link></li>
            </ul>
            <p className="text-[11px] text-slate-400 pt-2 leading-relaxed">
              AI tools never diagnose illness or alter medications. All therapeutic dietary limits require Registered Dietitian verification.
            </p>
          </div>
        </div>
        <div className="border-t border-slate-100 py-4 px-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} NutriSync Healthcare Nutrition Technologies. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
