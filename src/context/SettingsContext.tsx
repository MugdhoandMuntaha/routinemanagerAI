'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { TRANSLATIONS, type Language } from '@/lib/translations';
import type { UserSettings } from '@/types';

type SettingsContextValue = {
  settings: UserSettings;
  customAccent: string | null;
  updateSettings: (data: Partial<UserSettings>) => Promise<void>;
  updateCustomAccent: (color: string | null) => void;
  loading: boolean;
  t: (key: string, variables?: Record<string, string | number>) => string;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const DEFAULT_SETTINGS: UserSettings = {
  user_id: '',
  theme: 'dark',
  week_start_day: 0,
  notification_minutes_before: 5,
  notification_sound: 'default',
  language: 'en',
  large_text_mode: false,
  onboarding_completed: false,
  created_at: '',
  updated_at: '',
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [customAccent, setCustomAccent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── 1. Load Settings ───
  const fetchSettings = useCallback(async () => {
    if (!user) {
      // Local fallback for anonymous/offline
      const saved = localStorage.getItem('routine_manager_local_settings');
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
        } catch (e) {
          setSettings(DEFAULT_SETTINGS);
        }
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Row doesn't exist yet, insert defaults
        const newSettings = { ...DEFAULT_SETTINGS, user_id: user.id };
        const { data: inserted, error: insertErr } = await supabase
          .from('user_settings')
          .insert(newSettings)
          .select()
          .single();

        if (!insertErr && inserted) {
          setSettings(inserted);
        }
      } else if (!error && data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load custom accent from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAccent = localStorage.getItem('routine_manager_custom_accent');
      if (savedAccent) {
        setCustomAccent(savedAccent);
      }
    }
    fetchSettings();
  }, [fetchSettings]);

  // Realtime settings listener
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('settings-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSettings]);

  // ─── 2. Apply theme mode and accents to document ───
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Apply theme mode ('light' | 'dark' | 'amoled')
    const mode = settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme-mode', mode);

    // Apply custom accent variables if chosen
    if (customAccent) {
      document.documentElement.style.setProperty('--accent', customAccent);
      document.documentElement.style.setProperty('--accent-glow', `${customAccent}55`);
      document.documentElement.style.setProperty('--accent-ghost', `${customAccent}12`);
      document.documentElement.style.setProperty('--gradient-accent', `linear-gradient(135deg, ${customAccent} 0%, ${customAccent}cc 100%)`);
    } else {
      // Remove inline properties to let the core theme preset variables flow back
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-glow');
      document.documentElement.style.removeProperty('--accent-ghost');
      document.documentElement.style.removeProperty('--gradient-accent');
    }
  }, [settings.theme, customAccent]);

  // ─── 3. Update Settings ───
  const updateSettings = useCallback(async (data: Partial<UserSettings>) => {
    // Pessimistic state update
    const updated = { ...settings, ...data };
    setSettings(updated);

    if (!user) {
      localStorage.setItem('routine_manager_local_settings', JSON.stringify(updated));
      return;
    }

    try {
      const { error } = await supabase
        .from('user_settings')
        .update(data)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update remote settings, rolling back locally:', err);
      // Rollback
      fetchSettings();
    }
  }, [user, settings, fetchSettings]);

  const updateCustomAccent = useCallback((color: string | null) => {
    setCustomAccent(color);
    if (color) {
      localStorage.setItem('routine_manager_custom_accent', color);
    } else {
      localStorage.removeItem('routine_manager_custom_accent');
    }
  }, []);

  // ─── 4. Translation Translator ───
  const t = useCallback((key: string, variables?: Record<string, string | number>) => {
    const lang = (settings.language as Language) || 'en';
    let str = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en']?.[key] || key;

    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        str = str.replace(`{{${k}}}`, String(v));
      });
    }
    return str;
  }, [settings.language]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        customAccent,
        updateSettings,
        updateCustomAccent,
        loading,
        t,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
