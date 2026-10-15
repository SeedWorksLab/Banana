import dayjs, { type Dayjs } from 'dayjs';
import { WEEK_DAYS, type WeekDay } from '../models';

export const DATABASE_NAME = 'banana.db';

export const BACKUP_EXTENSION = 'banana';

export const STORE_DATE_FORMAT = 'YYYY-MM-DD';

export const STORE_TIMESTAMP_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSS[Z]';

export function isoNow(now: string | Dayjs | Date = dayjs()): string {
  return dayjs(now).format(STORE_TIMESTAMP_FORMAT);
}

export function todayDate(now: string | Dayjs | Date = dayjs()): string {
  return dayjs(now).format(STORE_DATE_FORMAT);
}

export function addDays(date: string | Dayjs, days: number): string {
  return dayjs(date).add(days, 'day').format(STORE_DATE_FORMAT);
}

function weekdayIndex(date: string | Dayjs): number {
  return (dayjs(date).day() + 6) % 7;
}

export function weekStart(date: string | Dayjs): string {
  const d = dayjs(date);
  return d.subtract(weekdayIndex(d), 'day').format(STORE_DATE_FORMAT);
}

export interface WeekDate {
  day: WeekDay;
  date: string;
}

export function weekDates(weekStartDate: string): WeekDate[] {
  const start = dayjs(weekStartDate);
  return WEEK_DAYS.map((day, index) => ({
    day,
    date: start.add(index, 'day').format(STORE_DATE_FORMAT),
  }));
}

export function weekDayIndex(day: WeekDay): number {
  return WEEK_DAYS.indexOf(day);
}

export function formatDate(date: string | Dayjs, format = 'ddd D MMM'): string {
  return dayjs(date).format(format);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}
