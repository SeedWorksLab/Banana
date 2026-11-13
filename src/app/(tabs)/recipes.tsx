import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, FAB, Searchbar, Text, TextInput } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { AppDialog } from '../../components/app-dialog';
import { ScreenToast } from '../../components/screen-toast';
import { useAppData } from '../../data/DataProvider';
import { useAppTheme } from '../../theme';
import {
  isSpeechRecognitionAvailable,
  requestSpeechRecognitionPermission,
  startLiveTranscription,
  type LiveTranscriptionHandle,
} from '../../ai/speech-recognition';
import { buildRecipeSummaries } from '../../data/selectors';
import { filterRecipes, totalMinutes } from '../../services/recipe-service';
import { MEAL_TYPES, type MealType } from '../../models';
import { MEAL_TYPE_LABELS } from '../../utils/labels';
import { formatMinutes } from '../../utils/date';

export default function RecipesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { recipes, recipeTags, createRecipesFromText } = useAppData();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MealType | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [dictationOpen, setDictationOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [dictating, setDictating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dictationRef = useRef<LiveTranscriptionHandle | null>(null);

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

  const startDictation = useCallback(async () => {
    if (dictating) {
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
  }, [dictating, recipes]);

  const stopDictation = useCallback(async () => {
    const handle = dictationRef.current;
    dictationRef.current = null;
    setDictating(false);
    if (!handle) {
      return;
    }
    const result = await handle.stop();
    if (result?.text) {
      setTranscript((current) => [current.trim(), result.text.trim()].filter(Boolean).join('\n'));
    }
  }, []);

  const closeDictation = useCallback(() => {
    dictationRef.current?.abort();
    dictationRef.current = null;
    setDictating(false);
    setDictationOpen(false);
  }, []);

  const saveDictation = useCallback(async () => {
    if (transcript.trim() === '') {
      return;
    }
    setBusy(true);
    try {
      const result = await createRecipesFromText(transcript);
      setTranscript('');
      setDictationOpen(false);
      setToast(result.message);
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not save the recipe');
    } finally {
      setBusy(false);
    }
  }, [transcript, createRecipesFromText]);

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
                    {recipes.find((candidate) => candidate.id === recipe.id)?.isWish ? (
                      <Chip compact icon="star-outline">
                        Wish
                      </Chip>
                    ) : null}
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </KeyboardAwareScrollView>
        <FAB
          icon="microphone"
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => setDictationOpen(true)}
          accessibilityLabel="Dictate a recipe"
        />
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => router.push('/recipe/new')}
          accessibilityLabel="Add recipe"
        />
      </View>
      <AppDialog visible={dictationOpen} onDismiss={closeDictation}>
        <AppDialog.Title>Dictate a recipe</AppDialog.Title>
        <AppDialog.Content>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Say the ingredients and steps in your own words. Banana saves them without changing
            what you said.
          </Text>
          <TextInput
            label="Recipe"
            mode="outlined"
            multiline
            value={transcript}
            onChangeText={setTranscript}
            style={{ marginTop: theme.spacing[3], minHeight: 120 }}
          />
          <Pressable
            onPressIn={() => void startDictation()}
            onPressOut={() => void stopDictation()}
            accessibilityRole="button"
            accessibilityLabel="Hold to dictate the recipe"
            accessibilityState={{ busy: dictating, disabled: busy }}
            style={({ pressed }) => [
              styles.talkButton,
              {
                backgroundColor:
                  pressed || dictating
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceVariant,
                borderRadius: theme.radii.pill,
                marginTop: theme.spacing[3],
              },
            ]}
          >
            <MaterialCommunityIcons
              name={dictating ? 'stop-circle-outline' : 'microphone'}
              size={22}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="labelLarge">{dictating ? 'Listening…' : 'Hold to talk'}</Text>
          </Pressable>
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button onPress={closeDictation}>Cancel</Button>
          <Button
            loading={busy}
            disabled={busy || transcript.trim() === ''}
            onPress={() => void saveDictation()}
          >
            Save recipes
          </Button>
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
  fabSecondary: {
    bottom: 88,
  },
  talkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
