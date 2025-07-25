import { create } from 'zustand';
import { User } from '../types';
import { tokenManager } from '../api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  login: (user: User, accessToken: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  login: async (user, accessToken, refreshToken) => {
    await tokenManager.setToken(accessToken);
    if (refreshToken) {
      await tokenManager.setRefreshToken(refreshToken);
    }
    set({ user, isAuthenticated: true, isLoading: false });
  },
  
  logout: async () => {
    await tokenManager.clearTokens();
    set({ user: null, isAuthenticated: false });
  },
  
  checkAuth: async () => {
    try {
      const token = await tokenManager.getToken();
      if (token) {
        // In a real app, you'd verify the token with the server
        // For now, just check if token exists
        set({ isAuthenticated: true, isLoading: false });
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));