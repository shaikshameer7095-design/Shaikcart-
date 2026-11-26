import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiRequest, getGuestCartToken, setAuthToken } from '../lib/api';
import type { CartState, Product, UserProfile, WishlistItem } from '../types';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface StoreContextValue {
  user: UserProfile | null;
  authLoading: boolean;
  cart: CartState;
  cartLoading: boolean;
  miniCartOpen: boolean;
  setMiniCartOpen: (open: boolean) => void;
  wishlist: WishlistItem[];
  wishlistIds: Set<number>;
  recentlyViewed: Product[];
  unreadNotifications: number;
  toasts: ToastMessage[];
  showToast: (text: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  refreshCart: () => Promise<void>;
  refreshWishlist: () => Promise<void>;
  refreshUser: () => Promise<void>;
  addToCart: (productId: number, quantity?: number, color?: string, size?: string, openDrawer?: boolean) => Promise<void>;
  updateCartQty: (cartItemId: number, quantity: number) => Promise<void>;
  removeCartItem: (cartItemId: number) => Promise<void>;
  toggleWishlist: (productId: number) => Promise<void>;
  recordRecentlyViewed: (product: Product) => void;
  signInWithGoogle: () => Promise<UserProfile | null>;
  setSessionUser: (token: string, profile: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const emptyCart: CartState = { items: [], subtotal: 0, totalMrp: 0, savings: 0, itemCount: 0 };

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cart, setCart] = useState<CartState>(emptyCart);
  const [cartLoading, setCartLoading] = useState(false);
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      setCartLoading(true);
      const data = await apiRequest<CartState>('/api/cart');
      setCart(data);
    } catch {
      // keep existing cart gracefully
    } finally {
      setCartLoading(false);
    }
  }, []);

  const refreshWishlist = useCallback(async () => {
    try {
      const data = await apiRequest<{ items: WishlistItem[] }>('/api/wishlist');
      setWishlist(data.items || []);
    } catch {
      setWishlist([]);
    }
  }, []);

  const refreshNotificationsCount = useCallback(async () => {
    try {
      const data = await apiRequest<{ stats: { unreadNotifications: number } }>('/api/account/overview');
      setUnreadNotifications(data.stats?.unreadNotifications || 0);
    } catch {
      setUnreadNotifications(0);
    }
  }, []);

  const mergeGuestCart = useCallback(async () => {
    try {
      await apiRequest('/api/cart/merge', {
        method: 'POST',
        body: JSON.stringify({ guestToken: getGuestCartToken() }),
      });
    } catch {
      // ignore if guest cart empty
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: UserProfile }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  // Sync Firebase Auth listener (for Google Sign-In sessions)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setAuthToken(idToken);
          const data = await apiRequest<{ user: UserProfile }>('/api/auth/firebase-sync', {
            method: 'POST',
          });
          setUser(data.user);
          await mergeGuestCart();
          await Promise.all([refreshCart(), refreshWishlist(), refreshNotificationsCount()]);
        } catch (err) {
          console.error('Firebase sync failed:', err);
        }
      } else {
        await refreshCart();
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [mergeGuestCart, refreshCart, refreshWishlist, refreshNotificationsCount]);

  const setSessionUser = useCallback(
    async (token: string, profile: UserProfile) => {
      setAuthToken(token);
      setUser(profile);
      await mergeGuestCart();
      await Promise.all([refreshCart(), refreshWishlist(), refreshNotificationsCount()]);
    },
    [mergeGuestCart, refreshCart, refreshWishlist, refreshNotificationsCount]
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setAuthToken(idToken);
      const data = await apiRequest<{ user: UserProfile }>('/api/auth/firebase-sync', {
        method: 'POST',
      });
      setUser(data.user);
      await mergeGuestCart();
      await Promise.all([refreshCart(), refreshWishlist(), refreshNotificationsCount()]);
      showToast(`Welcome back, ${data.user.fullName || data.user.email}`);
      return data.user;
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        showToast(err?.message || 'Google Sign-In failed. Please try again.', 'error');
      }
      return null;
    }
  }, [mergeGuestCart, refreshCart, refreshWishlist, refreshNotificationsCount, showToast]);

  const logout = useCallback(async () => {
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch {
      // ignore firebase signout error
    }
    setAuthToken(null);
    setUser(null);
    setWishlist([]);
    setUnreadNotifications(0);
    await refreshCart();
    showToast('Signed out cleanly.', 'info');
  }, [refreshCart, showToast]);

  const addToCart = useCallback(
    async (productId: number, quantity = 1, selectedColor = '', selectedSize = '', openDrawer = true) => {
      try {
        const data = await apiRequest<CartState>('/api/cart/items', {
          method: 'POST',
          body: JSON.stringify({ productId, quantity, selectedColor, selectedSize }),
        });
        setCart(data);
        showToast('Added to your shopping bag');
        if (openDrawer) setMiniCartOpen(true);
      } catch (err: any) {
        showToast(err?.message || 'Could not add item to bag.', 'error');
      }
    },
    [showToast]
  );

  const updateCartQty = useCallback(
    async (cartItemId: number, quantity: number) => {
      try {
        const data = await apiRequest<CartState>(`/api/cart/items/${cartItemId}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity }),
        });
        setCart(data);
      } catch (err: any) {
        showToast(err?.message || 'Unable to update quantity.', 'error');
      }
    },
    [showToast]
  );

  const removeCartItem = useCallback(
    async (cartItemId: number) => {
      try {
        const data = await apiRequest<CartState>(`/api/cart/items/${cartItemId}`, {
          method: 'DELETE',
        });
        setCart(data);
        showToast('Removed from bag', 'info');
      } catch (err: any) {
        showToast(err?.message || 'Unable to remove item.', 'error');
      }
    },
    [showToast]
  );

  const wishlistIds = new Set(wishlist.map((w) => w.productId));

  const toggleWishlist = useCallback(
    async (productId: number) => {
      if (!user) {
        showToast('Please sign in to save items to your Wishlist.', 'info');
        return;
      }
      try {
        if (wishlistIds.has(productId)) {
          await apiRequest(`/api/wishlist/${productId}`, { method: 'DELETE' });
          setWishlist((prev) => prev.filter((w) => w.productId !== productId));
          showToast('Removed from wishlist', 'info');
        } else {
          await apiRequest(`/api/wishlist/${productId}`, { method: 'POST' });
          await refreshWishlist();
          showToast('Saved to wishlist');
        }
      } catch (err: any) {
        showToast(err?.message || 'Wishlist update failed.', 'error');
      }
    },
    [user, wishlistIds, refreshWishlist, showToast]
  );

  const recordRecentlyViewed = useCallback((product: Product) => {
    setRecentlyViewed((prev) => [product, ...prev.filter((p) => p.id !== product.id)].slice(0, 8));
  }, []);

  return (
    <StoreContext.Provider
      value={{
        user,
        authLoading,
        cart,
        cartLoading,
        miniCartOpen,
        setMiniCartOpen,
        wishlist,
        wishlistIds,
        recentlyViewed,
        unreadNotifications,
        toasts,
        showToast,
        dismissToast,
        refreshCart,
        refreshWishlist,
        refreshUser,
        addToCart,
        updateCartQty,
        removeCartItem,
        toggleWishlist,
        recordRecentlyViewed,
        signInWithGoogle,
        setSessionUser,
        logout,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
