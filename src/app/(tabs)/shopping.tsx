import React, { useCallback, useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button, Card, Checkbox, Chip, Divider, FAB, Switch, Text, TextInput } from 'react-native-paper';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { AppDialog } from '../../components/app-dialog';
import { NumberField } from '../../components/number-field';
import { OptionField } from '../../components/option-field';
import { ScreenToast } from '../../components/screen-toast';
import { useAppData, type WeekPlan } from '../../data/DataProvider';
import { useAppTheme } from '../../theme';
import { INGREDIENT_CATEGORIES, UNITS, type IngredientCategory, type Unit } from '../../models';
import { AISLE_ROUTE } from '../../services/shopping-list-service';
import { CATEGORY_LABELS, UNIT_LABELS } from '../../utils/labels';
import { formatCents } from '../../utils/currency';
import { formatDate, todayDate, weekStart } from '../../utils/date';
import { formatShoppingListText } from '../../utils/shopping-text';

const CATEGORY_OPTIONS = INGREDIENT_CATEGORIES.map((category) => ({
  value: category,
  label: CATEGORY_LABELS[category],
}));
const UNIT_OPTIONS = UNITS.map((unit) => ({ value: unit, label: UNIT_LABELS[unit] }));

export default function ShoppingScreen() {
  const theme = useAppTheme();
  const {
    settings,
    homes,
    defaultHome,
    loadWeekPlan,
    setShoppingItemChecked,
    addManualShoppingItem,
    removeShoppingItem,
    regenerateShoppingList,
  } = useAppData();

  const [weekStartDate] = useState(() => weekStart(todayDate()));
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [quantity, setQuantity] = useState<number | null>(1);
  const [unit, setUnit] = useState<Unit | null>('piece');
  const [category, setCategory] = useState<IngredientCategory | null>('other');
  const [homeId, setHomeId] = useState<number | null>(defaultHome?.id ?? null);
  const [saleOnly, setSaleOnly] = useState(false);

  const load = useCallback(async () => {
    setPlan(await loadWeekPlan(weekStartDate));
  }, [loadWeekPlan, weekStartDate]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const items = useMemo(() => plan?.shoppingItems ?? [], [plan]);
  const priced = items.filter((item) => item.priceCents !== null);
  const totalCents = priced.reduce((sum, item) => sum + (item.priceCents ?? 0), 0);
  const homeOptions = useMemo(
    () => homes.map((home) => ({ value: home.id, label: home.name })),
    [homes]
  );

  const homeGroups = useMemo(() => {
    const defaultId = defaultHome?.id ?? homes[0]?.id ?? null;
    const homeName = (id: number | null) =>
      homes.find((home) => home.id === id)?.name ?? 'Shopping';
    const build = (id: number | null) => {
      const homeItems = items.filter((item) => (item.homeId ?? defaultId) === id);
      return {
        homeId: id,
        homeName: homeName(id),
        saleOnly: homeItems.filter((item) => item.saleOnly),
        groups: AISLE_ROUTE.map((category) => ({
          category,
          items: homeItems.filter((item) => !item.saleOnly && item.category === category),
        })).filter((group) => group.items.length > 0),
      };
    };
    const known = homes.map((home) => build(home.id));
    const orphanIds = [
      ...new Set(
        items
          .map((item) => item.homeId)
          .filter((id): id is number => id !== null && !homes.some((home) => home.id === id))
      ),
    ];
    const orphans = orphanIds.map((id) => build(id));
    return [...known, ...orphans].filter(
      (group) => group.saleOnly.length > 0 || group.groups.length > 0
    );
  }, [items, homes, defaultHome]);

  const handleRegenerate = useCallback(async () => {
    if (!plan) {
      return;
    }
    setBusy(true);
    try {
      await regenerateShoppingList(plan.week.id);
      await load();
    } finally {
      setBusy(false);
    }
  }, [plan, regenerateShoppingList, load]);

  const handleShare = useCallback(async () => {
    if (items.length === 0) {
      return;
    }
    setShareBusy(true);
    try {
      const message = formatShoppingListText(items, {
        title: `Shopping list · ${formatDate(weekStartDate, 'D MMM')}`,
      });
      await Share.share({ message });
      setToast('Shopping list shared');
    } catch {
      setToast('Could not open the share sheet');
    } finally {
      setShareBusy(false);
    }
  }, [items, weekStartDate]);

  const handleAdd = useCallback(async () => {
    if (!plan || label.trim() === '' || quantity === null || unit === null || category === null) {
      return;
    }
    await addManualShoppingItem(plan.week.id, {
      label: label.trim(),
      category,
      quantity,
      unit,
      homeId: homeId ?? defaultHome?.id ?? null,
      saleOnly,
    });
    setDialogOpen(false);
    setLabel('');
    setQuantity(1);
    setUnit('piece');
    setCategory('other');
    setSaleOnly(false);
    await load();
  }, [plan, label, quantity, unit, category, homeId, defaultHome, saleOnly, addManualShoppingItem, load]);

  const renderItem = useCallback(
    (item: WeekPlan['shoppingItems'][number]) => (
      <View key={item.id} style={styles.itemRow}>
        <Checkbox
          status={item.checked ? 'checked' : 'unchecked'}
          onPress={() => void setShoppingItemChecked(item.id, !item.checked).then(load)}
        />
        <View style={styles.itemBody}>
          <Text variant="bodyMedium">{item.label}</Text>
          <Text variant="bodySmall">
            {item.quantity} {UNIT_LABELS[item.unit]}
            {item.priceCents !== null
              ? ` · ${formatCents(item.priceCents, settings.currency)}`
              : ''}
            {item.saleOnly ? ' · only if on sale' : ''}
          </Text>
        </View>
        <Button compact onPress={() => void removeShoppingItem(item.id).then(load)}>
          Remove
        </Button>
      </View>
    ),
    [setShoppingItemChecked, load, settings.currency, removeShoppingItem]
  );

  return (
    <ScreenFade>
      <View style={styles.container}>
        <KeyboardAwareScrollView contentContainerStyle={styles.content}>
          <View style={styles.summary}>
            <Text variant="titleLarge">{formatCents(totalCents, settings.currency)}</Text>
            <Text variant="bodySmall">
              {priced.length} of {items.length} priced from deals
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
            <Button
              mode="outlined"
              icon="refresh"
              loading={busy}
              disabled={busy}
              onPress={handleRegenerate}
              accessibilityLabel="Regenerate the shopping list from the plan"
            >
              Regenerate from plan
            </Button>
            <Button
              mode="outlined"
              icon="share-variant"
              loading={shareBusy}
              disabled={shareBusy || items.length === 0}
              onPress={handleShare}
              accessibilityLabel="Share the shopping list"
            >
              Share list
            </Button>
          </View>
          {items.length === 0 ? (
            <EmptyState
              message="No shopping list yet"
              actionLabel="Build from plan"
              onAction={handleRegenerate}
            />
          ) : (
            homeGroups.map((homeGroup) => (
              <View key={homeGroup.homeId ?? 'default'} style={{ gap: theme.spacing[3] }}>
                {homeGroups.length > 1 ? (
                  <Text variant="titleMedium">{homeGroup.homeName}</Text>
                ) : null}
                {homeGroup.saleOnly.length > 0 ? (
                  <Card style={styles.card}>
                    <Card.Content>
                      <View style={[styles.summaryRow, { gap: theme.spacing[1] }]}>
                        <Text variant="titleSmall">Only if on sale</Text>
                        <Chip compact icon="sale">Wish</Chip>
                      </View>
                      <Divider style={styles.divider} />
                      {homeGroup.saleOnly.map((item) => renderItem(item))}
                    </Card.Content>
                  </Card>
                ) : null}
                {homeGroup.groups.map((group) => (
                  <Card key={`${homeGroup.homeId ?? 'default'}-${group.category}`} style={styles.card}>
                    <Card.Content>
                      <Text variant="titleSmall">{CATEGORY_LABELS[group.category]}</Text>
                      <Divider style={styles.divider} />
                      {group.items.map((item) => renderItem(item))}
                    </Card.Content>
                  </Card>
                ))}
              </View>
            ))
          )}
        </KeyboardAwareScrollView>
        <FAB icon="plus" style={styles.fab} onPress={() => setDialogOpen(true)} accessibilityLabel="Add item" />
      </View>

      <AppDialog visible={dialogOpen} onDismiss={() => setDialogOpen(false)}>
        <AppDialog.Title>Add item</AppDialog.Title>
        <AppDialog.Content>
          <TextInput label="Item" value={label} onChangeText={setLabel} mode="outlined" />
          <NumberField label="Quantity" value={quantity} onChange={setQuantity} />
          <OptionField label="Unit" value={unit} options={UNIT_OPTIONS} onChange={setUnit} />
          <OptionField
            label="Category"
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={setCategory}
          />
          <OptionField
            label="Home"
            value={homeId}
            options={homeOptions}
            emptyLabel="Main home"
            onChange={setHomeId}
          />
          <View style={styles.switchRow}>
            <View style={styles.itemBody}>
              <Text variant="bodyLarge">Only if on sale</Text>
              <Text variant="bodySmall">Banana buys it only when it is discounted.</Text>
            </View>
            <Switch value={saleOnly} onValueChange={setSaleOnly} />
          </View>
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button onPress={() => setDialogOpen(false)}>Cancel</Button>
          <Button onPress={handleAdd}>Add</Button>
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
  content: {
    padding: 16,
    gap: 12,
  },
  summary: {
    alignItems: 'flex-start',
  },
  card: {},
  divider: {
    marginVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemBody: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
