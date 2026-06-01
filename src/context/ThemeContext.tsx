'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type ThemeId = 'midnight' | 'aurora' | 'sunset' | 'ocean' | 'rose' | 'slate' | 'cyberpunk' | 'notebook';

export type ThemeInfo = {
  id: ThemeId;
  name: string;
  emoji: string;
  preview: [string, string, string]; // 3 colors for the preview dots
};

export const THEMES: ThemeInfo[] = [
  { id: 'midnight',  name: 'Midnight',  emoji: '🌙', preview: ['#6366f1', '#8b5cf6', '#a78bfa'] },
  { id: 'aurora',    name: 'Aurora',    emoji: '🌌', preview: ['#10b981', '#06b6d4', '#34d399'] },
  { id: 'sunset',    name: 'Sunset',    emoji: '🌅', preview: ['#f97316', '#f43f5e', '#fbbf24'] },
  { id: 'ocean',     name: 'Ocean',     emoji: '🌊', preview: ['#0ea5e9', '#3b82f6', '#6366f1'] },
  { id: 'rose',      name: 'Rosé',      emoji: '🌸', preview: ['#ec4899', '#f472b6', '#e879f9'] },
  { id: 'slate',     name: 'Minimal',   emoji: '🪨', preview: ['#64748b', '#94a3b8', '#475569'] },
  { id: 'cyberpunk', name: 'Cyberpunk', emoji: '⚡', preview: ['#22d3ee', '#f0abfc', '#a3e635'] },
  { id: 'notebook',  name: 'Notebook',  emoji: '📓', preview: ['#2b6cb0', '#fdfbf7', '#f43f5e'] },
];

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  themeInfo: ThemeInfo;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'routine_manager_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('midnight');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (saved && THEMES.find((t) => t.id === saved)) {
      setThemeState(saved);
    }
    setLoaded(true);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    localStorage.setItem(STORAGE_KEY, id);
    document.documentElement.setAttribute('data-theme', id);
  }, []);

  useEffect(() => {
    if (loaded) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, loaded]);

  const themeInfo = THEMES.find((t) => t.id === theme)!;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeInfo }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
