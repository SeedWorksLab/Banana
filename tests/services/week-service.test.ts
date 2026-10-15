import type { Slot } from '../../src/models';
import {
  buildDayPlans,
  findSlot,
  slotsByDay,
  weekEndDate,
  weekProgress,
  weekRange,
} from '../../src/services/week-service';

function slot(partial: Partial<Slot>): Slot {
  return {
    id: partial.id ?? 1,
    uuid: partial.uuid ?? null,
    weekId: partial.weekId ?? 1,
    day: partial.day ?? 'mon',
    mealType: partial.mealType ?? 'dinner',
    kind: partial.kind ?? 'recipe',
    recipeId: partial.recipeId === undefined ? null : partial.recipeId,
    freeText: partial.freeText ?? null,
    servings: partial.servings ?? 2,
    note: partial.note ?? null,
    cookedAt: partial.cookedAt ?? null,
    rating: partial.rating ?? null,
    sortOrder: partial.sortOrder ?? 0,
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? null,
    deleted: partial.deleted ?? false,
  };
}

describe('weekRange', () => {
  it('spans Monday to Sunday', () => {
    expect(weekEndDate('2026-01-05')).toBe('2026-01-11');
    expect(weekRange('2026-01-05')).toEqual({ start: '2026-01-05', end: '2026-01-11' });
  });
});

describe('buildDayPlans', () => {
  const weeknight = { mode: 'cook' as const, cookMinutes: 30 };
  const weekend = { mode: 'cook' as const, cookMinutes: 60 };

  it('fills seven days from the defaults', () => {
    const plans = buildDayPlans('2026-01-05', [], weeknight, weekend);
    expect(plans.map((p) => p.day)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    expect(plans.map((p) => p.date)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11',
    ]);
    expect(plans.slice(0, 5).every((p) => p.cookMinutes === 30)).toBe(true);
    expect(plans.slice(5).every((p) => p.cookMinutes === 60)).toBe(true);
  });

  it('lets a stored budget override a day', () => {
    const plans = buildDayPlans(
      '2026-01-05',
      [{ day: 'wed', mode: 'no_cook', cookMinutes: 0 }],
      weeknight,
      weekend
    );
    const wed = plans.find((p) => p.day === 'wed');
    expect(wed).toEqual({ day: 'wed', date: '2026-01-07', mode: 'no_cook', cookMinutes: 0 });
  });
});

describe('slotsByDay', () => {
  it('groups slots under every weekday, even empty ones', () => {
    const grouped = slotsByDay([
      slot({ id: 1, day: 'mon' }),
      slot({ id: 2, day: 'mon' }),
      slot({ id: 3, day: 'fri' }),
    ]);
    expect(grouped.size).toBe(7);
    expect(grouped.get('mon')?.map((s) => s.id)).toEqual([1, 2]);
    expect(grouped.get('fri')?.map((s) => s.id)).toEqual([3]);
    expect(grouped.get('tue')).toEqual([]);
  });
});

describe('findSlot', () => {
  const slots = [slot({ id: 1, day: 'mon', mealType: 'dinner' }), slot({ id: 2, day: 'mon', mealType: 'lunch' })];

  it('finds a day and meal type', () => {
    expect(findSlot(slots, 'mon', 'lunch')?.id).toBe(2);
  });

  it('returns null when absent', () => {
    expect(findSlot(slots, 'sun', 'dinner')).toBeNull();
  });
});

describe('weekProgress', () => {
  it('counts planned, cooked and rated slots', () => {
    const progress = weekProgress([
      slot({ id: 1, kind: 'recipe', cookedAt: '2026-01-05T18:00:00.000Z', rating: 4 }),
      slot({ id: 2, kind: 'empty' }),
      slot({ id: 3, kind: 'recipe', cookedAt: null, rating: null }),
      slot({ id: 4, kind: 'leftovers', cookedAt: '2026-01-06T18:00:00.000Z', rating: null }),
    ]);
    expect(progress).toEqual({ planned: 3, cooked: 2, rated: 1, total: 4 });
  });
});
