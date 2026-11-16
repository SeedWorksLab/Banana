import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Chip, Divider, FAB, IconButton, List, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { StatCard } from '../../components/stat-card';
import { ScreenToast } from '../../components/screen-toast';
import { AppDialog } from '../../components/app-dialog';
import { NumberField } from '../../components/number-field';
import { OptionField } from '../../components/option-field';
import { useAppTheme } from '../../theme';
import { useAppData, type WeekPlan } from '../../data/DataProvider';
import { MEAL_MODES, MEAL_TYPES, type DayMode, type MealMode, type MealType, type WeekDay } from '../../models';
import { computeRatings } from '../../services/recipe-service';
import { recommendRecipes } from '../../services/discovery-service';
import {
  isSpeechRecognitionAvailable,
  requestSpeechRecognitionPermission,
  startLiveTranscription,
  type LiveTranscriptionHandle,
} from '../../ai/speech-recognition';
import {
  buildIngredientFactsByRecipe,
  buildIngredientNamesByRecipe,
  buildPlannedMeals,
  buildPlannerRecipes,
  buildRecipeSummaries,
} from '../../data/selectors';
import { buildShoppingList } from '../../services/shopping-list-service';
import { bestDealForIngredient, isDealActive, type IngredientDeal } from '../../services/deal-service';
import { allowsRecipeForMeal, mealSettingsForDay } from '../../services/meal-settings-service';
import { buildDayPlans, weekProgress, weekRange } from '../../services/week-service';
import { formatCents } from '../../utils/currency';
import { addDays, formatDate, todayDate, weekStart } from '../../utils/date';
import { DAY_MODE_LABELS, MEAL_TYPE_LABELS, weekDayLabel } from '../../utils/labels';
import { expiringIngredients, soonLabel } from '../../services/expiry-service';

const MEAL_MODE_OPTIONS = MEAL_MODES.map((mode) => ({
  value: mode,
  label: mode === 'eating_out' ? 'Eating out' : DAY_MODE_LABELS[mode],
}));

export default function PlanScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const {
    settings,
    preferences,
    recipes,
    recipeIngredients,
    recipeTags,
    recipeHistory,
    ingredients,
    pantryItems,
    homes,
    defaultHome,
    deals,
    dealMatches,
    applyPlanInstruction,
    planWeekMeals,
    setMealBudget,
    setDayWish,
    loadWeekPlan,
    regenerateShoppingList,
  } = useAppData();

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStartDate = useMemo(
    () => addDays(weekStart(todayDate()), weekOffset * 7),
    [weekOffset]
  );
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<WeekDay | null>(null);
  const [editMode, setEditMode] = useState<MealMode>('cook');
  const [editMealType, setEditMealType] = useState<MealType>('dinner');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editMinutes, setEditMinutes] = useState<number | null>(30);
  const [editServings, setEditServings] = useState<number | null>(2);
  const [editWishRecipeId, setEditWishRecipeId] = useState<number | null>(null);
  const [editWishText, setEditWishText] = useState('');
  const [dictating, setDictating] = useState(false);
  const dictationRef = useRef<LiveTranscriptionHandle | null>(null);
  const [editHomeId, setEditHomeId] = useState<number | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentText, setAgentText] = useState('');
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentDictating, setAgentDictating] = useState(false);
  const agentDictationRef = useRef<LiveTranscriptionHandle | null>(null);
  const startingDictationRef = useRef(false);
  const dictationAttempt = useRef(0);
  useEffect(() => () => {
    dictationAttempt.current += 1;
    dictationRef.current?.abort();
    agentDictationRef.current?.abort();
  }, []);

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
  const ingredientFacts = useMemo(
    () => buildIngredientFactsByRecipe(recipeIngredients, ingredients),
    [recipeIngredients, ingredients]
  );
  const stockedIngredientIds = useMemo(
    () =>
      new Set(
        pantryItems
          .filter((item) => item.level === 'stocked')
          .map((item) => item.ingredientId)
      ),
    [pantryItems]
  );
  const onOfferIngredientIds = useMemo(() => {
    const today = todayDate();
    const activeDealIds = new Set(
      deals.filter((deal) => isDealActive(deal, today)).map((deal) => deal.id)
    );
    return new Set(
      dealMatches
        .filter((match) => match.status !== 'rejected' && activeDealIds.has(match.dealId))
        .map((match) => match.ingredientId)
    );
  }, [deals, dealMatches]);
  const plannerRecipes = useMemo(
    () =>
      buildPlannerRecipes(summaries, ingredientNames, preferences.defaultServings, {
        factsByRecipe: ingredientFacts,
        stockedIngredientIds,
        onOfferIngredientIds,
      }),
    [
      summaries,
      ingredientNames,
      ingredientFacts,
      stockedIngredientIds,
      onOfferIngredientIds,
      preferences.defaultServings,
    ]
  );
  const discoverySuggestions = useMemo(() => {
    const stats = computeRatings(recipeHistory);
    const cookCounts = new Map<number, number>();
    for (const entry of recipeHistory) {
      cookCounts.set(entry.recipeId, (cookCounts.get(entry.recipeId) ?? 0) + 1);
    }
    const plannedRecipeIds = (plan?.slots ?? [])
      .map((slot) => slot.recipeId)
      .filter((id): id is number => id !== null);
    return recommendRecipes(
      plannerRecipes.map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        ingredientIds: recipe.ingredientIds,
        ingredientNames: recipe.ingredientNames,
        onOfferIngredientIds: recipe.onOfferIngredientIds,
        isFavorite: recipe.isFavorite,
        timesCooked: cookCounts.get(recipe.id) ?? 0,
        averageRating: stats.get(recipe.id)?.averageRating ?? null,
      })),
      {
        dislikedNames: preferences.dislikes,
        skipRecipeIds: plannedRecipeIds,
        limit: 4,
      }
    );
  }, [plannerRecipes, recipeHistory, plan, preferences.dislikes]);

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
    }, preferences.defaultServings);
  }, [plan, weekStartDate, settings.defaultWeeknightMinutes, settings.defaultWeekendMinutes, preferences.defaultServings]);

  const progress = useMemo(() => weekProgress(plan?.slots ?? []), [plan]);
  const recipeNameById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe.name])),
    [recipes]
  );
  const wishOptions = useMemo(
    () => summaries.filter((recipe) => allowsRecipeForMeal(recipe, {
      mealType: editMealType, mode: editMode, cookMinutes: editMinutes ?? 45, enabled: true,
    })).sort((a, b) => a.name.localeCompare(b.name)).map((recipe) => ({
      value: recipe.id,
      label: recipe.name,
    })),
    [summaries, editMealType, editMode, editMinutes]
  );
  const homeByDay = useMemo(
    () => new Map((plan?.budgets ?? []).map((budget) => [budget.day, budget.homeId])),
    [plan]
  );
  const homeNameById = useMemo(
    () => new Map(homes.map((home) => [home.id, home.name])),
    [homes]
  );
  const homeOptions = useMemo(
    () => homes.map((home) => ({ value: home.id, label: home.name })),
    [homes]
  );
  const activeHomeId = defaultHome?.id ?? homes[0]?.id ?? null;
  const useSoon = useMemo(
    () =>
      expiringIngredients(
        pantryItems.filter((item) => activeHomeId === null || item.homeId === activeHomeId),
        todayDate(),
        3
      ),
    [pantryItems, activeHomeId]
  );
  const ingredientNameById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient.name])),
    [ingredients]
  );

  const estimated = useMemo(() => {
    if (!plan) {
      return null;
    }
    const meals = buildPlannedMeals(plan.slots, recipes, recipeIngredients, ingredients, plan.budgets, defaultHome?.id ?? null, recipeTags);
    const today = todayDate();
    const bestDeals = new Map<number, IngredientDeal>();
    const wanted = new Set<number>();
    for (const meal of meals) {
      for (const ingredient of meal.ingredients) {
        wanted.add(ingredient.ingredientId);
      }
    }
    for (const ingredientId of wanted) {
      const best = bestDealForIngredient(
        ingredientId,
        deals,
        dealMatches,
        today,
        settings.currency
      );
      if (best) {
        bestDeals.set(ingredientId, best);
      }
    }
    return buildShoppingList({ meals, pantryItems, bestDeals });
  }, [
    plan,
    recipes,
    recipeIngredients,
    ingredients,
    deals,
    dealMatches,
    pantryItems,
    settings.currency,
    defaultHome,
    recipeTags,
  ]);

  const handlePlanWeek = useCallback(async () => {
    if (!plan) {
      return;
    }
    setBusy(true);
    try {
      await planWeekMeals(plan.week.id);
      await load();
      setToast('Week planned: breakfast, lunch and dinner. Unfilled meals need a suitable recipe.');
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not plan the week');
    } finally {
      setBusy(false);
    }
  }, [plan, planWeekMeals, load]);

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

  const openDayEditor = useCallback((day: { day: WeekDay; mode: DayMode; cookMinutes: number; servings: number }, mealType: MealType = 'dinner') => {
    const budget = plan?.budgets.find((entry) => entry.day === day.day);
    const meal = mealSettingsForDay(budget ?? day).find((entry) => entry.mealType === mealType);
    const wish = plan?.slots.find((slot) => slot.day === day.day && slot.mealType === mealType && slot.pinned);
    setEditingDay(day.day);
    setEditMealType(mealType);
    setEditEnabled(meal?.enabled ?? mealType !== 'snack');
    setEditMode(meal?.mode ?? 'cook');
    setEditMinutes(meal?.cookMinutes ?? day.cookMinutes);
    setEditServings(day.servings);
    setEditHomeId(homeByDay.get(day.day) ?? activeHomeId);
    setEditWishRecipeId(wish?.recipeId ?? null);
    setEditWishText(wish?.freeText ?? '');
  }, [homeByDay, activeHomeId, plan]);

  const handleSaveDay = useCallback(async () => {
    if (!plan || editingDay === null || editMinutes === null || editServings === null) {
      return;
    }
    if (editMinutes < 0 || editServings <= 0) {
      setToast('Use a non-negative time and at least one serving');
      return;
    }
    dictationRef.current?.abort();
    dictationRef.current = null;
    setDictating(false);
    setBusy(true);
    try {
      await setMealBudget(plan.week.id, editingDay, {
        mealType: editMealType, mode: editMode, cookMinutes: editMinutes, enabled: editEnabled,
      }, editServings, editHomeId);
      if (editEnabled) await setDayWish(
        plan.week.id,
        editingDay,
        editWishRecipeId,
        editWishRecipeId === null ? editWishText : null,
        editServings,
        editMealType
      );
      await load();
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not save the meal');
    } finally {
      setBusy(false);
      setEditingDay(null);
    }
  }, [plan, editingDay, editMode, editMinutes, editServings, editHomeId, editWishRecipeId, editWishText, setMealBudget, setDayWish, load, editMealType, editEnabled]);

  const closeDayEditor = useCallback(() => {
    dictationAttempt.current += 1;
    dictationRef.current?.abort();
    dictationRef.current = null;
    setDictating(false);
    setEditingDay(null);
  }, []);

  const stopDictation = useCallback(async (apply: boolean) => {
    const handle = dictationRef.current;
    dictationRef.current = null;
    if (!handle) {
      setDictating(false);
      return;
    }
    if (!apply) {
      handle.abort();
      setDictating(false);
      return;
    }
    await handle.stop();
    setDictating(false);
  }, []);

  const handleDictate = useCallback(async () => {
    if (startingDictationRef.current) return;
    if (dictating) {
      await stopDictation(true);
      return;
    }
    if (!isSpeechRecognitionAvailable()) {
      setToast('Speech recognition is not available on this device');
      return;
    }
    startingDictationRef.current = true;
    const attempt = ++dictationAttempt.current;
    try {
      const granted = await requestSpeechRecognitionPermission();
      if (attempt !== dictationAttempt.current) return;
      if (!granted) {
        setToast('Microphone permission is needed to dictate');
        return;
      }
      dictationRef.current = startLiveTranscription({
        language: settings.language,
        contextualStrings: recipes.map((recipe) => recipe.name),
        onTranscript: (text) => {
          setEditWishRecipeId(null);
          setEditWishText([editWishText.trim(), text].filter(Boolean).join(' '));
        },
        onError: (message) => {
          setToast(message);
          setDictating(false);
          dictationRef.current = null;
        },
      });
      setDictating(true);
      void dictationRef.current.finished.then(() => {
        if (attempt === dictationAttempt.current) setDictating(false);
      });
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not start dictation');
    } finally {
      startingDictationRef.current = false;
    }
  }, [dictating, recipes, stopDictation, settings.language, editWishText]);


  const sendAgentInstruction = useCallback(
    async (text: string) => {
      if (!plan || text.trim() === '') {
        return;
      }
      setAgentBusy(true);
      try {
        const outcome = await applyPlanInstruction(plan.week.id, text.trim());
        setAgentText('');
        setAgentOpen(false);
        await load();
        setToast(outcome.message);
      } catch (caught) {
        setToast(caught instanceof Error ? caught.message : 'Could not update the plan');
      } finally {
        setAgentBusy(false);
      }
    },
    [plan, applyPlanInstruction, load]
  );

  const startAgentDictation = useCallback(async () => {
    if (agentDictating || agentBusy || startingDictationRef.current) {
      return;
    }
    if (!isSpeechRecognitionAvailable()) {
      setToast('Speech recognition is not available on this device');
      return;
    }
    startingDictationRef.current = true;
    const attempt = ++dictationAttempt.current;
    try {
      const granted = await requestSpeechRecognitionPermission();
      if (attempt !== dictationAttempt.current) return;
      if (!granted) {
        setToast('Microphone permission is needed to talk');
        return;
      }
      agentDictationRef.current = startLiveTranscription({
        language: settings.language,
        contextualStrings: recipes.map((recipe) => recipe.name),
        onTranscript: setAgentText,
        onError: (message) => {
          setToast(message);
          setAgentDictating(false);
          agentDictationRef.current = null;
        },
      });
      setAgentDictating(true);
      void agentDictationRef.current.finished.then(() => {
        if (attempt === dictationAttempt.current) setAgentDictating(false);
      });
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not start dictation');
    } finally {
      startingDictationRef.current = false;
    }
  }, [agentDictating, agentBusy, recipes, settings.language]);

  const stopAgentDictation = useCallback(
    async (apply: boolean) => {
      if (!apply) dictationAttempt.current += 1;
      const handle = agentDictationRef.current;
      agentDictationRef.current = null;
      if (!handle) {
        setAgentDictating(false);
        return;
      }
      if (!apply) {
        handle.abort();
        setAgentDictating(false);
        return;
      }
      const result = await handle.stop();
      setAgentDictating(false);
      const text = result?.text?.trim();
      if (text) {
        setAgentText(text);
        await sendAgentInstruction(text);
      }
    },
    [sendAgentInstruction]
  );

  const range = weekRange(weekStartDate);

  return (
    <ScreenFade>
      <View style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <View style={styles.weekHeader}>
          <View style={styles.weekTitle}>
            <Text variant="headlineSmall">{formatDate(range.start, 'D MMM')}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {weekOffset === 1 ? 'Next week' : 'This week'}, {weekDayLabel('mon')} to {weekDayLabel('sun')}
            </Text>
          </View>
          <SegmentedButtons
            value={weekOffset === 0 ? 'current' : 'next'}
            onValueChange={(value) => setWeekOffset(value === 'next' ? 1 : 0)}
            buttons={[
              { value: 'current', label: 'This week' },
              { value: 'next', label: 'Next week' },
            ]}
          />
        </View>

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
            format={(value) => formatCents(value, settings.currency)}
            tone="pricey"
            sub={estimated ? `${estimated.pricedLines} priced` : null}
          />
          <StatCard
            label="Savings"
            value={estimated ? estimated.estimatedSavingsCents : null}
            format={(value) => formatCents(value, settings.currency)}
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

        {useSoon.length > 0 ? (
          <Card style={styles.card}>
            <Card.Title
              title="Use soon"
              subtitle={`At ${defaultHome?.name ?? 'your home'}`}
              left={(props) => <List.Icon {...props} icon="clock-alert-outline" />}
            />
            <Card.Content>
              <View style={[styles.expiryRow, { gap: theme.spacing[1] }]}>
                {useSoon.map((item) => (
                  <Chip
                    key={`${item.ingredientId}-${item.expiresOn}`}
                    compact
                    icon="leaf"
                  >
                    {ingredientNameById.get(item.ingredientId) ?? 'Ingredient'} · {soonLabel(item.daysLeft)}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        ) : null}

        {discoverySuggestions.length > 0 ? (
          <Card style={styles.card}>
            <Card.Title
              title="Try something new"
              subtitle="From your recipes, with current offers in mind"
            />
            <Card.Content>
              {discoverySuggestions.map((item) => (
                <List.Item
                  key={item.recipeId}
                  title={item.name}
                  description={item.reason}
                  left={(props) => <List.Icon {...props} icon="compass-outline" />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => router.push(`/recipe/${item.recipeId}`)}
                  accessibilityLabel={`Open ${item.name}`}
                />
              ))}
            </Card.Content>
          </Card>
        ) : null}

        {!plan ? (
          <EmptyState message="Loading this week..." />
        ) : (
          dayPlans.map((day) => {
            const slots = plan.slots.filter((slot) => slot.day === day.day);
            const meals = mealSettingsForDay(plan.budgets.find((budget) => budget.day === day.day) ?? day);
            const isToday = day.date === todayDate();
            const homeName = homeNameById.get(homeByDay.get(day.day) ?? activeHomeId);
            return (
              <Card key={day.day} testID={`day-card-${day.day}`}
                style={[styles.card, isToday ? {
                  borderColor: theme.colors.primary,
                  borderWidth: theme.spacing[1] / 2,
                } : null]}>
                <Card.Content>
                  <View style={styles.dayHeader}>
                    <View style={{ flex: 1, gap: theme.spacing[1] }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <Text variant="titleSmall">{weekDayLabel(day.day)}</Text>
                        {isToday ? <Text variant="labelMedium" accessibilityLabel="Today"
                          style={{ color: theme.colors.onPrimaryContainer, backgroundColor: theme.colors.primaryContainer,
                            borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing[2], paddingVertical: theme.spacing[1] }}>
                          Today
                        </Text> : null}
                      </View>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {day.servings} people{homeName ? ` · ${homeName}` : ''}
                      </Text>
                    </View>
                      <IconButton
                        icon="tune"
                        size={18}
                        onPress={() => openDayEditor(day)}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${weekDayLabel(day.day)}`}
                      />
                  </View>
                  <Divider style={{ marginVertical: theme.spacing[1] }} />
                  {meals.filter((meal) => meal.enabled || slots.some((slot) => slot.mealType === meal.mealType)).map((meal) => {
                    const slot = slots.find((entry) => entry.mealType === meal.mealType);
                    const label = slot?.kind === 'recipe' && slot.recipeId !== null
                      ? recipeNameById.get(slot.recipeId) ?? 'Recipe'
                      : slot?.kind === 'leftovers' ? 'Leftovers' : slot?.freeText ?? 'Not planned';
                    return (
                      <View key={meal.mealType} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                        <View style={{ flex: 1, paddingVertical: theme.spacing[1] }}>
                          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                            {MEAL_TYPE_LABELS[meal.mealType]} · {meal.mode === 'eating_out' ? 'Eating out' : `${meal.cookMinutes} min · ${DAY_MODE_LABELS[meal.mode]}`}
                          </Text>
                        {slot?.recipeId ? (
                          <Pressable onPress={() => router.push(`/recipe/${slot.recipeId}`)}
                            accessibilityRole="button" accessibilityLabel={`Open ${label}`}
                            style={{ minHeight: theme.spacing[7], justifyContent: 'center' }}>
                            <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                              {label}{slot.pinned ? ' · pinned' : ''}
                            </Text>
                          </Pressable>
                        ) : <Text variant="bodyMedium">{label}{slot?.pinned ? ' · pinned' : ''}</Text>}
                        </View>
                        <IconButton icon="pencil-outline" size={18} onPress={() => openDayEditor(day, meal.mealType)}
                          accessibilityRole="button" accessibilityLabel={`Edit ${weekDayLabel(day.day)} ${MEAL_TYPE_LABELS[meal.mealType]}`}
                          testID={`slot-${meal.mealType}-${day.day}`} />
                      </View>
                    );
                  })}
                  {!meals.some((meal) => meal.mealType === 'snack' && meal.enabled) ? (
                    <Button compact icon="plus" onPress={() => openDayEditor(day, 'snack')}
                      accessibilityRole="button" accessibilityLabel={`Add snack on ${weekDayLabel(day.day)}`}>Add snack</Button>
                  ) : null}
                </Card.Content>
              </Card>
            );
          })
        )}
      </KeyboardAwareScrollView>
      <FAB
        icon="message-text-outline"
        style={styles.fab}
        onPress={() => setAgentOpen(true)}
        accessibilityLabel="Ask Banana to change the plan"
      />
      </View>
      <AppDialog visible={agentOpen} onDismiss={() => {
        void stopAgentDictation(false);
        setAgentOpen(false);
      }}>
        <AppDialog.Title>Change the plan</AppDialog.Title>
        <AppDialog.Content>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Say what changed. Banana changes only what it has to.
          </Text>
          <TextInput
            label="Message"
            mode="outlined"
            multiline
            value={agentText}
            onChangeText={setAgentText}
            style={{ marginTop: theme.spacing[3] }}
          />
          <Pressable
            onPress={() => void (agentDictating ? stopAgentDictation(true) : startAgentDictation())}
            disabled={agentBusy}
            accessibilityRole="button"
            accessibilityLabel={agentDictating ? 'Stop and send to Banana' : 'Start talking to Banana'}
            accessibilityState={{ busy: agentDictating, disabled: agentBusy }}
            style={({ pressed }) => [
              styles.talkButton,
              {
                backgroundColor:
                  pressed || agentDictating
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceVariant,
                borderRadius: theme.radii.pill,
                marginTop: theme.spacing[3],
              },
            ]}
          >
            <MaterialCommunityIcons
              name={agentDictating ? 'stop-circle-outline' : 'microphone'}
              size={22}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="labelLarge">
              {agentDictating ? 'Stop and send' : 'Start dictation'}
            </Text>
          </Pressable>
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button onPress={() => { void stopAgentDictation(false); setAgentOpen(false); }}>Cancel</Button>
          <Button
            loading={agentBusy}
            disabled={agentBusy || agentDictating || agentText.trim() === ''}
            onPress={() => void sendAgentInstruction(agentText)}
          >
            Send
          </Button>
        </AppDialog.Actions>
      </AppDialog>
      <AppDialog visible={editingDay !== null} onDismiss={closeDayEditor}>
        <AppDialog.Title>
          {editingDay !== null ? `${weekDayLabel(editingDay)} · ${MEAL_TYPE_LABELS[editMealType]}` : 'Meal'}
        </AppDialog.Title>
        <AppDialog.Content>
          <KeyboardAwareScrollView style={{ maxHeight: theme.spacing[10] * 5 }}>
          <OptionField label="Meal" value={editMealType}
            options={MEAL_TYPES.map((value) => ({ value, label: MEAL_TYPE_LABELS[value] }))}
            nullable={false} onChange={(value) => {
              const day = dayPlans.find((entry) => entry.day === editingDay);
              if (value && day) openDayEditor(day, value);
            }} />
          {editMealType === 'snack' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>Plan a snack</Text>
              <Switch value={editEnabled} onValueChange={setEditEnabled} accessibilityRole="switch"
                accessibilityLabel="Plan a snack" accessibilityState={{ checked: editEnabled }} />
            </View>
          ) : null}
          <OptionField
            label="Meal mode"
            value={editMode}
            options={MEAL_MODE_OPTIONS}
            nullable={false}
            onChange={(value) => {
              if (value !== null) {
                setEditMode(value);
                setEditWishRecipeId(null);
              }
            }}
          />
          <NumberField
            label="Cooking minutes for this meal"
            value={editMinutes}
            integer
            onChange={setEditMinutes}
          />
          <NumberField
            label="People eating that day"
            value={editServings}
            integer
            onChange={setEditServings}
          />
          <OptionField
            label="Home for that day"
            value={editHomeId}
            options={homeOptions}
            emptyLabel="Main home"
            onChange={setEditHomeId}
          />
          <View style={{ marginTop: theme.spacing[2] }}>
            <OptionField
              label="Food wish"
              value={editWishRecipeId}
              options={wishOptions}
              emptyLabel="No wish"
              onChange={(value) => {
                setEditWishRecipeId(value);
                if (value !== null) {
                  setEditWishText('');
                }
              }}
            />
            <TextInput
              label="Or type a wish"
              mode="outlined"
              value={editWishText}
              onChangeText={(value) => {
                setEditWishText(value);
                if (value.trim() !== '') {
                  setEditWishRecipeId(null);
                }
              }}
              style={{ marginTop: theme.spacing[2] }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing[2],
                marginTop: theme.spacing[2],
              }}
            >
              <Button
                mode={dictating ? 'contained' : 'outlined'}
                icon={dictating ? 'stop' : 'microphone'}
                onPress={handleDictate}
                accessibilityLabel={dictating ? 'Stop dictating the wish' : 'Dictate the wish'}
              >
                {dictating ? 'Stop' : 'Dictate'}
              </Button>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {dictating ? 'Listening...' : 'Speak a wish instead of typing'}
              </Text>
            </View>
          </View>
          </KeyboardAwareScrollView>
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button onPress={closeDayEditor}>Cancel</Button>
          <Button disabled={busy || dictating} loading={busy} onPress={handleSaveDay}
            accessibilityRole="button" accessibilityLabel="Save meal settings">Save</Button>
        </AppDialog.Actions>
      </AppDialog>
      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  expiryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  talkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
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
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekTitle: {
    flexShrink: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    marginVertical: 8,
  },
});
