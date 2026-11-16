import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Chip, Divider, IconButton, Text } from 'react-native-paper';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { ScreenToast } from '../../components/screen-toast';
import { useAppData } from '../../data/DataProvider';
import { pantryCoverage } from '../../services/pantry-service';
import { totalMinutes, recipeMealTypes, isEatingOut } from '../../services/recipe-service';
import { MEAL_TYPES } from '../../models';
import { formatMinutes } from '../../utils/date';
import { MEAL_TYPE_LABELS, UNIT_LABELS } from '../../utils/labels';

export default function RecipeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const recipeId = Number(params.id);
  const {
    recipes,
    recipeIngredients,
    recipeSteps,
    recipeTags,
    ingredients,
    pantryItems,
    defaultHome,
    addWishRecipeIngredients,
    saveRecipe,
    removeRecipe,
    replaceRecipeTags,
  } = useAppData();

  const [showSteps, setShowSteps] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const recipe = recipes.find((candidate) => candidate.id === recipeId) ?? null;

  if (!recipe) {
    return (
      <ScreenFade>
        <EmptyState message="Recipe not found" />
      </ScreenFade>
    );
  }

  const ingredientNameById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient.name]));
  const rows = recipeIngredients.filter((row) => row.recipeId === recipe.id);
  const requiredIngredientIds = rows
    .filter((row) => !row.optional)
    .map((row) => row.ingredientId);
  const homePantry =
    defaultHome === null
      ? pantryItems
      : pantryItems.filter((item) => item.homeId === defaultHome.id);
  const coverage = pantryCoverage(requiredIngredientIds, homePantry);
  const tags = recipeTags.filter((tag) => tag.recipeId === recipe.id).map((tag) => tag.tag);
  const steps = recipeSteps
    .filter((step) => step.recipeId === recipe.id)
    .sort((a, b) => a.stepIndex - b.stepIndex);

  async function toggleFavorite() {
    if (!recipe) {
      return;
    }
    await saveRecipe(recipe.id, {
      name: recipe.name,
      description: recipe.description,
      category: recipe.category,
      source: recipe.source,
      isBuiltin: recipe.isBuiltin,
      isFavorite: !recipe.isFavorite,
      isWish: recipe.isWish,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      notes: recipe.notes,
    });
  }

  async function handleDelete() {
    if (!recipe) {
      return;
    }
    await replaceRecipeTags(recipe.id, []);
    await removeRecipe(recipe.id);
    if (router.canGoBack()) {
      router.back();
    }
  }

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.grow}>
            <Text variant="headlineSmall">{recipe.name}</Text>
            <Text variant="bodySmall">{formatMinutes(totalMinutes(recipe))}</Text>
          </View>
          <IconButton
            icon={recipe.isFavorite ? 'heart' : 'heart-outline'}
            onPress={toggleFavorite}
            accessibilityLabel={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          />
        </View>
        {recipe.description ? <Text variant="bodyMedium">{recipe.description}</Text> : null}
        <View style={styles.chips}>
          {recipeMealTypes({ ...recipe, tags }).map((type) => <Chip key={type} compact>{MEAL_TYPE_LABELS[type]}</Chip>)}
          {isEatingOut({ tags }) ? <Chip compact icon="storefront-outline">Eating out</Chip> : null}
          <Chip compact>{recipe.servings} servings</Chip>
          {recipe.isWish ? (
            <Chip compact icon="star-outline">
              Wish
            </Chip>
          ) : null}
          {requiredIngredientIds.length > 0 ? (
            <Chip
              compact
              icon={coverage.missing.length === 0 ? 'check-circle-outline' : 'cart-outline'}
            >
              {coverage.missing.length === 0
                ? 'You have everything'
                : `${coverage.missing.length} to buy`}
            </Chip>
          ) : null}
          {tags.filter((tag) => !MEAL_TYPES.some((type) => type === tag) && tag !== 'eating_out').map((tag) => (
            <Chip key={tag} compact>
              {tag}
            </Chip>
          ))}
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall">Ingredients</Text>
            <Divider style={styles.divider} />
            {rows.length === 0 ? (
              <Text variant="bodySmall">No ingredients listed</Text>
            ) : (
              rows.map((row) => (
                <Text key={row.id} variant="bodyMedium" style={styles.line}>
                  {row.quantity} {UNIT_LABELS[row.unit]} {ingredientNameById.get(row.ingredientId) ?? ''}
                </Text>
              ))
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.headerRow}>
              <Text variant="titleSmall" style={styles.grow}>
                Steps
              </Text>
              <Button compact onPress={() => setShowSteps((value) => !value)}
                accessibilityRole="button" accessibilityLabel={showSteps ? 'Hide recipe steps' : 'Show recipe steps'}
                accessibilityState={{ expanded: showSteps }}>
                {showSteps ? 'Hide' : 'Show'}
              </Button>
            </View>
            <Divider style={styles.divider} />
            {showSteps ? (
              steps.length === 0 ? (
                <Text variant="bodySmall">No steps yet</Text>
              ) : (
                steps.map((step, index) => (
                  <Text key={step.id} variant="bodyMedium" style={styles.line}>
                    {index + 1}. {step.instruction}
                  </Text>
                ))
              )
            ) : (
              <Text variant="bodySmall">Open the steps only when you are cooking.</Text>
            )}
          </Card.Content>
        </Card>

        {recipe.isWish && defaultHome ? (
          <Button
            mode="contained-tonal"
            icon="cart-plus"
            onPress={() =>
              void addWishRecipeIngredients(recipe.id, defaultHome.id).then((count) => {
                setToast(
                  count === 0
                    ? 'You already have everything for this wish'
                    : `${count} missing ingredient${count === 1 ? '' : 's'} added to shopping`
                );
              })
            }
            accessibilityLabel="Add missing wish ingredients to the shopping list"
          >
            Add missing ingredients to shopping
          </Button>
        ) : null}

        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="pencil"
            onPress={() => router.push({ pathname: '/recipe/new', params: { id: String(recipe.id) } })}
          >
            Edit
          </Button>
          <Button mode="outlined" icon="delete-outline" onPress={handleDelete}>
            Delete
          </Button>
        </View>
      </KeyboardAwareScrollView>
      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {},
  divider: {
    marginVertical: 8,
  },
  line: {
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
});
