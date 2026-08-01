import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        set({ user: data.user, token: data.token });
        return data;
      },

      register: async (email, password, name) => {
        const { data } = await api.post('/auth/register', { email, password, name });
        set({ user: data.user, token: data.token });
        return data;
      },

      logout: () => {
        set({ user: null, token: null });
      },

      updateUser: (updates) => {
        set((state) => ({ user: { ...state.user, ...updates } }));
      },
    }),
    {
      name: 'budgetquest-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
