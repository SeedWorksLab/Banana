import type {
  Country,
  DayMode,
  Diet,
  IngredientCategory,
  MealType,
  PantryLevel,
  StoreId,
  Unit,
  WeekDay,
} from '../models';

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const WEEK_DAY_SHORT_LABELS: Record<WeekDay, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const DAY_MODE_LABELS: Record<DayMode, string> = {
  cook: 'Cooking',
  no_cook: 'No cooking',
  leftovers: 'Leftovers',
};

export const DIET_LABELS: Record<Diet, string> = {
  omnivore: 'Omnivore',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
};

export const PANTRY_LEVEL_LABELS: Record<PantryLevel, string> = {
  stocked: 'Stocked',
  low: 'Low',
  out: 'Out',
};

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: 'Fruit & vegetables',
  bakery: 'Bakery',
  meat_fish: 'Meat & fish',
  dairy: 'Dairy & eggs',
  pantry: 'Pantry',
  frozen: 'Frozen',
  drinks: 'Drinks',
  household: 'Household',
  other: 'Other',
};

export const UNIT_LABELS: Record<Unit, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  piece: 'pc',
  tbsp: 'tbsp',
  tsp: 'tsp',
  pinch: 'pinch',
  clove: 'clove',
  slice: 'slice',
  can: 'can',
  pack: 'pack',
  bunch: 'bunch',
  to_taste: 'to taste',
};

export const COUNTRY_LABELS: Record<Country, string> = {
  AT: 'Austria',
  HU: 'Hungary',
};

export const STORE_LABELS: Record<StoreId, string> = {
  lidl: 'Lidl',
  hofer: 'Hofer',
  spar: 'Spar',
  billa_at: 'Billa',
  dm_at: 'dm',
  tedi_at: 'Tedi',
  aldi_hu: 'Aldi',
  lidl_hu: 'Lidl',
  spar_hu: 'Spar',
};

export function mealTypeLabel(mealType: MealType): string {
  return MEAL_TYPE_LABELS[mealType];
}

export function weekDayLabel(day: WeekDay): string {
  return WEEK_DAY_LABELS[day];
}

export function categoryLabel(category: IngredientCategory): string {
  return CATEGORY_LABELS[category];
}

export function unitLabel(unit: Unit): string {
  return UNIT_LABELS[unit];
}
