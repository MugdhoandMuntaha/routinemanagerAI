import type { PeriodWithCourse } from '@/types';

/** Helper to format date and time to ICS format YYYYMMDDTHHMMSS */
function formatICSDate(date: Date, timeStr?: string): string {
  const d = new Date(date);
  if (timeStr) {
    const [h, m, s] = timeStr.split(':').map(Number);
    d.setHours(h, m, s || 0, 0);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Helper to find the next occurrence of a weekday (0=Sun, 1=Mon, etc.) */
function getNextDateForDay(dayOfWeek: number): Date {
  const result = new Date();
  const currentDay = result.getDay();
  // Calculate distance, if today is the day, start today
  const distance = (dayOfWeek - currentDay + 7) % 7;
  result.setDate(result.getDate() + distance);
  return result;
}

/** Export a list of periods with course info to ICS string */
export function exportToICS(periods: PeriodWithCourse[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Antigravity//Routine Manager Timetable//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  periods.forEach((period) => {
    let startDate = new Date();
    let isRecurring = period.recurrence_type === 'weekly';

    if (isRecurring && period.day_of_week !== null) {
      startDate = getNextDateForDay(period.day_of_week);
    } else if (period.specific_date) {
      startDate = new Date(period.specific_date);
    }

    // Parse start time and calculate end time
    const [startH, startM] = period.start_time.split(':').map(Number);
    const startObj = new Date(startDate);
    startObj.setHours(startH, startM, 0, 0);

    const endObj = new Date(startObj);
    endObj.setMinutes(endObj.getMinutes() + period.duration_minutes);

    const timeStr = period.start_time;
    const pad = (n: number) => String(n).padStart(2, '0');
    const endTimeStr = `${pad(endObj.getHours())}:${pad(endObj.getMinutes())}:00`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:period-${period.period_id}@routinemanager.app`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    
    // Summary combines course name and code
    lines.push(`SUMMARY:${period.course_name}${period.course_code ? ` (${period.course_code})` : ''}`);
    
    // Description contains teacher details
    const desc = `Course: ${period.course_name}\\nCode: ${period.course_code}\\nTeacher: ${period.teacher_name || 'N/A'}\\nRoom: ${period.room_number || 'N/A'}`;
    lines.push(`DESCRIPTION:${desc}`);
    
    if (period.room_number) {
      lines.push(`LOCATION:${period.room_number}`);
    }

    lines.push(`DTSTART:${formatICSDate(startDate, timeStr)}`);
    lines.push(`DTEND:${formatICSDate(startDate, endTimeStr)}`);

    if (isRecurring && period.day_of_week !== null) {
      // Reoccurring weekly rule
      lines.push('RRULE:FREQ=WEEKLY');
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

type ParsedICSItem = {
  courseName: string;
  courseCode: string;
  teacherName: string;
  roomNumber: string;
  recurrenceType: 'weekly' | 'one-time';
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  durationMinutes: number;
};

/** Parse an ICS file and extract potential courses and period mappings */
export function parseICS(icsText: string): ParsedICSItem[] {
  const items: ParsedICSItem[] = [];
  const events = icsText.split('BEGIN:VEVENT');
  
  // Skip header before first VEVENT
  for (let i = 1; i < events.length; i++) {
    const eventText = events[i].split('END:VEVENT')[0];
    
    let summary = '';
    let description = '';
    let location = '';
    let dtstart = '';
    let dtend = '';
    let rrule = '';
    
    // Simple line by line parsing
    const lines = eventText.split(/\r?\n/);
    let currentKey = '';
    let currentValue = '';

    const flushProperty = () => {
      if (!currentKey) return;
      if (currentKey.startsWith('SUMMARY')) summary = currentValue;
      else if (currentKey.startsWith('DESCRIPTION')) description = currentValue;
      else if (currentKey.startsWith('LOCATION')) location = currentValue;
      else if (currentKey.startsWith('DTSTART')) dtstart = currentValue;
      else if (currentKey.startsWith('DTEND')) dtend = currentValue;
      else if (currentKey.startsWith('RRULE')) rrule = currentValue;
    };

    lines.forEach((line) => {
      // Handle folded lines (lines starting with space or tab continue the previous line)
      if (line.startsWith(' ') || line.startsWith('\t')) {
        currentValue += line.substring(1);
      } else {
        flushProperty();
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          currentKey = line.substring(0, colonIndex);
          currentValue = line.substring(colonIndex + 1);
        } else {
          currentKey = '';
          currentValue = '';
        }
      }
    });
    flushProperty(); // Flush last property

    if (!dtstart) continue;

    // Parse dtstart date & time
    // Formats: YYYYMMDDTHHMMSS or TZID=...:YYYYMMDDTHHMMSS
    let startRaw = dtstart;
    if (dtstart.includes(':')) {
      startRaw = dtstart.split(':')[1];
    }
    
    const year = parseInt(startRaw.substring(0, 4));
    const month = parseInt(startRaw.substring(4, 6)) - 1;
    const day = parseInt(startRaw.substring(6, 8));
    const hour = parseInt(startRaw.substring(9, 11)) || 0;
    const minute = parseInt(startRaw.substring(11, 13)) || 0;
    
    const startDate = new Date(year, month, day, hour, minute, 0);

    // Calculate duration
    let durationMinutes = 50; // fallback
    if (dtend) {
      let endRaw = dtend;
      if (dtend.includes(':')) {
        endRaw = dtend.split(':')[1];
      }
      const endY = parseInt(endRaw.substring(0, 4));
      const endM = parseInt(endRaw.substring(4, 6)) - 1;
      const endD = parseInt(endRaw.substring(6, 8));
      const endH = parseInt(endRaw.substring(9, 11)) || 0;
      const endMin = parseInt(endRaw.substring(11, 13)) || 0;
      const endDate = new Date(endY, endM, endD, endH, endMin, 0);
      
      const diffMs = endDate.getTime() - startDate.getTime();
      if (diffMs > 0) {
        durationMinutes = Math.round(diffMs / (60 * 1000));
      }
    }

    // Determine recurrence
    const isWeekly = rrule.includes('FREQ=WEEKLY');
    const dayOfWeek = isWeekly ? startDate.getDay() : null;
    const pad = (n: number) => String(n).padStart(2, '0');
    const specificDate = !isWeekly ? `${year}-${pad(month + 1)}-${pad(day)}` : null;

    // Clean up summary to extract course name and code
    // Example: "Data Structures (CSE 211)"
    let courseName = summary.trim();
    let courseCode = '';
    const codeMatch = summary.match(/\(([^)]+)\)/);
    if (codeMatch) {
      courseCode = codeMatch[1].trim();
      courseName = summary.replace(/\([^)]+\)/, '').trim();
    }

    // Clean up description to extract teacher
    let teacherName = '';
    const descUnescaped = description.replace(/\\n/g, '\n').replace(/\\,/g, ',');
    const teacherMatch = descUnescaped.match(/Teacher:\s*([^\n]+)/i);
    if (teacherMatch) {
      teacherName = teacherMatch[1].trim();
    }

    const startTime = `${pad(hour)}:${pad(minute)}:00`;

    items.push({
      courseName,
      courseCode,
      teacherName,
      roomNumber: location.trim(),
      recurrenceType: isWeekly ? 'weekly' : 'one-time',
      dayOfWeek,
      specificDate,
      startTime,
      durationMinutes,
    });
  }

  return items;
}
