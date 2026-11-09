import React, { useCallback, useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button, Card, Checkbox, Divider, FAB, Text, TextInput } from 'react-native-paper';

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

  const groups = useMemo(() => {
    return AISLE_ROUTE.map((cat) => ({
      category: cat,
      items: items.filter((item) => item.category === cat),
    })).filter((group) => group.items.length > 0);
  }, [items]);

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
    });
    setDialogOpen(false);
    setLabel('');
    setQuantity(1);
    setUnit('piece');
    setCategory('other');
    await load();
  }, [plan, label, quantity, unit, category, addManualShoppingItem, load]);

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
              accessibilityLabel="Share the shopping list to Google Keep"
            >
              Share to Keep
            </Button>
          </View>
          {items.length === 0 ? (
            <EmptyState
              message="No shopping list yet"
              actionLabel="Build from plan"
              onAction={handleRegenerate}
            />
          ) : (
            groups.map((group) => (
              <Card key={group.category} style={styles.card}>
                <Card.Content>
                  <Text variant="titleSmall">{CATEGORY_LABELS[group.category]}</Text>
                  <Divider style={styles.divider} />
                  {group.items.map((item) => (
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
                        </Text>
                      </View>
                      <Button compact onPress={() => void removeShoppingItem(item.id).then(load)}>
                        Remove
                      </Button>
                    </View>
                  ))}
                </Card.Content>
              </Card>
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
