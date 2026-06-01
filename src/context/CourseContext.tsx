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
import type { Course } from '@/types';

type CourseContextValue = {
  courses: Course[];
  loading: boolean;
  addCourse: (data: Omit<Course, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<Course | null>;
  editCourse: (id: string, data: Partial<Course>) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  getCourseById: (id: string) => Course | undefined;
};

const CourseContext = createContext<CourseContextValue | null>(null);

export function CourseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeSemester } = useSemester();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    if (!user || !activeSemester) {
      setCourses([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', user.id)
      .eq('semester_id', activeSemester.id)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching courses:', error);
    } else {
      setCourses(data ?? []);
    }
    setLoading(false);
  }, [user, activeSemester]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !activeSemester) return;

    const channel = supabase
      .channel('courses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'courses',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCourses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeSemester, fetchCourses]);

  const addCourse = useCallback(
    async (data: Omit<Course, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Course | null> => {
      if (!user) return null;

      const { data: inserted, error } = await supabase
        .from('courses')
        .insert({ ...data, user_id: user.id })
        .select()
        .single();

      if (error) {
        console.error('Error adding course:', error);
        return null;
      }

      await fetchCourses();
      return inserted;
    },
    [user, fetchCourses]
  );

  const editCourse = useCallback(
    async (id: string, data: Partial<Course>) => {
      const { error } = await supabase
        .from('courses')
        .update(data)
        .eq('id', id);

      if (error) console.error('Error updating course:', error);
      else await fetchCourses();
    },
    [fetchCourses]
  );

  const deleteCourse = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) console.error('Error deleting course:', error);
      else await fetchCourses();
    },
    [fetchCourses]
  );

  const getCourseById = useCallback(
    (id: string) => courses.find((c) => c.id === id),
    [courses]
  );

  return (
    <CourseContext.Provider
      value={{ courses, loading, addCourse, editCourse, deleteCourse, getCourseById }}
    >
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error('useCourse must be used within CourseProvider');
  return ctx;
}
