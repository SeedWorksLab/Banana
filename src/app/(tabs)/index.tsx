import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Chip, Divider, IconButton, List, SegmentedButtons, Text, TextInput } from 'react-native-paper';

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
import { DAY_MODES, type DayMode, type WeekDay } from '../../models';
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
import { planWeek } from '../../services/planning-service';
import { buildDayPlans, weekProgress, weekRange } from '../../services/week-service';
import { formatCents } from '../../utils/currency';
import { addDays, formatDate, todayDate, weekStart } from '../../utils/date';
import { DAY_MODE_LABELS, weekDayLabel } from '../../utils/labels';

const DAY_MODE_OPTIONS = DAY_MODES.map((mode) => ({
  value: mode,
  label: DAY_MODE_LABELS[mode],
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
    deals,
    dealMatches,
    createSlot,
    deleteSlot,
    setDayBudget,
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
  const [editMode, setEditMode] = useState<DayMode>('cook');
  const [editMinutes, setEditMinutes] = useState<number | null>(30);
  const [editServings, setEditServings] = useState<number | null>(2);
  const [editWishRecipeId, setEditWishRecipeId] = useState<number | null>(null);
  const [editWishText, setEditWishText] = useState('');
  const [dictating, setDictating] = useState(false);
  const dictationRef = useRef<LiveTranscriptionHandle | null>(null);

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
    () => [...recipes].sort((a, b) => a.name.localeCompare(b.name)).map((recipe) => ({
      value: recipe.id,
      label: recipe.name,
    })),
    [recipes]
  );
  const wishByDay = useMemo(() => {
    const map = new Map<WeekDay, { recipeId: number | null; freeText: string | null }>();
    for (const slot of plan?.slots ?? []) {
      if (slot.pinned && slot.mealType === 'dinner') {
        map.set(slot.day, { recipeId: slot.recipeId, freeText: slot.freeText });
      }
    }
    return map;
  }, [plan]);

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
  ]);

  const handlePlanWeek = useCallback(async () => {
    if (!plan) {
      return;
    }
    setBusy(true);
    try {
      const pinned = plan.slots
        .filter((slot) => slot.pinned && (slot.kind === 'recipe' || slot.kind === 'free_text'))
        .map((slot) => ({
          day: slot.day,
          mealType: slot.mealType,
          recipeId: slot.recipeId,
          freeText: slot.freeText,
        }));
      const proposal = planWeek({
        days: dayPlans.map((day) => ({
          day: day.day,
          mode: day.mode,
          cookMinutes: day.cookMinutes,
          servings: day.servings,
        })),
        recipes: plannerRecipes,
        history: recipeHistory,
        pinned,
        defaultServings: preferences.defaultServings,
        mealType: 'dinner',
      });
      for (const slot of plan.slots) {
        if (!slot.pinned) {
          await deleteSlot(slot.id);
        }
      }
      let order = 0;
      for (const proposalSlot of proposal.slots) {
        if (proposalSlot.kind === 'empty' || proposalSlot.reason === 'Pinned by you') {
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
        await setDayBudget(plan.week.id, day.day, day.mode, day.cookMinutes, day.servings);
      }
      await load();
      setToast(
        proposal.warnings.length > 0 ? proposal.warnings[0] : 'Week planned'
      );
    } finally {
      setBusy(false);
    }
  }, [plan, dayPlans, plannerRecipes, recipeHistory, preferences.defaultServings, createSlot, deleteSlot, setDayBudget, load]);

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

  const openDayEditor = useCallback((day: { day: WeekDay; mode: DayMode; cookMinutes: number; servings: number }, wish: { recipeId: number | null; freeText: string | null } | undefined) => {
    setEditingDay(day.day);
    setEditMode(day.mode);
    setEditMinutes(day.cookMinutes);
    setEditServings(day.servings);
    setEditWishRecipeId(wish?.recipeId ?? null);
    setEditWishText(wish?.freeText ?? '');
  }, []);

  const handleSaveDay = useCallback(async () => {
    if (!plan || editingDay === null || editMinutes === null || editServings === null) {
      return;
    }
    dictationRef.current?.abort();
    dictationRef.current = null;
    setDictating(false);
    setBusy(true);
    try {
      await setDayBudget(plan.week.id, editingDay, editMode, editMinutes, editServings);
      await setDayWish(
        plan.week.id,
        editingDay,
        editWishRecipeId,
        editWishRecipeId === null ? editWishText : null,
        editServings
      );
      await load();
    } finally {
      setBusy(false);
      setEditingDay(null);
    }
  }, [plan, editingDay, editMode, editMinutes, editServings, editWishRecipeId, editWishText, setDayBudget, setDayWish, load]);

  const closeDayEditor = useCallback(() => {
    dictationRef.current?.abort();
    dictationRef.current = null;
    setDictating(false);
    setEditingDay(null);
  }, []);

  const stopDictation = useCallback(async (apply: boolean) => {
    const handle = dictationRef.current;
    dictationRef.current = null;
    setDictating(false);
    if (!handle) {
      return;
    }
    if (!apply) {
      handle.abort();
      return;
    }
    const result = await handle.stop();
    if (result?.text) {
      setEditWishRecipeId(null);
      setEditWishText((current) => [current.trim(), result.text.trim()].filter(Boolean).join(' '));
    }
  }, []);

  const handleDictate = useCallback(async () => {
    if (dictating) {
      await stopDictation(true);
      return;
    }
    if (!isSpeechRecognitionAvailable()) {
      setToast('Speech recognition is not available on this device');
      return;
    }
    const granted = await requestSpeechRecognitionPermission();
    if (!granted) {
      setToast('Microphone permission is needed to dictate');
      return;
    }
    dictationRef.current = startLiveTranscription({
      language: 'en',
      contextualStrings: recipes.map((recipe) => recipe.name),
      onError: (message) => {
        setToast(message);
        setDictating(false);
        dictationRef.current = null;
      },
    });
    setDictating(true);
  }, [dictating, recipes, stopDictation]);

  const range = weekRange(weekStartDate);

  return (
    <ScreenFade>
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
        ) : dayPlans.length === 0 ? (
          <EmptyState message="Nothing planned yet" actionLabel="Plan the week" onAction={handlePlanWeek} />
        ) : (
          dayPlans.map((day) => {
            const slots = plan.slots.filter((slot) => slot.day === day.day);
            const wish = wishByDay.get(day.day);
            const wishName = wish?.freeText ?? (wish?.recipeId != null ? recipeNameById.get(wish.recipeId) ?? null : null);
            return (
              <Card key={day.day} style={styles.card}>
                <Card.Content>
                  <View style={styles.dayHeader}>
                    <Text variant="titleMedium">{weekDayLabel(day.day)}</Text>
                    <View style={[styles.dayMeta, { gap: theme.spacing[1] }]}>
                      <Chip compact>{DAY_MODE_LABELS[day.mode]}</Chip>
                      <Chip compact icon="clock-outline">
                        {day.cookMinutes} min
                      </Chip>
                      <Chip compact icon="account-multiple">
                        {day.servings}
                      </Chip>
                      <IconButton
                        icon="tune"
                        size={18}
                        onPress={() => openDayEditor(day, wish)}
                        accessibilityLabel={`Edit ${weekDayLabel(day.day)}`}
                      />
                    </View>
                  </View>
                  {wishName ? (
                    <Chip compact icon="star-outline" style={{ marginTop: theme.spacing[2] }}>
                      {wishName}
                    </Chip>
                  ) : null}
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
      <AppDialog visible={editingDay !== null} onDismiss={closeDayEditor}>
        <AppDialog.Title>
          {editingDay !== null ? weekDayLabel(editingDay) : 'Day'}
        </AppDialog.Title>
        <AppDialog.Content>
          <OptionField
            label="Day type"
            value={editMode}
            options={DAY_MODE_OPTIONS}
            nullable={false}
            onChange={(value) => value !== null && setEditMode(value)}
          />
          <NumberField
            label="Cook minutes"
            value={editMinutes}
            integer
            onChange={setEditMinutes}
          />
          <NumberField
            label="People eating"
            value={editServings}
            integer
            onChange={setEditServings}
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
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button onPress={closeDayEditor}>Cancel</Button>
          <Button onPress={handleSaveDay}>Save</Button>
        </AppDialog.Actions>
      </AppDialog>
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
  dayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  divider: {
    marginVertical: 8,
  },
  slot: {
    marginTop: 4,
  },
});
