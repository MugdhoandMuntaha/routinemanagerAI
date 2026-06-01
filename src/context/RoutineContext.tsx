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
import { useSemester } from './SemesterContext';
import type { PeriodWithCourse } from '@/types';

type RoutineContextValue = {
  periods: PeriodWithCourse[];
  loading: boolean;
  getPeriodsForDay: (day: number) => PeriodWithCourse[];
  getPeriodsForDate: (date: Date) => PeriodWithCourse[];
  addPeriod: (data: {
    course_id: string;
    recurrence_type: 'weekly' | 'one-time';
    day_of_week: number | null;
    specific_date: string | null;
    start_time: string;
    duration_minutes: number;
    room_number: string;
  }) => Promise<void>;
  editPeriod: (id: string, data: {
    course_id: string;
    recurrence_type: 'weekly' | 'one-time';
    day_of_week: number | null;
    specific_date: string | null;
    start_time: string;
    duration_minutes: number;
    room_number: string;
  }) => Promise<void>;
  removePeriod: (id: string) => Promise<void>;
  reorderPeriods: (orderedIds: string[]) => Promise<void>;
};

const RoutineContext = createContext<RoutineContextValue | null>(null);

export function RoutineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeSemester } = useSemester();
  const [periods, setPeriods] = useState<PeriodWithCourse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPeriods = useCallback(async () => {
    if (!user || !activeSemester) {
      setPeriods([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('periods_with_course')
      .select('*')
      .eq('user_id', user.id)
      .eq('semester_id', activeSemester.id)
      .order('sort_order', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching periods:', error);
    } else {
      setPeriods(data ?? []);
    }
    setLoading(false);
  }, [user, activeSemester]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  // Realtime subscription on the periods table
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('periods-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'periods',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchPeriods();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchPeriods]);

  const getPeriodsForDay = useCallback(
    (day: number) =>
      periods
        .filter(
          (p) => p.recurrence_type === 'weekly' && p.day_of_week === day
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [periods]
  );

  const getPeriodsForDate = useCallback(
    (date: Date) => {
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0]; // "YYYY-MM-DD"

      return periods
        .filter((p) => {
          if (p.recurrence_type === 'weekly') return p.day_of_week === dayOfWeek;
          if (p.recurrence_type === 'one-time') return p.specific_date === dateStr;
          return false;
        })
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
    },
    [periods]
  );

  const addPeriod = useCallback(
    async (data: {
      course_id: string;
      recurrence_type: 'weekly' | 'one-time';
      day_of_week: number | null;
      specific_date: string | null;
      start_time: string;
      duration_minutes: number;
      room_number: string;
    }) => {
      if (!user) return;

      const { error } = await supabase.from('periods').insert({
        user_id: user.id,
        ...data,
      });

      if (error) console.error('Error adding period:', error);
      else await fetchPeriods();
    },
    [user, fetchPeriods]
  );

  const editPeriod = useCallback(
    async (
      id: string,
      data: {
        course_id: string;
        recurrence_type: 'weekly' | 'one-time';
        day_of_week: number | null;
        specific_date: string | null;
        start_time: string;
        duration_minutes: number;
        room_number: string;
      }
    ) => {
      const { error } = await supabase
        .from('periods')
        .update(data)
        .eq('id', id);

      if (error) console.error('Error updating period:', error);
      else await fetchPeriods();
    },
    [fetchPeriods]
  );

  const removePeriod = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('periods').delete().eq('id', id);
      if (error) console.error('Error removing period:', error);
      else await fetchPeriods();
    },
    [fetchPeriods]
  );

  const reorderPeriods = useCallback(
    async (orderedIds: string[]) => {
      if (!user) return;
      
      const updates = orderedIds.map((id, index) =>
        supabase.from('periods').update({ sort_order: index }).eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        console.error('Error bulk reordering periods:', errors);
      }
      
      await fetchPeriods();
    },
    [user, fetchPeriods]
  );

  return (
    <RoutineContext.Provider
      value={{
        periods,
        loading,
        getPeriodsForDay,
        getPeriodsForDate,
        addPeriod,
        editPeriod,
        removePeriod,
        reorderPeriods,
      }}
    >
      {children}
    </RoutineContext.Provider>
  );
}

export function useRoutine() {
  const ctx = useContext(RoutineContext);
  if (!ctx) throw new Error('useRoutine must be used within RoutineProvider');
  return ctx;
}
