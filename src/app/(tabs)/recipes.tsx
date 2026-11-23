import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, FAB, Searchbar, Text } from 'react-native-paper';
import { ScrollableTextInput } from '../../components/scrollable-text-input';
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
import { filterRecipes, totalMinutes, recipeMealTypes, isEatingOut } from '../../services/recipe-service';
import { MEAL_TYPES, type MealType } from '../../models';
import { MEAL_TYPE_LABELS } from '../../utils/labels';
import { formatMinutes } from '../../utils/date';

export default function RecipesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { settings, recipes, recipeTags, createRecipesFromText } = useAppData();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MealType | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [eatingOutOnly, setEatingOutOnly] = useState(false);
  const [dictationOpen, setDictationOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [dictating, setDictating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dictationRef = useRef<LiveTranscriptionHandle | null>(null);
  const startingRef = useRef(false);
  const dictationAttempt = useRef(0);
  useEffect(() => () => {
    dictationAttempt.current += 1;
    dictationRef.current?.abort();
  }, []);

  const summaries = useMemo(() => buildRecipeSummaries(recipes, recipeTags), [recipes, recipeTags]);
  const visible = useMemo(
    () =>
      filterRecipes(summaries, {
        query,
        category: category ?? undefined,
         favoriteOnly,
          tags: eatingOutOnly ? ['eating_out'] : [],
      }),
    [summaries, query, category, favoriteOnly, eatingOutOnly]
  );

  const startDictation = useCallback(async () => {
    if (dictating || startingRef.current) {
      return;
    }
    if (!isSpeechRecognitionAvailable()) {
      setToast('Speech recognition is not available on this device');
      return;
    }
    startingRef.current = true;
    const attempt = ++dictationAttempt.current;
    try {
      const granted = await requestSpeechRecognitionPermission(settings.language);
      if (attempt !== dictationAttempt.current) return;
      if (!granted) {
        setToast('Microphone permission is needed to dictate');
        return;
      }
      dictationRef.current = startLiveTranscription({
        language: settings.language,
        contextualStrings: recipes.map((recipe) => recipe.name),
        onProcessing: setTranscribing,
        onTranscript: (text) => setTranscript([transcript.trim(), text].filter(Boolean).join('\n')),
        onError: (message) => {
          setToast(message);
          setDictating(false);
          dictationRef.current = null;
        },
      });
      setDictating(true);
      void dictationRef.current.finished.then(() => {
        if (attempt === dictationAttempt.current) setDictating(false);
      });
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not start dictation');
    } finally {
      startingRef.current = false;
    }
  }, [dictating, recipes, settings.language, transcript]);

  const stopDictation = useCallback(async () => {
    const handle = dictationRef.current;
    if (!handle) {
      return;
    }
    await handle.stop();
    if (dictationRef.current === handle) {
      dictationRef.current = null;
      setDictating(false);
    }
  }, []);

  const closeDictation = useCallback(() => {
    dictationAttempt.current += 1;
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          testID="recipe-filters"
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ gap: theme.spacing[2], paddingHorizontal: theme.spacing[4], paddingVertical: theme.spacing[2], alignItems: 'center' }}>
          <Chip selected={favoriteOnly} onPress={() => setFavoriteOnly((value) => !value)}
            accessibilityRole="checkbox" accessibilityLabel="Filter favorite recipes"
            accessibilityState={{ checked: favoriteOnly }}>
            Favorites
          </Chip>
          {MEAL_TYPES.map((mealType) => (
            <Chip
              key={mealType}
              selected={category === mealType}
              onPress={() => setCategory((value) => (value === mealType ? null : mealType))}
              accessibilityRole="checkbox" accessibilityLabel={`Filter ${MEAL_TYPE_LABELS[mealType]}`}
              accessibilityState={{ checked: category === mealType }}
            >
              {MEAL_TYPE_LABELS[mealType]}
            </Chip>
          ))}
          <Chip selected={eatingOutOnly} onPress={() => setEatingOutOnly((value) => !value)}
            accessibilityRole="checkbox" accessibilityLabel="Filter eating out"
            accessibilityState={{ checked: eatingOutOnly }}>
            Eating out
          </Chip>
        </ScrollView>
        <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
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
                  <View style={[styles.row, { gap: theme.spacing[2], alignItems: 'flex-start' }]}>
                    <Text variant="titleMedium" style={{ flex: 1, minWidth: 0 }}
                      testID={`recipe-name-${recipe.id}`}>{recipe.name}</Text>
                    <Text variant="bodySmall" style={{ flexShrink: 0 }}
                      testID={`recipe-duration-${recipe.id}`}>{formatMinutes(totalMinutes(recipe))}</Text>
                  </View>
                  <View style={[styles.metaRow, { flexWrap: 'wrap' }]}>
                    {recipeMealTypes(recipe).map((type) => <Chip key={type} compact>{MEAL_TYPE_LABELS[type]}</Chip>)}
                    {isEatingOut(recipe) ? <Chip compact>Eating out</Chip> : null}
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
          <ScrollableTextInput
            label="Recipe"
            mode="outlined"
            multiline
            value={transcript}
            onChangeText={setTranscript}
            style={{ marginTop: theme.spacing[3] }}
          />
          <Pressable
            onPress={() => void (dictating ? stopDictation() : startDictation())}
            disabled={busy || transcribing}
            accessibilityRole="button"
            accessibilityLabel={transcribing ? 'Transcribing recipe' : dictating ? 'Stop recipe dictation' : 'Start recipe dictation'}
            accessibilityState={{ busy: dictating, disabled: busy || transcribing }}
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
            <Text variant="labelLarge">{transcribing ? 'Transcribing…' : dictating ? 'Stop dictation' : 'Start dictation'}</Text>
          </Pressable>
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button onPress={closeDictation}>Cancel</Button>
          <Button
            loading={busy}
            disabled={busy || dictating || transcript.trim() === ''}
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
