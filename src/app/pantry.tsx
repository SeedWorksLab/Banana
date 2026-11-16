import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  List,
  Text,
  TextInput,
} from 'react-native-paper';

import { ScreenFade } from '../components/screen-fade';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { EmptyState } from '../components/empty-state';
import { AppDialog } from '../components/app-dialog';
import { OptionField } from '../components/option-field';
import { NumberField } from '../components/number-field';
import { ScreenToast } from '../components/screen-toast';
import { useAppData } from '../data/DataProvider';
import { useAppTheme } from '../theme';
import { PANTRY_LEVELS, UNITS, type PantryItem, type PantryLevel, type Unit } from '../models';
import { estimateExpiryDate, expiringIngredients, soonLabel } from '../services/expiry-service';
import { CATEGORY_LABELS, PANTRY_LEVEL_LABELS, UNIT_LABELS } from '../utils/labels';
import { todayDate } from '../utils/date';

const LEVEL_OPTIONS = PANTRY_LEVELS.map((level) => ({
  value: level,
  label: PANTRY_LEVEL_LABELS[level],
}));

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function PantryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const {
    ingredients,
    pantryItems,
    homes,
    defaultHome,
    savePantryItem,
    removePantryItem,
    addHome,
    renameHome,
    removeHome,
  } = useAppData();
  const [homeId, setHomeId] = useState<number | null>(defaultHome?.id ?? null);
  const [homeDialogOpen, setHomeDialogOpen] = useState(false);
  const [newHomeName, setNewHomeName] = useState('');
  const [homeNames, setHomeNames] = useState<Record<number, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [editIngredientId, setEditIngredientId] = useState<number | null>(null);
  const [editLevel, setEditLevel] = useState<PantryLevel>('stocked');
  const [editExpiry, setEditExpiry] = useState('');
  const [adding, setAdding] = useState(false);
  const [editQuantity, setEditQuantity] = useState<number | null>(null);
  const [editUnit, setEditUnit] = useState<Unit>('g');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const activeHomeId = homeId ?? defaultHome?.id ?? null;
  const ingredientById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients]
  );
  const homeItems = useMemo(
    () => pantryItems.filter((item) => activeHomeId === null || item.homeId === activeHomeId),
    [pantryItems, activeHomeId]
  );
  const stockedIds = useMemo(() => new Set(homeItems.map((item) => item.ingredientId)), [homeItems]);
  const addable = useMemo(
    () => ingredients.filter((ingredient) => !stockedIds.has(ingredient.id)),
    [ingredients, stockedIds]
  );
  const expiring = useMemo(
    () => expiringIngredients(homeItems, todayDate(), 3),
    [homeItems]
  );
  const grouped = useMemo(() => {
    const categories = [...new Set(homeItems.map((item) => ingredientById.get(item.ingredientId)?.category ?? 'other'))];
    return categories.map((category) => ({
      category,
      items: homeItems.filter(
        (item) => (ingredientById.get(item.ingredientId)?.category ?? 'other') === category
      ),
    }));
  }, [homeItems, ingredientById]);

  const openAdd = useCallback(() => {
    if (ingredients.length === 0) {
      router.push('/ingredients');
      return;
    }
    if (addable.length === 0) {
      setToast('Everything you have is already in the pantry');
      return;
    }
    setAdding(true);
    setEditIngredientId(null);
    setEditLevel('stocked');
    setEditQuantity(null);
    setEditUnit('g');
    setEditExpiry('');
    setEditOpen(true);
  }, [addable, ingredients.length, router]);

  const openEdit = useCallback((item: PantryItem) => {
    setAdding(false);
    setEditIngredientId(item.ingredientId);
    setEditLevel(item.level);
    setEditQuantity(item.quantity);
    setEditUnit(item.unit ?? ingredientById.get(item.ingredientId)?.defaultUnit ?? 'g');
    setEditExpiry(item.expiresOn ?? '');
    setEditOpen(true);
  }, [ingredientById]);

  const saveItem = useCallback(async () => {
    if (editIngredientId === null || activeHomeId === null) {
      return;
    }
    const ingredient = ingredientById.get(editIngredientId);
    if (!ingredient) {
      return;
    }
    if (editQuantity !== null && editQuantity < 0) {
      setToast('Quantity must be zero or greater');
      return;
    }
    if (editExpiry.trim() !== '' && !isDate(editExpiry.trim())) {
      setToast('Use a date like 2026-11-16');
      return;
    }
    setBusy(true);
    try {
      const expiresOn =
        editLevel === 'stocked'
          ? editExpiry.trim() !== ''
            ? editExpiry.trim()
            : estimateExpiryDate(
                todayDate(),
                ingredient.name,
                ingredient.category,
                ingredient.shelfLifeDays
              )
          : null;
      await savePantryItem({
        ingredientId: editIngredientId,
        homeId: activeHomeId,
        level: editLevel,
        quantity: editLevel === 'out' ? 0 : editQuantity,
        unit: editQuantity === null && editLevel !== 'out' ? null : editUnit,
        expiresOn,
      });
      setEditOpen(false);
      setToast('Pantry updated');
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not save the pantry item');
    } finally {
      setBusy(false);
    }
  }, [editIngredientId, activeHomeId, ingredientById, editExpiry, editLevel, editQuantity, editUnit, savePantryItem]);

  const removeItem = useCallback(async () => {
    if (editIngredientId === null || activeHomeId === null) {
      return;
    }
    await removePantryItem(editIngredientId, activeHomeId);
    setEditOpen(false);
    setToast('Removed from the pantry');
  }, [editIngredientId, activeHomeId, removePantryItem]);

  const handleAddHome = useCallback(async () => {
    const name = newHomeName.trim();
    if (name === '') {
      return;
    }
    await addHome(name);
    setNewHomeName('');
    setToast('Home added');
  }, [newHomeName, addHome]);

  return (
    <ScreenFade>
      <View style={styles.container}>
        <KeyboardAwareScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[3] }]}>
          <Card>
            <Card.Content>
              <View style={[styles.row, { gap: theme.spacing[2] }]}>
                <View style={styles.flex}>
                  <Text variant="titleMedium">Pantry</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    What is already in each home. Banana eats this first.
                  </Text>
                </View>
                <Button
                  mode="outlined"
                  icon="home-edit-outline"
                  onPress={() => setHomeDialogOpen(true)}
                  accessibilityLabel="Manage homes"
                >
                  Homes
                </Button>
              </View>
              <View style={[styles.wrapRow, { gap: theme.spacing[2], marginTop: theme.spacing[3] }]}>
                <Button mode="contained-tonal" icon="plus" onPress={openAdd}
                  accessibilityRole="button" accessibilityLabel="Add pantry item" testID="pantry-add">
                  Add item
                </Button>
                <Button onPress={() => router.push('/ingredients')} accessibilityRole="button"
                  accessibilityLabel="Manage known ingredients">
                  Known ingredients
                </Button>
              </View>
              <View style={[styles.wrapRow, { gap: theme.spacing[1], marginTop: theme.spacing[2] }]}>
                {homes.map((home) => (
                  <Chip
                    key={home.id}
                    selected={activeHomeId === home.id}
                    onPress={() => setHomeId(home.id)}
                    accessibilityLabel={`Show pantry at ${home.name}`}
                    accessibilityState={{ selected: activeHomeId === home.id }}
                  >
                    {home.name}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>

          {expiring.length > 0 ? (
            <Card>
              <Card.Title title="Use soon" subtitle="Before it goes to waste" />
              <Card.Content>
                <View style={[styles.wrapRow, { gap: theme.spacing[1] }]}>
                  {expiring.map((item) => (
                    <Chip key={item.ingredientId} compact icon="clock-alert-outline">
                      {ingredientById.get(item.ingredientId)?.name ?? 'Ingredient'} ·{' '}
                      {soonLabel(item.daysLeft)}
                    </Chip>
                  ))}
                </View>
              </Card.Content>
            </Card>
          ) : null}

          {homeItems.length === 0 ? (
            <EmptyState
              message="This pantry is empty"
              actionLabel="Add something"
              onAction={openAdd}
            />
          ) : (
            grouped.map((group) => (
              <Card key={group.category}>
                <Card.Content>
                  <Text variant="titleSmall">{CATEGORY_LABELS[group.category]}</Text>
                  <Divider style={{ marginVertical: theme.spacing[2] }} />
                  {group.items.map((item) => {
                    const ingredient = ingredientById.get(item.ingredientId);
                    return (
                      <List.Item
                        key={item.id}
                        title={ingredient?.name ?? 'Ingredient'}
                        description={[
                          PANTRY_LEVEL_LABELS[item.level],
                          item.quantity !== null && item.unit !== null
                            ? `About ${item.quantity} ${UNIT_LABELS[item.unit]}`
                            : null,
                          item.expiresOn !== null ? `use by ${item.expiresOn}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        left={(props) => <List.Icon {...props} icon="fridge-outline" />}
                        right={(props) => <List.Icon {...props} icon="chevron-right" />}
                        onPress={() => openEdit(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${ingredient?.name ?? 'ingredient'}`}
                      />
                    );
                  })}
                </Card.Content>
              </Card>
            ))
          )}
        </KeyboardAwareScrollView>
      </View>

      <AppDialog visible={editOpen} onDismiss={() => setEditOpen(false)}>
        <AppDialog.Title>
          {adding ? 'Add pantry item' : ingredientById.get(editIngredientId ?? -1)?.name ?? 'Pantry item'}
        </AppDialog.Title>
        <AppDialog.Content>
          <KeyboardAwareScrollView style={{ maxHeight: theme.spacing[10] * 5 }}>
          {adding ? (
            <>
              <OptionField
                label="Ingredient"
                value={editIngredientId}
                options={addable.map((ingredient) => ({ value: ingredient.id, label: ingredient.name }))}
                emptyLabel="Choose an ingredient"
                nullable={false}
                onChange={(value) => {
                  setEditIngredientId(value);
                  setEditUnit(ingredientById.get(value ?? -1)?.defaultUnit ?? 'g');
                }}
              />
              <Button accessibilityRole="button" accessibilityLabel="Add a new known ingredient"
                onPress={() => { setEditOpen(false); router.push('/ingredients'); }}>
                Ingredient missing? Add it
              </Button>
            </>
          ) : null}
          <OptionField
            label="Stock level"
            value={editLevel}
            options={LEVEL_OPTIONS}
            nullable={false}
            onChange={(value) => value !== null && setEditLevel(value)}
          />
          <NumberField
            label="Approximate quantity (optional)"
            value={editQuantity}
            onChange={setEditQuantity}
            helperText="For example, 500 g of butter. Leave blank if you only know the stock level."
          />
          <OptionField
            label="Unit"
            value={editUnit}
            options={UNITS.filter((unit) => unit !== 'to_taste').map((unit) => ({ value: unit, label: UNIT_LABELS[unit] }))}
            nullable={false}
            onChange={(value) => value !== null && setEditUnit(value)}
          />
          <TextInput
            label="Use by (optional)"
            mode="outlined"
            value={editExpiry}
            onChangeText={setEditExpiry}
            placeholder="YYYY-MM-DD"
            style={{ marginTop: theme.spacing[2] }}
          />
          {editLevel === 'stocked' && editExpiry.trim() === '' ? (
            <Text variant="bodySmall" style={{ marginTop: theme.spacing[1], color: theme.colors.onSurfaceVariant }}>
              Banana estimates a use-by date from the ingredient.
            </Text>
          ) : null}
          </KeyboardAwareScrollView>
        </AppDialog.Content>
        <AppDialog.Actions>
          {stockedIds.has(editIngredientId ?? -1) ? (
            <Button textColor={theme.semantic.error} onPress={() => void removeItem()}>
              Remove
            </Button>
          ) : null}
          <Button onPress={() => setEditOpen(false)}>Cancel</Button>
          <Button loading={busy} disabled={busy || editIngredientId === null} onPress={() => void saveItem()}
            accessibilityRole="button" accessibilityLabel="Save pantry item">
            Save
          </Button>
        </AppDialog.Actions>
      </AppDialog>

      <AppDialog visible={homeDialogOpen} onDismiss={() => setHomeDialogOpen(false)}>
        <AppDialog.Title>Homes</AppDialog.Title>
        <AppDialog.Content>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            The main home is used by default. Days can be routed to another home.
          </Text>
          {homes.map((home) => (
            <View key={home.id} style={[styles.homeRow, { gap: theme.spacing[2] }]}>
              <TextInput
                mode="outlined"
                value={homeNames[home.id] ?? home.name}
                onChangeText={(value) =>
                  setHomeNames((current) => ({ ...current, [home.id]: value }))
                }
                onBlur={() => {
                  const value = (homeNames[home.id] ?? home.name).trim();
                  if (value !== '' && value !== home.name) {
                    void renameHome(home.id, value);
                  }
                }}
                style={styles.flex}
                accessibilityLabel={`Rename ${home.name}`}
              />
              <IconButton
                icon="delete-outline"
                disabled={homes.length <= 1}
                onPress={() => void removeHome(home.id)}
                accessibilityLabel={`Delete ${home.name}`}
              />
            </View>
          ))}
          <View style={[styles.homeRow, { gap: theme.spacing[2], marginTop: theme.spacing[2] }]}>
            <TextInput
              mode="outlined"
              label="New home"
              value={newHomeName}
              onChangeText={setNewHomeName}
              style={styles.flex}
            />
            <Button onPress={() => void handleAddHome()}>Add</Button>
          </View>
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button onPress={() => setHomeDialogOpen(false)}>Done</Button>
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
    paddingBottom: 96,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  flex: {
    flex: 1,
  },
});
