import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, TOKEN_STORAGE_KEY } from '../services/api';
import { Lang, translations } from '../utils/i18n';

export type UserRole = 'patient' | 'dietitian' | 'chef' | 'delivery' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  isActive: boolean;
  isVerifiedByAdmin: boolean;
  preferredLanguage: Lang;
  referralCode: string;
  loyaltyPoints: number;
}

export interface CartItem {
  mealId: string;
  name: string;
  priceInr: number;
  imageUrl: string;
  portionSize: string;
  calories: number;
  sodium: number;
  quantity: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextValue {
  user: AuthUser | null;
  authLoading: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  loginWithCredentials: (email: string, password: string) => Promise<AuthUser>;
  registerAccount: (payload: Record<string, string>) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  updateCartQty: (mealId: string, qty: number) => void;
  clearCart: () => void;
  toasts: ToastMessage[];
  pushToast: (title: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  realtimeTick: number;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const CART_KEY = 'nutrisync_cart_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>('en');
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [realtimeTick, setRealtimeTick] = useState(0);

  const pushToast = useCallback((title: string, type: ToastMessage['type'] = 'info') => {
    const id = `tst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      if (data.user?.preferredLanguage) {
        setLangState(data.user.preferredLanguage);
      }
    } catch {
      setUser(null);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Persist shopping cart
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  // Connect real-time Socket.IO room updates when authenticated
  useEffect(() => {
    if (!user) return;
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const socket: Socket = io({
      withCredentials: true,
      auth: token ? { token } : undefined,
    });

    const bump = () => setRealtimeTick((n) => n + 1);

    socket.on('order:updated', (order: { orderNumber?: string; status?: string }) => {
      bump();
      if (order?.orderNumber && order?.status) {
        pushToast(
          `Order ${order.orderNumber} is now ${order.status.replace(/_/g, ' ')}`,
          'info'
        );
      }
    });

    socket.on('order:incoming', (payload: { orderNumber?: string }) => {
      bump();
      pushToast(`New incoming clinical order ${payload?.orderNumber || ''}`, 'info');
    });

    socket.on('delivery:ready', (payload: { orderNumber?: string }) => {
      bump();
      pushToast(`Order ${payload?.orderNumber || ''} verified & ready for pickup`, 'success');
    });

    socket.on('notification:new', (notif: { title?: string }) => {
      bump();
      if (notif?.title) {
        pushToast(notif.title, 'info');
      }
    });

    socket.on('prescription:uploaded', () => bump());
    socket.on('mealplan:draft_created', () => bump());
    socket.on('subscription:updated', () => bump());

    return () => {
      socket.disconnect();
    };
  }, [user, pushToast]);

  const loginWithCredentials = async (email: string, password: string): Promise<AuthUser> => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    }
    setUser(data.user);
    if (data.user?.preferredLanguage) {
      setLangState(data.user.preferredLanguage);
    }
    pushToast(`Signed in as ${data.user.name}`, 'success');
    return data.user;
  };

  const registerAccount = async (payload: Record<string, string>): Promise<AuthUser> => {
    const { data } = await api.post('/auth/register', payload);
    if (data.token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    }
    setUser(data.user);
    pushToast('Account created successfully', 'success');
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network error on signout
    }
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    pushToast('Signed out', 'info');
  };

  const setLang = (l: Lang) => {
    setLangState(l);
    if (user) {
      void api.put('/auth/profile', { preferredLanguage: l });
    }
  };

  const t = (key: string): string => translations[lang][key] || translations.en[key] || key;

  const addToCart = (item: Omit<CartItem, 'quantity'>, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.mealId === item.mealId);
      if (existing) {
        return prev.map((c) =>
          c.mealId === item.mealId ? { ...c, quantity: c.quantity + qty } : c
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
    pushToast(`Added "${item.name}" to your tray`, 'success');
  };

  const updateCartQty = (mealId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.mealId !== mealId));
    } else {
      setCart((prev) => prev.map((c) => (c.mealId === mealId ? { ...c, quantity: qty } : c)));
    }
  };

  const clearCart = () => setCart([]);

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        lang,
        setLang,
        t,
        loginWithCredentials,
        registerAccount,
        logout,
        refreshUser,
        cart,
        addToCart,
        updateCartQty,
        clearCart,
        toasts,
        pushToast,
        dismissToast,
        realtimeTick,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
