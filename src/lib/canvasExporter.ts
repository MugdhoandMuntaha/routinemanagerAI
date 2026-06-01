import type { PeriodWithCourse } from '@/types';
import { DAY_FULL_NAMES } from '@/types';

function parseTime(t: string): number {
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12} ${ampm}`;
}

export function exportTimetableToImage(
  periods: PeriodWithCourse[],
  themeId: string,
  semesterName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 1. Filter weekly classes
    const weekly = periods.filter((p) => p.recurrence_type === 'weekly');
    if (weekly.length === 0) {
      alert('Add weekly classes to generate a timetable image.');
      resolve();
      return;
    }

    // 2. Set dimensions
    const canvas = document.createElement('canvas');
    const width = 1600;
    const height = 1000;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context not available'));
      return;
    }

    // 3. Theme color definitions
    const isNotebook = themeId === 'notebook';
    
    // Background and base grid colors
    let bgColor = '#0b0f19';
    let bgGradientEnd = '#070a10';
    let gridBorderColor = 'rgba(99, 102, 241, 0.08)';
    let textPrimaryColor = '#ffffff';
    let textSecondaryColor = '#94a3b8';
    let accentColor = '#6366f1';
    let headerBgColor = 'rgba(99, 102, 241, 0.05)';
    let borderSubtleColor = 'rgba(255, 255, 255, 0.03)';
    let fontSans = 'system-ui, -apple-system, sans-serif';
    let fontTitle = 'system-ui, -apple-system, sans-serif';

    if (themeId === 'cyberpunk') {
      bgColor = '#0a051b';
      bgGradientEnd = '#02000a';
      gridBorderColor = 'rgba(34, 211, 238, 0.1)';
      textPrimaryColor = '#f0abfc';
      textSecondaryColor = '#a3e635';
      accentColor = '#22d3ee';
      headerBgColor = 'rgba(34, 211, 238, 0.05)';
      borderSubtleColor = 'rgba(240, 171, 252, 0.05)';
    } else if (themeId === 'aurora') {
      bgColor = '#030d0d';
      bgGradientEnd = '#000404';
      gridBorderColor = 'rgba(16, 185, 129, 0.08)';
      textPrimaryColor = '#e6fffa';
      textSecondaryColor = '#06b6d4';
      accentColor = '#10b981';
      headerBgColor = 'rgba(16, 185, 129, 0.04)';
      borderSubtleColor = 'rgba(16, 185, 129, 0.03)';
    } else if (themeId === 'sunset') {
      bgColor = '#12070c';
      bgGradientEnd = '#080104';
      gridBorderColor = 'rgba(249, 115, 22, 0.08)';
      textPrimaryColor = '#ffebeb';
      textSecondaryColor = '#f43f5e';
      accentColor = '#f97316';
      headerBgColor = 'rgba(249, 115, 22, 0.04)';
      borderSubtleColor = 'rgba(249, 115, 22, 0.03)';
    } else if (themeId === 'ocean') {
      bgColor = '#030816';
      bgGradientEnd = '#01030a';
      gridBorderColor = 'rgba(14, 165, 233, 0.08)';
      textPrimaryColor = '#f0f9ff';
      textSecondaryColor = '#3b82f6';
      accentColor = '#0ea5e9';
      headerBgColor = 'rgba(14, 165, 233, 0.04)';
      borderSubtleColor = 'rgba(14, 165, 233, 0.03)';
    } else if (themeId === 'rose') {
      bgColor = '#11050e';
      bgGradientEnd = '#070106';
      gridBorderColor = 'rgba(236, 72, 153, 0.08)';
      textPrimaryColor = '#fff1f2';
      textSecondaryColor = '#f472b6';
      accentColor = '#ec4899';
      headerBgColor = 'rgba(236, 72, 153, 0.04)';
      borderSubtleColor = 'rgba(236, 72, 153, 0.03)';
    } else if (themeId === 'slate') {
      bgColor = '#0f172a';
      bgGradientEnd = '#020617';
      gridBorderColor = 'rgba(148, 163, 184, 0.08)';
      textPrimaryColor = '#f8fafc';
      textSecondaryColor = '#94a3b8';
      accentColor = '#64748b';
      headerBgColor = 'rgba(148, 163, 184, 0.04)';
      borderSubtleColor = 'rgba(148, 163, 184, 0.03)';
    } else if (isNotebook) {
      bgColor = '#fdfbf7'; // Parchment
      bgGradientEnd = '#f7f4ea';
      gridBorderColor = '#cbd5e1';
      textPrimaryColor = '#2b6cb0'; // Blue Ink
      textSecondaryColor = '#f43f5e'; // Red margin ink
      accentColor = '#2b6cb0';
      headerBgColor = 'rgba(43, 108, 176, 0.03)';
      borderSubtleColor = '#cbd5e1';
      fontSans = '"Architects Daughter", "Comic Sans MS", cursive, system-ui';
      fontTitle = '"Architects Daughter", "Comic Sans MS", cursive, system-ui';
    }

    // 4. Calculate start and end hours
    let minTime = 24 * 60;
    let maxTime = 0;
    weekly.forEach((p) => {
      const start = parseTime(p.start_time);
      const end = start + p.duration_minutes;
      if (start < minTime) minTime = start;
      if (end > maxTime) maxTime = end;
    });

    const startHour = Math.max(0, Math.floor(minTime / 60) - 1);
    const endHour = Math.min(24, Math.ceil(maxTime / 60) + 1);
    const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

    // 5. Draw Background
    if (isNotebook) {
      // Draw notebook cream sheets
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      // Draw horizontal ruled lines like a notepad
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      for (let y = 140; y < height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw red margin lines on the left
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(110, 0);
      ctx.lineTo(110, height);
      ctx.moveTo(114, 0);
      ctx.lineTo(114, height);
      ctx.stroke();
    } else {
      // Modern glassmorphism HUD gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, bgColor);
      grad.addColorStop(1, bgGradientEnd);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Subtle tech scan grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // 6. Draw Timetable Header Banner
    const topPadding = 120;
    ctx.fillStyle = textPrimaryColor;
    ctx.font = `800 2.2rem ${fontTitle}`;
    ctx.textAlign = 'left';
    ctx.fillText('WEEKLY CLASS SCHEDULE', 50, 60);

    ctx.fillStyle = textSecondaryColor;
    ctx.font = `600 1.05rem ${fontSans}`;
    ctx.fillText(`${semesterName.toUpperCase()} TERM`, 50, 95);

    // Watermark watermark info
    ctx.textAlign = 'right';
    ctx.fillStyle = textSecondaryColor;
    ctx.font = `700 0.8rem ${fontSans}`;
    ctx.fillText('GENERATED BY ROUTINE MANAGER', width - 50, 60);
    ctx.font = `500 0.72rem ${fontSans}`;
    ctx.fillText(new Date().toLocaleDateString('en-US', { dateStyle: 'full' }), width - 50, 85);

    // Header dividers
    ctx.strokeStyle = gridBorderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 115);
    ctx.lineTo(width - 50, 115);
    ctx.stroke();

    // 7. Grid coordinates setup
    const gridLeft = 140;
    const gridTop = 170;
    const gridWidth = width - gridLeft - 50;
    const gridHeight = height - gridTop - 50;
    const colWidth = gridWidth / 7;
    const rowHeight = gridHeight / hours.length;

    // 8. Draw Grid Headers (Time column header & Days headers)
    ctx.fillStyle = headerBgColor;
    ctx.fillRect(50, gridTop - 45, gridWidth + (gridLeft - 50), 45);

    ctx.strokeStyle = gridBorderColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(50, gridTop - 45, gridWidth + (gridLeft - 50), 45);

    ctx.fillStyle = textSecondaryColor;
    ctx.font = `800 0.85rem ${fontSans}`;
    ctx.textAlign = 'center';
    // Draw "TIME" label in first cell
    ctx.fillText('TIME', 95, gridTop - 18);

    // Draw days labels
    DAY_FULL_NAMES.forEach((day, idx) => {
      const x = gridLeft + idx * colWidth + colWidth / 2;
      ctx.fillStyle = textPrimaryColor;
      ctx.fillText(day.toUpperCase(), x, gridTop - 18);
    });

    // 9. Draw Grid Rows and columns
    hours.forEach((hour, rIdx) => {
      const y = gridTop + rIdx * rowHeight;
      
      // Draw grid line horizontal
      ctx.strokeStyle = borderSubtleColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, y + rowHeight);
      ctx.lineTo(width - 50, y + rowHeight);
      ctx.stroke();

      // Draw Hour Label
      ctx.fillStyle = textSecondaryColor;
      ctx.font = `700 0.8rem ${fontSans}`;
      ctx.textAlign = 'center';
      ctx.fillText(formatHour(hour), 95, y + rowHeight / 2 + 5);
    });

    // Draw vertical day grid borders
    for (let c = 0; c <= 7; c++) {
      const x = gridLeft + c * colWidth;
      ctx.strokeStyle = borderSubtleColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridTop + gridHeight);
      ctx.stroke();
    }

    // Outer grid border outline
    ctx.strokeStyle = gridBorderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(50, gridTop, gridWidth + (gridLeft - 50), gridHeight);

    // 10. Map periods and render them as rounded boxes
    weekly.forEach((p) => {
      if (p.day_of_week === null) return;
      const dayIdx = p.day_of_week;
      const startMin = parseTime(p.start_time);
      const startH = Math.floor(startMin / 60);
      const startM = startMin % 60;
      
      // Find row index
      const hourOffset = startMin / 60 - startHour;
      if (hourOffset < 0 || hourOffset > hours.length) return;

      const px = gridLeft + dayIdx * colWidth + 5;
      const py = gridTop + hourOffset * rowHeight + 5;
      const pWidth = colWidth - 10;
      const pHeight = (p.duration_minutes / 60) * rowHeight - 10;

      const courseColor = p.course_color || '#6366f1';

      ctx.save();
      
      // Draw Card Backdrop
      ctx.fillStyle = isNotebook ? '#ffffff' : `${courseColor}14`; // low opacity overlay
      ctx.strokeStyle = isNotebook ? '#475569' : `${courseColor}45`;
      ctx.lineWidth = isNotebook ? 1.5 : 1;
      
      // Draw rounded card helper
      const r = 8;
      ctx.beginPath();
      ctx.moveTo(px + r, py);
      ctx.lineTo(px + pWidth - r, py);
      ctx.quadraticCurveTo(px + pWidth, py, px + pWidth, py + r);
      ctx.lineTo(px + pWidth, py + pHeight - r);
      ctx.quadraticCurveTo(px + pWidth, py + pHeight, px + pWidth - r, py + pHeight);
      ctx.lineTo(px + r, py + pHeight);
      ctx.quadraticCurveTo(px, py + pHeight, px, py + pHeight - r);
      ctx.lineTo(px, py + r);
      ctx.quadraticCurveTo(px, py, px + r, py);
      ctx.closePath();
      
      if (!isNotebook) {
        // Shadow glow
        ctx.shadowColor = courseColor;
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
      }
      ctx.fill();
      
      ctx.shadowBlur = 0; // reset shadow
      ctx.stroke();

      // Left solid theme accent border strip
      ctx.fillStyle = courseColor;
      ctx.beginPath();
      ctx.moveTo(px + 1, py + r);
      ctx.quadraticCurveTo(px + 1, py + 1, px + r, py + 1);
      ctx.lineTo(px + 6, py + 1);
      ctx.lineTo(px + 6, py + pHeight - 1);
      ctx.lineTo(px + r, py + pHeight - 1);
      ctx.quadraticCurveTo(px + 1, py + pHeight - 1, px + 1, py + pHeight - r);
      ctx.closePath();
      ctx.fill();

      // Draw Card Texts
      ctx.textAlign = 'left';
      ctx.fillStyle = isNotebook ? '#1a202c' : textPrimaryColor;
      ctx.font = `800 0.8rem ${fontSans}`;
      
      // Truncate long course names
      const textX = px + 15;
      const textY = py + 22;
      const textWidth = pWidth - 25;
      
      let name = p.course_name.toUpperCase();
      if (ctx.measureText(name).width > textWidth) {
        while (name.length > 0 && ctx.measureText(name + '...').width > textWidth) {
          name = name.slice(0, -1);
        }
        name += '...';
      }
      ctx.fillText(name, textX, textY);

      // Sub-details (Room, Code, Times)
      ctx.fillStyle = isNotebook ? '#4a5568' : textSecondaryColor;
      ctx.font = `700 0.64rem ${fontSans}`;
      
      let lineOffset = 18;
      if (pHeight > 55) {
        ctx.fillText(p.course_code || 'COURSE CODE', textX, textY + lineOffset);
        lineOffset += 15;
      }
      if (pHeight > 75 && p.room_number) {
        ctx.fillText(`ROOM: ${p.room_number}`, textX, textY + lineOffset);
        lineOffset += 15;
      }
      
      // Show start-end time inside card if tall enough
      if (pHeight > 95) {
        const startRaw = p.start_time.split(':').slice(0, 2).join(':');
        const endObj = new Date();
        const [sh, sm] = p.start_time.split(':').map(Number);
        endObj.setHours(sh, sm + p.duration_minutes);
        const pad = (n: number) => String(n).padStart(2, '0');
        const endRaw = `${pad(endObj.getHours())}:${pad(endObj.getMinutes())}`;
        
        ctx.fillText(`${startRaw} - ${endRaw}`, textX, textY + lineOffset);
      }

      ctx.restore();
    });

    // 11. Convert Canvas to downloadable Image file
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `schedule_${semesterName.toLowerCase().replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}
