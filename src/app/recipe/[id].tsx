import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Divider, IconButton, Text } from 'react-native-paper';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { useAppData } from '../../data/DataProvider';
import { totalMinutes } from '../../services/recipe-service';
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
    saveRecipe,
    removeRecipe,
    replaceRecipeTags,
  } = useAppData();

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
          <Chip compact>{MEAL_TYPE_LABELS[recipe.category]}</Chip>
          <Chip compact>{recipe.servings} servings</Chip>
          {tags.map((tag) => (
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
              rows.map((row: any) => (
                <Text key={row.id} variant="bodyMedium" style={styles.line}>
                  {row.quantity} {UNIT_LABELS[row.unit]} {ingredientNameById.get(row.ingredientId) ?? ''}
                </Text>
              ))
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall">Steps</Text>
            <Divider style={styles.divider} />
            {steps.length === 0 ? (
              <Text variant="bodySmall">No steps yet</Text>
            ) : (
              steps.map((step: any, index: number) => (
                <Text key={step.id} variant="bodyMedium" style={styles.line}>
                  {index + 1}. {step.instruction}
                </Text>
              ))
            )}
          </Card.Content>
        </Card>

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
