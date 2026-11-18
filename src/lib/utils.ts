export function formatTime(dateStr: string, timezone?: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(date);
}

export function formatDate(dateStr: string, timezone?: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(date);
}

export function formatFullDateTime(dateStr: string, timezone?: string): string {
  const date = new Date(dateStr);
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  }).format(date);
}

export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getTimezoneAbbr(timezone?: string): string {
  const tz = timezone || getUserTimezone();
  const date = new Date();
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'short',
  }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value || tz;
}

export function generateTimeSlots(
  date: Date,
  durationMinutes: number
): Array<{ start: Date; end: Date; label: string }> {
  const slots: Array<{ start: Date; end: Date; label: string }> = [];
  const tz = getUserTimezone();

  const startHour = 9;
  const endHour = 18;

  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += durationMinutes) {
      const start = new Date(date);
      start.setHours(hour, min, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + durationMinutes);

      if (end.getHours() <= endHour && start > new Date()) {
        slots.push({
          start,
          end,
          label: formatTime(start.toISOString(), tz),
        });
      }
    }
  }

  return slots;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Vanakkam';
  if (hour < 17) return 'Vanakkam';
  return 'Vanakkam';
}

export function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  const startPad = firstDay.getDay();
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push(d);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  const endPad = 6 - lastDay.getDay();
  for (let i = 1; i <= endPad; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
