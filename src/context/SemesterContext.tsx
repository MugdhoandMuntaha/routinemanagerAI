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
import type { Semester } from '@/types';

type SemesterContextValue = {
  semesters: Semester[];
  activeSemester: Semester | null;
  loading: boolean;
  addSemester: (name: string) => Promise<void>;
  renameSemester: (id: string, name: string) => Promise<void>;
  deleteSemester: (id: string) => Promise<void>;
  switchSemester: (id: string) => Promise<void>;
};

const SemesterContext = createContext<SemesterContextValue | null>(null);

export function SemesterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);

  const activeSemester = semesters.find((s) => s.is_active) ?? null;

  // Fetch semesters
  const fetchSemesters = useCallback(async () => {
    if (!user) {
      setSemesters([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('semesters')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching semesters:', error);
    } else {
      setSemesters(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('semesters-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'semesters',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchSemesters();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSemesters]);

  const addSemester = useCallback(
    async (name: string) => {
      if (!user) return;

      const { error } = await supabase.from('semesters').insert({
        user_id: user.id,
        name,
        is_active: semesters.length === 0, // first semester is active by default
        sort_order: semesters.length,
      });

      if (error) console.error('Error adding semester:', error);
      else await fetchSemesters();
    },
    [user, semesters.length, fetchSemesters]
  );

  const renameSemester = useCallback(
    async (id: string, name: string) => {
      const { error } = await supabase
        .from('semesters')
        .update({ name })
        .eq('id', id);

      if (error) console.error('Error renaming semester:', error);
      else await fetchSemesters();
    },
    [fetchSemesters]
  );

  const deleteSemester = useCallback(
    async (id: string) => {
      if (!user) return;

      // If deleting the active semester, switch to another first
      const target = semesters.find((s) => s.id === id);
      if (target?.is_active) {
        const other = semesters.find((s) => s.id !== id);
        if (other) {
          await supabase.rpc('switch_active_semester', {
            p_user_id: user.id,
            p_semester_id: other.id,
          });
        }
      }

      // Cascading delete will remove courses, periods, etc.
      const { error } = await supabase.from('semesters').delete().eq('id', id);

      if (error) console.error('Error deleting semester:', error);
      else await fetchSemesters();
    },
    [user, semesters, fetchSemesters]
  );

  const switchSemester = useCallback(
    async (id: string) => {
      if (!user) return;

      const { error } = await supabase.rpc('switch_active_semester', {
        p_user_id: user.id,
        p_semester_id: id,
      });

      if (error) console.error('Error switching semester:', error);
      else await fetchSemesters();
    },
    [user, fetchSemesters]
  );

  return (
    <SemesterContext.Provider
      value={{
        semesters,
        activeSemester,
        loading,
        addSemester,
        renameSemester,
        deleteSemester,
        switchSemester,
      }}
    >
      {children}
    </SemesterContext.Provider>
  );
}

export function useSemester() {
  const ctx = useContext(SemesterContext);
  if (!ctx) throw new Error('useSemester must be used within SemesterProvider');
  return ctx;
}
