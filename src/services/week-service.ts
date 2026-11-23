import { WEEK_DAYS, type DayMode, type MealType, type Slot, type WeekDay } from '../models';
import { addDays, weekDates } from '../utils/date';

export interface DayPlan {
  day: WeekDay;
  date: string;
  mode: DayMode;
  cookMinutes: number;
  servings: number;
}

export interface DayBudgetLike {
  day: WeekDay;
  mode: DayMode;
  cookMinutes: number;
  servings?: number | null;
}

export interface DefaultDayBudget {
  mode: DayMode;
  cookMinutes: number;
}

export function isPastPlanDay(date: string, today: string): boolean {
  return date < today;
}

export function weekEndDate(weekStartDate: string): string {
  return addDays(weekStartDate, 6);
}

export function weekRange(weekStartDate: string): { start: string; end: string } {
  return { start: weekStartDate, end: weekEndDate(weekStartDate) };
}

/**
 * A full seven-day layout for a week, filling any missing day from the defaults.
 * Weekends default to the longer budget; weekdays to the shorter one. A day
 * without its own servings falls back to the household default, so "six people"
 * applies every night while a single dinner can still say "two".
 */
export function buildDayPlans(
  weekStartDate: string,
  budgets: readonly DayBudgetLike[],
  weeknight: DefaultDayBudget,
  weekend: DefaultDayBudget,
  defaultServings = 2
): DayPlan[] {
  const byDay = new Map<WeekDay, DayBudgetLike>(budgets.map((b) => [b.day, b]));
  return weekDates(weekStartDate).map(({ day, date }, index) => {
    const existing = byDay.get(day);
    if (existing) {
      return {
        day,
        date,
        mode: existing.mode,
        cookMinutes: existing.cookMinutes,
        servings: existing.servings ?? defaultServings,
      };
    }
    const fallback = index >= 5 ? weekend : weeknight;
    return {
      day,
      date,
      mode: fallback.mode,
      cookMinutes: fallback.cookMinutes,
      servings: defaultServings,
    };
  });
}

export function slotsByDay(slots: readonly Slot[]): Map<WeekDay, Slot[]> {
  const grouped = new Map<WeekDay, Slot[]>();
  for (const day of WEEK_DAYS) {
    grouped.set(day, []);
  }
  for (const slot of slots) {
    grouped.get(slot.day)?.push(slot);
  }
  return grouped;
}

export function findSlot(
  slots: readonly Slot[],
  day: WeekDay,
  mealType: MealType
): Slot | null {
  return slots.find((slot) => slot.day === day && slot.mealType === mealType) ?? null;
}

export interface WeekProgress {
  planned: number;
  cooked: number;
  rated: number;
  total: number;
}

export function weekProgress(slots: readonly Slot[]): WeekProgress {
  const plannedSlots = slots.filter((slot) => slot.kind !== 'empty');
  const cooked = plannedSlots.filter((slot) => slot.cookedAt !== null).length;
  const rated = plannedSlots.filter((slot) => slot.rating !== null).length;
  return { planned: plannedSlots.length, cooked, rated, total: slots.length };
}
