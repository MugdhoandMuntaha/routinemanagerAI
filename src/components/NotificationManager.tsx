'use client';

import { useEffect, useRef } from 'react';
import { useRoutine } from '@/context/RoutineContext';
import { useSettings } from '@/context/SettingsContext';
import { playSynthSound } from '@/lib/synthSounds';

/**
 * Schedules local notifications 5 minutes before each class.
 * Uses @capacitor/local-notifications on Android (Capacitor)
 * and falls back to the Web Notification API in the browser.
 */
export default function NotificationManager() {
  const { periods } = useRoutine();
  const { settings } = useSettings();
  const scheduledRef = useRef(false);
  const webNotifiedRef = useRef<Set<string>>(new Set());

  // ─── Capacitor Local Notifications ─────────────────────
  useEffect(() => {
    let cancelled = false;

    async function scheduleNative() {
      try {
        // Dynamically import so it doesn't crash in non-Capacitor environments
        const { LocalNotifications } = await import(
          '@capacitor/local-notifications'
        );

        // Request permission (required on Android 13+)
        const permResult = await LocalNotifications.requestPermissions();
        if (permResult.display !== 'granted') {
          console.warn('Notification permission not granted:', permResult);
          return;
        }

        // Cancel all existing scheduled notifications to avoid duplicates
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({
            notifications: pending.notifications.map((n) => ({ id: n.id })),
          });
        }

        if (cancelled || periods.length === 0) return;

        const now = new Date();
        const notifications: Array<{
          id: number;
          title: string;
          body: string;
          schedule: { at: Date; allowWhileIdle: boolean };
          smallIcon: string;
        }> = [];

        // Schedule for the next 7 days
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + dayOffset);
          const dayOfWeek = targetDate.getDay();
          const dateStr = targetDate.toISOString().split('T')[0];

          const dayPeriods = periods.filter((p) => {
            if (p.recurrence_type === 'weekly') return p.day_of_week === dayOfWeek;
            if (p.recurrence_type === 'one-time') return p.specific_date === dateStr;
            return false;
          });

          const offsetMins = settings.notification_minutes_before || 5;
          dayPeriods.forEach((p) => {
            const timeParts = p.start_time.split(':').map(Number);
            const classTime = new Date(targetDate);
            classTime.setHours(timeParts[0], timeParts[1], 0, 0);

            // Notify configured minutes before
            const notifyAt = new Date(classTime.getTime() - offsetMins * 60 * 1000);

            // Only schedule future notifications
            if (notifyAt.getTime() > now.getTime()) {
              const id = Math.abs(hashCode(`${p.period_id}-${dayOffset}`)) % 2147483647;

              notifications.push({
                id,
                title: `📚 ${p.course_name} starting soon!`,
                body: `${p.course_code}${p.teacher_name ? ` with ${p.teacher_name}` : ''} starts at ${p.start_time.substring(0, 5)}${p.room_number ? ` in ${p.room_number}` : ''}`,
                schedule: {
                  at: notifyAt,
                  allowWhileIdle: true,
                },
                smallIcon: 'ic_launcher',
              });
            }
          });

          // ─── Daily Summary Notification Scheduling (6.4) ───
          if (dayPeriods.length > 0) {
            const sortedPeriods = [...dayPeriods].sort((a, b) => a.start_time.localeCompare(b.start_time));
            const firstStart = sortedPeriods[0].start_time.substring(0, 5);
            
            const summaryTime = new Date(targetDate);
            summaryTime.setHours(8, 0, 0, 0); // 8:00 AM summary

            if (summaryTime.getTime() > now.getTime()) {
              const summaryId = Math.abs(hashCode(`summary-${dateStr}`)) % 2147483647;
              notifications.push({
                id: summaryId,
                title: '📅 Daily Schedule Summary',
                body: `You have ${dayPeriods.length} class${dayPeriods.length !== 1 ? 'es' : ''} today. First starts at ${firstStart}.`,
                schedule: {
                  at: summaryTime,
                  allowWhileIdle: true,
                },
                smallIcon: 'ic_launcher',
              });
            }
          }
        }

        if (notifications.length > 0 && !cancelled) {
          await LocalNotifications.schedule({ notifications });
          console.log(`Scheduled ${notifications.length} notifications`);
        }

        scheduledRef.current = true;
      } catch (err) {
        // Not running in Capacitor — fall through to web fallback
        console.log('Capacitor not available, using web fallback:', err);
        scheduledRef.current = false;
      }
    }

    scheduleNative();

    return () => {
      cancelled = true;
    };
  }, [periods, settings.notification_minutes_before, settings.notification_sound]);

  // ─── Web Notification API fallback (for browser dev) ───
  useEffect(() => {
    // Only run fallback if Capacitor scheduling didn't work
    if (typeof window === 'undefined') return;

    // Request web notification permission
    if ('Notification' in window) {
      Notification.requestPermission();
    }

    function check() {
      // Skip if Capacitor handled it, or no web notifications
      if (scheduledRef.current) return;
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        Notification.permission !== 'granted'
      )
        return;

      const now = new Date();
      const currentDay = now.getDay();
      const todayStr = now.toISOString().split('T')[0];

      // Web Fallback: Daily Summary Notification (6.4)
      const todaySummaryKey = `summary-${now.toDateString()}`;
      const isMorningSummaryHour = now.getHours() === 8 && now.getMinutes() < 5;
      
      if (isMorningSummaryHour && !webNotifiedRef.current.has(todaySummaryKey)) {
        const todayPeriods = periods.filter((p) => {
          if (p.recurrence_type === 'weekly') return p.day_of_week === currentDay;
          if (p.recurrence_type === 'one-time') return p.specific_date === todayStr;
          return false;
        });

        if (todayPeriods.length > 0) {
          const sorted = [...todayPeriods].sort((a, b) => a.start_time.localeCompare(b.start_time));
          const firstStart = sorted[0].start_time.substring(0, 5);
          webNotifiedRef.current.add(todaySummaryKey);
          
          new Notification('📅 Daily Schedule Summary', {
            body: `You have ${todayPeriods.length} class${todayPeriods.length !== 1 ? 'es' : ''} today. First starts at ${firstStart}.`,
            icon: '/icon-192.png',
            tag: todaySummaryKey,
          });
        }
      }

      periods
        .filter((p) => {
          if (p.recurrence_type === 'weekly') return p.day_of_week === currentDay;
          if (p.recurrence_type === 'one-time') return p.specific_date === todayStr;
          return false;
        })
        .forEach((p) => {
          const timeParts = p.start_time.split(':').map(Number);
          const classTime = new Date();
          classTime.setHours(timeParts[0], timeParts[1], 0, 0);

          const offsetMins = settings.notification_minutes_before || 5;
          const diff = (classTime.getTime() - now.getTime()) / 1000 / 60;

          const notifKey = `${p.period_id}-${now.toDateString()}`;
          if (diff > 0 && diff <= offsetMins && !webNotifiedRef.current.has(notifKey)) {
            webNotifiedRef.current.add(notifKey);
            new Notification(`📚 ${p.course_name} starting soon!`, {
              body: `${p.course_code}${p.teacher_name ? ` with ${p.teacher_name}` : ''} starts at ${p.start_time.substring(0, 5)}${p.room_number ? ` in ${p.room_number}` : ''}`,
              icon: '/icon-192.png',
              tag: notifKey,
            });
            playSynthSound(settings.notification_sound);
          }
        });
    }

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [periods, settings.notification_minutes_before, settings.notification_sound]);

  return null;
}

/** Simple string hash to generate numeric IDs */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}
