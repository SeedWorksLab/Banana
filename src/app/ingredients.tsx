import React, { useMemo, useState } from 'react';
import { Button, Card, List, Searchbar, Switch, Text, TextInput } from 'react-native-paper';
import { View } from 'react-native';
import { ScreenFade } from '../components/screen-fade';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { AppDialog } from '../components/app-dialog';
import { OptionField } from '../components/option-field';
import { NumberField } from '../components/number-field';
import { ScrollableTextInput } from '../components/scrollable-text-input';
import { ScreenToast } from '../components/screen-toast';
import { useAppData } from '../data/DataProvider';
import { useAppTheme } from '../theme';
import { INGREDIENT_CATEGORIES, UNITS, type Ingredient } from '../models';
import type { IngredientInput } from '../database/ingredients';
import { CATEGORY_LABELS, UNIT_LABELS } from '../utils/labels';

const EMPTY_INPUT: IngredientInput = {
  name: '', category: 'other', defaultUnit: 'g', defaultQuantity: null,
  isPantryStaple: false, shelfLifeDays: null, notes: null,
};

export default function IngredientsScreen() {
  const theme = useAppTheme();
  const { ingredients, addIngredient, saveIngredient } = useAppData();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [input, setInput] = useState<IngredientInput>(EMPTY_INPUT);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const visible = useMemo(() => ingredients
    .filter((ingredient) => ingredient.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)), [ingredients, query]);

  function edit(ingredient: Ingredient | null) {
    setEditingId(ingredient?.id ?? null);
    setInput(ingredient ? {
      name: ingredient.name, category: ingredient.category, defaultUnit: ingredient.defaultUnit,
      defaultQuantity: ingredient.defaultQuantity, isPantryStaple: ingredient.isPantryStaple,
      shelfLifeDays: ingredient.shelfLifeDays, notes: ingredient.notes,
    } : EMPTY_INPUT);
    setOpen(true);
  }

  async function save() {
    const name = input.name.trim();
    if (!name) return;
    if (ingredients.some((ingredient) => ingredient.id !== editingId &&
      ingredient.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setToast('An ingredient with that name already exists');
      return;
    }
    if ((input.defaultQuantity !== null && input.defaultQuantity < 0) ||
        (input.shelfLifeDays !== null && input.shelfLifeDays < 0)) {
      setToast('Quantities and shelf life must be zero or greater');
      return;
    }
    setBusy(true);
    try {
      const next = { ...input, name, notes: input.notes?.trim() || null };
      if (editingId === null) await addIngredient(next);
      else await saveIngredient(editingId, next);
      setOpen(false);
      setToast('Ingredient saved');
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not save the ingredient');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[3] }}>
        <Text variant="bodyMedium">Edit the ingredients Banana knows. Renaming an ingredient updates it everywhere it is used.</Text>
        <Searchbar value={query} onChangeText={setQuery} placeholder="Search ingredients"
          accessibilityRole="search" accessibilityLabel="Search known ingredients" />
        <Button mode="contained-tonal" icon="plus" onPress={() => edit(null)}
          accessibilityRole="button" accessibilityLabel="Add known ingredient" testID="ingredient-add">
          Add ingredient
        </Button>
        <Card>
          {visible.map((ingredient) => (
            <List.Item key={ingredient.id} title={ingredient.name}
              description={`${CATEGORY_LABELS[ingredient.category]} · ${UNIT_LABELS[ingredient.defaultUnit]}`}
              right={(props) => <List.Icon {...props} icon="pencil-outline" />}
              onPress={() => edit(ingredient)} accessibilityRole="button"
              accessibilityLabel={`Edit ${ingredient.name}`} testID={`ingredient-${ingredient.id}`} />
          ))}
          {visible.length === 0 ? <Card.Content><Text>No matching ingredients.</Text></Card.Content> : null}
        </Card>
      </KeyboardAwareScrollView>
      <AppDialog visible={open} onDismiss={() => !busy && setOpen(false)}>
        <AppDialog.Title>{editingId === null ? 'Add ingredient' : 'Edit ingredient'}</AppDialog.Title>
        <AppDialog.Content>
          <KeyboardAwareScrollView style={{ maxHeight: theme.spacing[10] * 5 }}>
            <TextInput mode="outlined" label="Name" value={input.name}
              onChangeText={(name) => setInput({ ...input, name })} accessibilityLabel="Ingredient name" />
            <OptionField label="Category" value={input.category} nullable={false}
              options={INGREDIENT_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))}
              onChange={(category) => category !== null && setInput({ ...input, category })} />
            <OptionField label="Default unit" value={input.defaultUnit} nullable={false}
              options={UNITS.map((value) => ({ value, label: UNIT_LABELS[value] }))}
              onChange={(defaultUnit) => defaultUnit !== null && setInput({ ...input, defaultUnit })} />
            <NumberField label="Default quantity (optional)" value={input.defaultQuantity}
              onChange={(defaultQuantity) => setInput({ ...input, defaultQuantity })} />
            <NumberField label="Shelf life in days (optional)" integer value={input.shelfLifeDays}
              onChange={(shelfLifeDays) => setInput({ ...input, shelfLifeDays })} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
              <Text>Pantry staple</Text>
              <Switch value={input.isPantryStaple}
                onValueChange={(isPantryStaple) => setInput({ ...input, isPantryStaple })}
                accessibilityRole="switch" accessibilityLabel="Pantry staple"
                accessibilityState={{ checked: input.isPantryStaple }} />
            </View>
            <ScrollableTextInput mode="outlined" label="Notes" multiline value={input.notes ?? ''}
              onChangeText={(notes) => setInput({ ...input, notes })} accessibilityLabel="Ingredient notes" />
          </KeyboardAwareScrollView>
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button disabled={busy} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Cancel ingredient edit">Cancel</Button>
          <Button loading={busy} disabled={busy || !input.name.trim()} onPress={() => void save()}
            accessibilityRole="button" accessibilityLabel="Save ingredient">Save</Button>
        </AppDialog.Actions>
      </AppDialog>
      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </ScreenFade>
  );
}
