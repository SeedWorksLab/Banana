import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Chip, Divider, Text } from 'react-native-paper';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { StatCard } from '../../components/stat-card';
import { ScreenToast } from '../../components/screen-toast';
import { useAppTheme } from '../../theme';
import { useAppData, type WeekPlan } from '../../data/DataProvider';
import {
  buildIngredientNamesByRecipe,
  buildPlannedMeals,
  buildPlannerRecipes,
  buildRecipeSummaries,
} from '../../data/selectors';
import { buildShoppingList } from '../../services/shopping-list-service';
import { bestDealForIngredient, type IngredientDeal } from '../../services/deal-service';
import { planWeek } from '../../services/planning-service';
import { buildDayPlans, weekProgress, weekRange } from '../../services/week-service';
import { formatCents } from '../../utils/currency';
import { todayDate, weekStart } from '../../utils/date';
import { DAY_MODE_LABELS, weekDayLabel } from '../../utils/labels';

export default function PlanScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const {
    settings,
    preferences,
    recipes,
    recipeIngredients,
    recipeTags,
    ingredients,
    pantryItems,
    deals,
    dealMatches,
    createSlot,
    deleteSlot,
    setDayBudget,
    loadWeekPlan,
    regenerateShoppingList,
  } = useAppData();

  const [weekStartDate] = useState(() => weekStart(todayDate()));
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await loadWeekPlan(weekStartDate);
    setPlan(next);
  }, [loadWeekPlan, weekStartDate]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const summaries = useMemo(() => buildRecipeSummaries(recipes, recipeTags), [recipes, recipeTags]);
  const ingredientNames = useMemo(
    () => buildIngredientNamesByRecipe(recipeIngredients, ingredients),
    [recipeIngredients, ingredients]
  );
  const plannerRecipes = useMemo(
    () => buildPlannerRecipes(summaries, ingredientNames, preferences.defaultServings),
    [summaries, ingredientNames, preferences.defaultServings]
  );

  const dayPlans = useMemo(() => {
    if (!plan) {
      return [];
    }
    return buildDayPlans(weekStartDate, plan.budgets, {
      mode: 'cook',
      cookMinutes: settings.defaultWeeknightMinutes,
    }, {
      mode: 'cook',
      cookMinutes: settings.defaultWeekendMinutes,
    });
  }, [plan, weekStartDate, settings.defaultWeeknightMinutes, settings.defaultWeekendMinutes]);

  const progress = useMemo(() => weekProgress(plan?.slots ?? []), [plan]);
  const recipeNameById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe.name])),
    [recipes]
  );

  const estimated = useMemo(() => {
    if (!plan) {
      return null;
    }
    const meals = buildPlannedMeals(plan.slots, recipes, recipeIngredients, ingredients);
    const today = todayDate();
    const bestDeals = new Map<number, IngredientDeal>();
    const wanted = new Set<number>();
    for (const meal of meals) {
      for (const ingredient of meal.ingredients) {
        wanted.add(ingredient.ingredientId);
      }
    }
    for (const ingredientId of wanted) {
      const best = bestDealForIngredient(ingredientId, deals, dealMatches, today);
      if (best) {
        bestDeals.set(ingredientId, best);
      }
    }
    return buildShoppingList({ meals, pantryItems, bestDeals });
  }, [plan, recipes, recipeIngredients, ingredients, deals, dealMatches, pantryItems]);

  const handlePlanWeek = useCallback(async () => {
    if (!plan) {
      return;
    }
    setBusy(true);
    try {
      const proposal = planWeek({
        days: dayPlans.map((day) => ({
          day: day.day,
          mode: day.mode,
          cookMinutes: day.cookMinutes,
        })),
        recipes: plannerRecipes,
        defaultServings: preferences.defaultServings,
        mealType: 'dinner',
      });
      for (const slot of plan.slots) {
        await deleteSlot(slot.id);
      }
      let order = 0;
      for (const proposalSlot of proposal.slots) {
        if (proposalSlot.kind === 'empty') {
          continue;
        }
        await createSlot({
          weekId: plan.week.id,
          day: proposalSlot.day,
          mealType: proposalSlot.mealType,
          kind: proposalSlot.kind,
          recipeId: proposalSlot.recipeId,
          freeText: proposalSlot.freeText,
          servings: proposalSlot.servings,
          note: null,
          sortOrder: order,
        });
        order += 1;
      }
      for (const day of dayPlans) {
        await setDayBudget(plan.week.id, day.day, day.mode, day.cookMinutes);
      }
      await load();
      setToast(
        proposal.warnings.length > 0 ? proposal.warnings[0] : 'Week planned'
      );
    } finally {
      setBusy(false);
    }
  }, [plan, dayPlans, plannerRecipes, preferences.defaultServings, createSlot, deleteSlot, setDayBudget, load]);

  const handleRegenerate = useCallback(async () => {
    if (!plan) {
      return;
    }
    setBusy(true);
    try {
      await regenerateShoppingList(plan.week.id);
      router.push('/shopping');
    } finally {
      setBusy(false);
    }
  }, [plan, regenerateShoppingList, router]);

  const range = weekRange(weekStartDate);

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall">{range.start}</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {weekDayLabel('mon')} to {weekDayLabel('sun')}
        </Text>

        <View style={styles.statsRow}>
          <StatCard
            label="Meals"
            value={progress.planned}
            format={(value) => String(value)}
            tone="neutral"
          />
          <StatCard
            label="Est. cost"
            value={estimated ? estimated.estimatedTotalCents : null}
            format={formatCents}
            tone="pricey"
            sub={estimated ? `${estimated.pricedLines} priced` : null}
          />
          <StatCard
            label="Savings"
            value={estimated ? estimated.estimatedSavingsCents : null}
            format={formatCents}
            tone="saving"
          />
        </View>

        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="auto-fix"
            loading={busy}
            disabled={busy || !plan}
            onPress={handlePlanWeek}
            accessibilityLabel="Plan the week"
          >
            Plan the week
          </Button>
          <Button
            mode="outlined"
            icon="cart-outline"
            disabled={busy || !plan}
            onPress={handleRegenerate}
            accessibilityLabel="Build shopping list"
          >
            Shopping list
          </Button>
        </View>

        {!plan ? (
          <EmptyState message="Loading this week..." />
        ) : dayPlans.length === 0 ? (
          <EmptyState message="Nothing planned yet" actionLabel="Plan the week" onAction={handlePlanWeek} />
        ) : (
          dayPlans.map((day) => {
            const slots = plan.slots.filter((slot) => slot.day === day.day);
            return (
              <Card key={day.day} style={styles.card}>
                <Card.Content>
                  <View style={styles.dayHeader}>
                    <Text variant="titleMedium">{weekDayLabel(day.day)}</Text>
                    <Chip compact>{DAY_MODE_LABELS[day.mode]}</Chip>
                  </View>
                  <Divider style={styles.divider} />
                  {slots.length === 0 ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      No meal planned
                    </Text>
                  ) : (
                    slots.map((slot) => (
                      <Text key={slot.id} variant="bodyMedium" style={styles.slot}>
                        {slot.kind === 'recipe' && slot.recipeId !== null
                          ? recipeNameById.get(slot.recipeId) ?? 'Recipe'
                          : slot.kind === 'leftovers'
                            ? 'Leftovers'
                            : slot.freeText ?? 'Note'}
                      </Text>
                    ))
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}
      </KeyboardAwareScrollView>
      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    marginTop: 4,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    marginVertical: 8,
  },
  slot: {
    marginTop: 4,
  },
});
