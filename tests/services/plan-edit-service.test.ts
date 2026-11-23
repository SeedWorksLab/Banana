import type { Slot } from '../../src/models';
import {
  daysWithMeals,
  editableSlotsForDays,
  isEditableSlot,
  markCookedTarget,
  mealSummary,
  replacementTargets,
  slotFor,
  slotKey,
} from '../../src/services/plan-edit-service';

function slot(partial: Partial<Slot>): Slot {
  return {
    batchSourceUuid: partial.batchSourceUuid ?? null,
    id: partial.id ?? 1,
    uuid: null,
    weekId: 1,
    day: partial.day ?? 'mon',
    mealType: partial.mealType ?? 'dinner',
    kind: partial.kind ?? 'recipe',
    recipeId: partial.recipeId ?? null,
    freeText: partial.freeText ?? null,
    servings: partial.servings ?? 2,
    note: partial.note ?? null,
    pinned: partial.pinned ?? false,
    cookedAt: partial.cookedAt ?? null,
    rating: partial.rating ?? null,
    sortOrder: partial.sortOrder ?? 0,
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: null,
    deleted: false,
  };
}

const slots: Slot[] = [
  slot({ id: 1, day: 'mon', kind: 'recipe', recipeId: 5 }),
  slot({ id: 2, day: 'tue', kind: 'free_text', freeText: 'Soup', pinned: true }),
  slot({ id: 3, day: 'wed', kind: 'leftovers' }),
  slot({ id: 4, day: 'wed', mealType: 'lunch', kind: 'recipe', recipeId: 8 }),
  slot({ id: 5, day: 'thu', kind: 'empty' }),
];

describe('slot targeting', () => {
  it('keys a slot by day and meal type', () => {
    expect(slotKey('mon')).toBe('mon|dinner');
    expect(slotKey('wed', 'lunch')).toBe('wed|lunch');
  });

  it('finds exactly the requested meal', () => {
    expect(slotFor(slots, 'wed')?.id).toBe(3);
    expect(slotFor(slots, 'wed', 'lunch')?.id).toBe(4);
    expect(slotFor(slots, 'fri')).toBeNull();
  });

  it('never treats a pinned slot as editable', () => {
    expect(isEditableSlot(slots[0])).toBe(true);
    expect(isEditableSlot(slots[1])).toBe(false);
  });

  it('only returns editable slots for the named days', () => {
    expect(editableSlotsForDays(slots, ['tue', 'wed']).map((entry) => entry.id)).toEqual([3, 4]);
    expect(replacementTargets(slots, ['tue'])).toEqual([]);
  });

  it('lists days that actually have a meal', () => {
    expect(daysWithMeals(slots)).toEqual(['mon', 'tue', 'wed']);
  });

  it('targets only the meal the user cooked', () => {
    expect(markCookedTarget(slots, 'mon')?.id).toBe(1);
    expect(markCookedTarget(slots, 'fri')).toBeNull();
  });
});

describe('mealSummary', () => {
  it('describes every slot kind concisely', () => {
    expect(mealSummary(slots[0], 'Chilli')).toBe('Chilli');
    expect(mealSummary(slots[1], null)).toBe('Soup');
    expect(mealSummary(slots[2], null)).toBe('Leftovers');
    expect(mealSummary(slots[4], null)).toBe('No meal');
  });
});
