import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Chip, FAB, Searchbar, Text } from 'react-native-paper';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { useAppData } from '../../data/DataProvider';
import { buildRecipeSummaries } from '../../data/selectors';
import { filterRecipes, totalMinutes } from '../../services/recipe-service';
import { MEAL_TYPES, type MealType } from '../../models';
import { MEAL_TYPE_LABELS } from '../../utils/labels';
import { formatMinutes } from '../../utils/date';

export default function RecipesScreen() {
  const router = useRouter();
  const { recipes, recipeTags } = useAppData();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MealType | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const summaries = useMemo(() => buildRecipeSummaries(recipes, recipeTags), [recipes, recipeTags]);
  const visible = useMemo(
    () =>
      filterRecipes(summaries, {
        query,
        category: category ?? undefined,
        favoriteOnly,
      }),
    [summaries, query, category, favoriteOnly]
  );

  return (
    <ScreenFade>
      <View style={styles.container}>
        <Searchbar
          placeholder="Search recipes"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip selected={favoriteOnly} onPress={() => setFavoriteOnly((value) => !value)}>
            Favorites
          </Chip>
          {MEAL_TYPES.map((mealType) => (
            <Chip
              key={mealType}
              selected={category === mealType}
              onPress={() => setCategory((value) => (value === mealType ? null : mealType))}
            >
              {MEAL_TYPE_LABELS[mealType]}
            </Chip>
          ))}
        </ScrollView>
        <KeyboardAwareScrollView contentContainerStyle={styles.list}>
          {visible.length === 0 ? (
            <EmptyState
              message="No recipes match"
              actionLabel="Add a recipe"
              onAction={() => router.push('/recipe/new')}
            />
          ) : (
            visible.map((recipe) => (
              <Card
                key={recipe.id}
                style={styles.card}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              >
                <Card.Content>
                  <View style={styles.row}>
                    <Text variant="titleMedium">{recipe.name}</Text>
                    <Text variant="bodySmall">{formatMinutes(totalMinutes(recipe))}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Chip compact>{MEAL_TYPE_LABELS[recipe.category]}</Chip>
                    {recipe.isFavorite ? (
                      <Chip compact icon="heart">
                        Favorite
                      </Chip>
                    ) : null}
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </KeyboardAwareScrollView>
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => router.push('/recipe/new')}
          accessibilityLabel="Add recipe"
        />
      </View>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  search: {
    margin: 16,
    marginBottom: 8,
  },
  chips: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
