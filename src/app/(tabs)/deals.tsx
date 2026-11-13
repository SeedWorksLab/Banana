import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text, TextInput } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { AppDialog } from '../../components/app-dialog';
import { ScreenToast } from '../../components/screen-toast';
import { useAppData } from '../../data/DataProvider';
import {
  isSpeechRecognitionAvailable,
  requestSpeechRecognitionPermission,
  startLiveTranscription,
  type LiveTranscriptionHandle,
} from '../../ai/speech-recognition';
import { useAppTheme } from '../../theme';
import { isDealActive, savingsPercent } from '../../services/deal-service';
import { STORE_LABELS } from '../../utils/labels';
import { formatCents } from '../../utils/currency';
import { formatDate, todayDate } from '../../utils/date';

export default function DealsScreen() {
  const theme = useAppTheme();
  const {
    stores,
    deals,
    dealMatches,
    ingredients,
    setDealMatchStatus,
    importNewspaperText,
    refreshDeals,
    refreshingDeals,
    lastDealRefresh,
  } = useAppData();
  const today = todayDate();
  const [leafletOpen, setLeafletOpen] = useState(false);
  const [leafletText, setLeafletText] = useState('');
  const [dictating, setDictating] = useState(false);
  const [leafletBusy, setLeafletBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dictationRef = useRef<LiveTranscriptionHandle | null>(null);

  const ingredientNameById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient.name])),
    [ingredients]
  );
  const storeById = useMemo(() => new Map(stores.map((store) => [store.id, store])), [stores]);
  const matchesByDeal = useMemo(() => {
    const map = new Map<number, typeof dealMatches>();
    for (const match of dealMatches) {
      const list = map.get(match.dealId);
      if (list) {
        list.push(match);
      } else {
        map.set(match.dealId, [match]);
      }
    }
    return map;
  }, [dealMatches]);

  const lastScrapedAt = useMemo(() => {
    const stamps = stores
      .map((store) => store.lastScrapedAt)
      .filter((value): value is string => value !== null)
      .sort();
    return stamps.length > 0 ? stamps[stamps.length - 1] : null;
  }, [stores]);

  const refreshErrors = useMemo(
    () =>
      (lastDealRefresh ?? [])
        .filter((result) => result.error !== null)
        .map((result) => `${STORE_LABELS[result.storeId]}: ${result.error ?? 'Refresh failed'}`),
    [lastDealRefresh]
  );

  const activeDeals = useMemo(
    () => deals.filter((deal) => isDealActive(deal, today)),
    [deals, today]
  );
  const upcomingDeals = useMemo(
    () =>
      deals
        .filter((deal) => !isDealActive(deal, today) && deal.validFrom !== null && deal.validFrom > today)
        .sort((a, b) => (a.validFrom ?? '').localeCompare(b.validFrom ?? '') || a.productName.localeCompare(b.productName)),
    [deals, today]
  );

  const grouped = useMemo(() => {
    const map = new Map<number, typeof activeDeals>();
    for (const deal of activeDeals) {
      const list = map.get(deal.storeId);
      if (list) {
        list.push(deal);
      } else {
        map.set(deal.storeId, [deal]);
      }
    }
    return [...map.entries()].map(([storeId, storeDeals]) => [
      storeId,
      [...storeDeals].sort((a, b) => {
        const bySaving = (savingsPercent(b) ?? 0) - (savingsPercent(a) ?? 0);
        return bySaving !== 0 ? bySaving : a.productName.localeCompare(b.productName);
      }),
    ] as const);
  }, [activeDeals]);

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
      setToast('Microphone permission is needed to read a leaflet');
      return;
    }
    dictationRef.current = startLiveTranscription({
      language: 'en',
      contextualStrings: [...stores.map((store) => store.name), ...ingredients.map((item) => item.name)],
      onError: (message) => {
        setToast(message);
        setDictating(false);
        dictationRef.current = null;
      },
    });
    setDictating(true);
  }, [dictating, stores, ingredients]);

  const stopDictation = useCallback(async () => {
    const handle = dictationRef.current;
    dictationRef.current = null;
    setDictating(false);
    if (!handle) {
      return;
    }
    const result = await handle.stop();
    if (result?.text) {
      setLeafletText((current) => [current.trim(), result.text.trim()].filter(Boolean).join('\n'));
    }
  }, []);

  const closeLeaflet = useCallback(() => {
    dictationRef.current?.abort();
    dictationRef.current = null;
    setDictating(false);
    setLeafletOpen(false);
  }, []);

  const saveLeaflet = useCallback(async () => {
    if (leafletText.trim() === '') {
      return;
    }
    setLeafletBusy(true);
    try {
      const result = await importNewspaperText(leafletText);
      setLeafletText('');
      setLeafletOpen(false);
      setToast(result.message);
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not read the leaflet');
    } finally {
      setLeafletBusy(false);
    }
  }, [leafletText, importNewspaperText]);

  return (
    <ScreenFade>
      <KeyboardAwareScrollView
        contentContainerStyle={{
          padding: theme.spacing[4],
          gap: theme.spacing[3],
        }}
      >
        <Card>
          <Card.Content>
            <View style={[styles.headerRow, { gap: theme.spacing[2] }]}>
              <View style={styles.flex}>
                <Text variant="titleMedium">Current offers</Text>
                <Text variant="bodySmall">
                  {lastScrapedAt === null
                    ? 'Never refreshed'
                    : `Updated ${formatDate(lastScrapedAt, 'D MMM, HH:mm')}`}
                </Text>
              </View>
              <Button
                mode="contained-tonal"
                icon="newspaper-variant-outline"
                onPress={() => setLeafletOpen(true)}
                accessibilityLabel="Read a leaflet out loud"
              >
                Read leaflet
              </Button>
              <Button
                mode="contained-tonal"
                icon="refresh"
                loading={refreshingDeals}
                disabled={refreshingDeals}
                onPress={() => void refreshDeals()}
                accessibilityLabel="Refresh offers from enabled stores"
              >
                Refresh
              </Button>
            </View>
            {refreshErrors.length > 0 ? (
              <View style={{ marginTop: theme.spacing[2], gap: theme.spacing[1] }}>
                {refreshErrors.map((error) => (
                  <Text
                    key={error}
                    variant="bodySmall"
                    style={{ color: theme.semantic.error }}
                  >
                    {error}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card.Content>
        </Card>

        {upcomingDeals.length > 0 ? (
          <Card>
            <Card.Title title="Coming up" subtitle="Offers that start soon, so you can wait" />
            <Card.Content>
              {upcomingDeals.map((deal) => {
                const matchedNames = (matchesByDeal.get(deal.id) ?? []).map(
                  (match) => ingredientNameById.get(match.ingredientId) ?? 'Ingredient'
                );
                return (
                  <View key={deal.id} style={{ marginBottom: theme.spacing[2] }}>
                    <View style={[styles.row, { gap: theme.spacing[2] }]}>
                      <Text variant="bodyMedium" style={styles.flex}>
                        {deal.productName}
                      </Text>
                      <Text variant="bodyMedium">{formatCents(deal.priceCents, deal.currency)}</Text>
                    </View>
                    <Text variant="bodySmall">
                      {storeById.get(deal.storeId)?.name ?? 'Store'}
                      {deal.validFrom !== null ? ` · from ${formatDate(deal.validFrom, 'D MMM')}` : ''}
                      {deal.validTo !== null ? ` to ${formatDate(deal.validTo, 'D MMM')}` : ''}
                    </Text>
                    {matchedNames.length > 0 ? (
                      <Text variant="bodySmall">
                        For {matchedNames.join(', ')} · wait if you can
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </Card.Content>
          </Card>
        ) : null}

        {activeDeals.length === 0 ? (
          <EmptyState message="No current offers cached. Tap Refresh or read a leaflet." />
        ) : (
          grouped.map(([storeId, storeDeals]) => {
            const store = storeById.get(storeId);
            return (
              <Card key={storeId}>
                <Card.Content>
                  <Text variant="titleMedium">
                    {store?.name ?? STORE_LABELS[store?.storeId ?? 'lidl']}
                  </Text>
                  <Text variant="bodySmall">
                    {store?.lastScrapedAt
                      ? `Updated ${formatDate(store.lastScrapedAt, 'D MMM, HH:mm')}`
                      : 'Never refreshed'}
                  </Text>
                  <Divider style={{ marginVertical: theme.spacing[2] }} />
                  {storeDeals.map((deal) => {
                    const matches = matchesByDeal.get(deal.id) ?? [];
                    const percent = savingsPercent(deal);
                    return (
                      <View key={deal.id} style={{ marginBottom: theme.spacing[3] }}>
                        <View style={[styles.row, { gap: theme.spacing[2] }]}>
                          <Text variant="bodyMedium" style={styles.flex}>
                            {deal.productName}
                          </Text>
                          <Text variant="bodyMedium">
                            {formatCents(deal.priceCents, deal.currency)}
                          </Text>
                        </View>
                        {percent !== null ? (
                          <Text variant="bodySmall">{percent}% off</Text>
                        ) : null}
                        {matches.map((match) => {
                          const name = ingredientNameById.get(match.ingredientId) ?? 'Ingredient';
                          return (
                            <View
                              key={match.id}
                              style={[
                                styles.matchRow,
                                { gap: theme.spacing[1], marginTop: theme.spacing[1] },
                              ]}
                            >
                              <Chip compact>{name}</Chip>
                              <Button
                                compact
                                accessibilityLabel={`Confirm ${name} match`}
                                onPress={() => void setDealMatchStatus(match.id, 'confirmed')}
                              >
                                Confirm
                              </Button>
                              <Button
                                compact
                                accessibilityLabel={`Reject ${name} match`}
                                onPress={() => void setDealMatchStatus(match.id, 'rejected')}
                              >
                                Reject
                              </Button>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </Card.Content>
              </Card>
            );
          })
        )}
      </KeyboardAwareScrollView>
      <AppDialog visible={leafletOpen} onDismiss={closeLeaflet}>
        <AppDialog.Title>Read a leaflet</AppDialog.Title>
        <AppDialog.Content>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Say the offers you read. Banana only records what you actually say.
          </Text>
          <TextInput
            label="Leaflet"
            mode="outlined"
            multiline
            value={leafletText}
            onChangeText={setLeafletText}
            style={{ marginTop: theme.spacing[3], minHeight: 120 }}
          />
          <Pressable
            onPressIn={() => void startDictation()}
            onPressOut={() => void stopDictation()}
            accessibilityRole="button"
            accessibilityLabel="Hold to read the leaflet"
            accessibilityState={{ busy: dictating, disabled: leafletBusy }}
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
          <Button onPress={closeLeaflet}>Cancel</Button>
          <Button
            loading={leafletBusy}
            disabled={leafletBusy || leafletText.trim() === ''}
            onPress={() => void saveLeaflet()}
          >
            Save offers
          </Button>
        </AppDialog.Actions>
      </AppDialog>
      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flex: {
    flex: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
