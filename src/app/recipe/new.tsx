import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Chip, Switch, Text, TextInput } from 'react-native-paper';

import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { NumberField } from '../../components/number-field';
import { ScrollableTextInput } from '../../components/scrollable-text-input';
import { OptionField } from '../../components/option-field';
import { ScreenFade } from '../../components/screen-fade';
import { useAppData } from '../../data/DataProvider';
import { EATING_OUT_TAG, MEAL_TYPES, UNITS, type MealType, type Unit } from '../../models';
import { recipeMealTypes, isEatingOut } from '../../services/recipe-service';
import { useAppTheme } from '../../theme';
import { MEAL_TYPE_LABELS, UNIT_LABELS } from '../../utils/labels';

const UNIT_OPTIONS = UNITS.map((unit) => ({ value: unit, label: UNIT_LABELS[unit] }));

export default function RecipeEditorScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const recipeId = params.id ? Number(params.id) : null;
  const {
    recipes,
    recipeIngredients,
    recipeSteps,
    recipeTags,
    ingredients,
    addRecipe,
    saveRecipe,
    replaceRecipeIngredients,
    replaceRecipeSteps,
    replaceRecipeTags,
  } = useAppData();

  const existing = recipeId !== null ? recipes.find((recipe) => recipe.id === recipeId) ?? null : null;

  const [name, setName] = useState(existing?.name ?? '');
  const existingTags = recipeTags.filter((tag) => tag.recipeId === recipeId).map((tag) => tag.tag);
  const [mealTypes, setMealTypes] = useState<MealType[]>(() =>
    existing ? recipeMealTypes({ category: existing.category, tags: existingTags }) : ['dinner']);
  const [eatingOut, setEatingOut] = useState(() => isEatingOut({ tags: existingTags }));
  const [servings, setServings] = useState<number | null>(existing?.servings ?? 2);
  const [prepMinutes, setPrepMinutes] = useState<number | null>(existing?.prepMinutes ?? 10);
  const [cookMinutes, setCookMinutes] = useState<number | null>(existing?.cookMinutes ?? 20);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [tagsText, setTagsText] = useState(() =>
    recipeId !== null
      ? recipeTags
          .filter((tag) => tag.recipeId === recipeId)
           .map((tag) => tag.tag)
           .filter((tag) => !MEAL_TYPES.some((type) => type === tag) && tag !== EATING_OUT_TAG)
          .join(', ')
      : ''
  );
  const [steps, setSteps] = useState<string[]>(() => {
    if (recipeId === null) return [''];
    return recipeSteps
      .filter((step) => step.recipeId === recipeId)
      .sort((a, b) => a.stepIndex - b.stepIndex)
      .map((step) => step.instruction);
  });
  const [draftIngredients, setDraftIngredients] = useState<
    { ingredientId: number | null; quantity: number | null; unit: Unit }[]
  >(() => {
    if (recipeId === null) return [{ ingredientId: null, quantity: null, unit: 'g' }];
    return recipeIngredients
      .filter((row) => row.recipeId === recipeId)
      .map((row) => ({ ingredientId: row.ingredientId, quantity: row.quantity, unit: row.unit }));
  });
  const [busy, setBusy] = useState(false);

  const ingredientOptions = useMemo(
    () => ingredients.map((ingredient) => ({ value: ingredient.id, label: ingredient.name })),
    [ingredients]
  );

  async function handleSave() {
    if (name.trim() === '' || mealTypes.length === 0 || servings === null || prepMinutes === null || cookMinutes === null) {
      return;
    }
    setBusy(true);
    try {
      const input = {
        name: name.trim(),
        description: description.trim() === '' ? null : description.trim(),
        category: mealTypes[0],
        source: existing?.source ?? ('own'),
        isBuiltin: existing?.isBuiltin ?? false,
        isFavorite: existing?.isFavorite ?? false,
        isWish: existing?.isWish ?? false,
        servings,
        prepMinutes,
        cookMinutes,
        notes: existing?.notes ?? null,
      };
      const id = existing ? existing.id : await addRecipe(input);
      if (existing) {
        await saveRecipe(existing.id, input);
      }
      await replaceRecipeIngredients(
        id,
        draftIngredients
          .filter(
            (row): row is { ingredientId: number; quantity: number; unit: Unit } =>
              row.ingredientId !== null && row.quantity !== null
          )
          .map((row) => ({
            ingredientId: row.ingredientId,
            quantity: row.quantity,
            unit: row.unit,
            note: null,
            optional: false,
          }))
      );
      await replaceRecipeSteps(
        id,
        steps
          .map((instruction) => instruction.trim())
          .filter((instruction) => instruction !== '')
          .map((instruction) => ({ instruction, durationMinutes: null }))
      );
      await replaceRecipeTags(
        id,
        [...mealTypes, ...(eatingOut ? [EATING_OUT_TAG] : []), ...tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag !== '' && !MEAL_TYPES.some((type) => type === tag) && tag !== EATING_OUT_TAG)]
      );
      if (router.canGoBack()) {
        router.back();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" />
        <ScrollableTextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          multiline
        />
        <Text variant="titleSmall">Suitable meals (select one or more)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
          {MEAL_TYPES.map((type) => (
            <Chip key={type} selected={mealTypes.includes(type)} accessibilityRole="checkbox"
              accessibilityLabel={`Suitable for ${MEAL_TYPE_LABELS[type]}`}
              accessibilityState={{ checked: mealTypes.includes(type) }} testID={`recipe-meal-${type}`}
              onPress={() => setMealTypes((current) => current.includes(type)
                ? current.filter((entry) => entry !== type) : [...current, type])}>
              {MEAL_TYPE_LABELS[type]}
            </Chip>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text>Eating out</Text>
          <Switch value={eatingOut} onValueChange={(value) => {
            setEatingOut(value);
            if (value) { setPrepMinutes(0); setCookMinutes(0); }
          }} accessibilityRole="switch"
            accessibilityLabel="Eating out" accessibilityState={{ checked: eatingOut }} testID="recipe-eating-out" />
        </View>
        {eatingOut ? <Text variant="bodySmall">A place or meal bought outside, such as a pizza place. Planned only for meals marked Eating out.</Text> : null}
        <TextInput
          label="Tags"
          value={tagsText}
          onChangeText={setTagsText}
          mode="outlined"
          placeholder="comma separated"
        />
        <NumberField label="Prep minutes" value={prepMinutes} integer onChange={setPrepMinutes} />
        <NumberField label="Cook minutes" value={cookMinutes} integer onChange={setCookMinutes} />
        <NumberField label="Servings" value={servings} integer onChange={setServings} />

        <Text variant="titleMedium" style={styles.section}>
          Ingredients
        </Text>
        {draftIngredients.map((row, index) => (
          <View key={index} style={styles.ingredientRow}>
            <View style={styles.grow}>
              <OptionField
                label="Ingredient"
                value={row.ingredientId}
                options={ingredientOptions}
                onChange={(value) =>
                  setDraftIngredients((current) =>
                    current.map((item, i) => (i === index ? { ...item, ingredientId: value } : item))
                  )
                }
              />
            </View>
            <TextInput
              label="Qty"
              value={row.quantity === null ? '' : String(row.quantity)}
              onChangeText={(text) =>
                setDraftIngredients((current) =>
                  current.map((item, i) =>
                    i === index
                      ? { ...item, quantity: text === '' ? null : Number(text.replace(',', '.')) }
                      : item
                  )
                )
              }
              keyboardType="numeric"
              mode="outlined"
              style={styles.qty}
            />
            <OptionField
              label="Unit"
              value={row.unit}
              options={UNIT_OPTIONS}
              nullable={false}
              onChange={(value) =>
                setDraftIngredients((current) =>
                  current.map((item, i) => (i === index && value !== null ? { ...item, unit: value } : item))
                )
              }
            />
          </View>
        ))}
        <Button
          icon="plus"
          onPress={() =>
            setDraftIngredients((current) => [
              ...current,
              { ingredientId: null, quantity: null, unit: 'g' },
            ])
          }
        >
          Add ingredient
        </Button>

        <Text variant="titleMedium" style={styles.section}>
          Steps
        </Text>
        {steps.map((step, index) => (
          <ScrollableTextInput
            key={index}
            label={`Step ${index + 1}`}
            value={step}
            onChangeText={(text) =>
              setSteps((current) => current.map((item, i) => (i === index ? text : item)))
            }
            mode="outlined"
            multiline
          />
        ))}
        <Button icon="plus" onPress={() => setSteps((current) => [...current, ''])}>
          Add step
        </Button>

        <Button mode="contained" loading={busy} disabled={busy || mealTypes.length === 0} onPress={handleSave} style={styles.save}
          accessibilityRole="button" accessibilityLabel={existing ? 'Save recipe' : 'Create recipe'}>
          {existing ? 'Save recipe' : 'Create recipe'}
        </Button>
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  section: {
    marginTop: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  grow: {
    flex: 1,
  },
  save: {
    marginTop: 8,
  },
  qty: {
    width: 80,
  },
});
