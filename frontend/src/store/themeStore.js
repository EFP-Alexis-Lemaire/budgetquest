import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'dark', // 'dark' | 'light' | 'auto'
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'budgetquest-theme' }
  )
);

// Hook pour appliquer le thème sur <html>
export function useApplyTheme() {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);
}
