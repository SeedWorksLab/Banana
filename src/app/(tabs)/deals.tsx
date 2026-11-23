import React, { useCallback, useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';
import { ScrollableTextInput } from '../../components/scrollable-text-input';
import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { AppDialog } from '../../components/app-dialog';
import { ScreenToast } from '../../components/screen-toast';
import { useAppData } from '../../data/DataProvider';
import { useLeafletRecording } from '../../ai/use-leaflet-recording';
import { useAppTheme } from '../../theme';
import { isDealActive, savingsPercent } from '../../services/deal-service';
import { STORE_LABELS } from '../../utils/labels';
import { formatCents } from '../../utils/currency';
import { formatDate, todayDate } from '../../utils/date';
import type { Deal, DealMatch, MatchStatus } from '../../models';

interface OfferSection {
  key: string;
  title: string;
  subtitle: string;
  upcoming: boolean;
  data: Deal[];
}

const OfferRow = React.memo(function OfferRow({
  deal, matches, ingredientNames, storeName, upcoming, onMatch,
}: {
  deal: Deal;
  matches: readonly DealMatch[];
  ingredientNames: ReadonlyMap<number, string>;
  storeName: string;
  upcoming: boolean;
  onMatch: (id: number, status: MatchStatus) => Promise<void>;
}) {
  const theme = useAppTheme();
  const percent = savingsPercent(deal);
  return (
    <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing[4], gap: theme.spacing[1] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing[2] }}>
        <Text variant="bodyMedium" style={{ flex: 1 }}>{deal.productName}</Text>
        <Text variant="bodyMedium">{formatCents(deal.priceCents, deal.currency)}</Text>
      </View>
      {upcoming ? (
        <Text variant="bodySmall">
          {storeName}{deal.validFrom ? ` · from ${formatDate(deal.validFrom, 'D MMM')}` : ''}
          {deal.validTo ? ` to ${formatDate(deal.validTo, 'D MMM')}` : ''}
        </Text>
      ) : null}
      {percent !== null ? <Text variant="bodySmall">{percent}% off</Text> : null}
      {matches.map((match) => {
        const name = ingredientNames.get(match.ingredientId) ?? 'Ingredient';
        return (
          <View key={match.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing[1] }}>
            <Chip compact>{name}</Chip>
            {upcoming ? <Text variant="bodySmall">Wait if you can</Text> : (
              <>
                <Button compact accessibilityRole="button" accessibilityLabel={`Confirm ${name} match`}
                  onPress={() => void onMatch(match.id, 'confirmed')}>Confirm</Button>
                <Button compact accessibilityRole="button" accessibilityLabel={`Reject ${name} match`}
                  onPress={() => void onMatch(match.id, 'rejected')}>Reject</Button>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
});

const NO_MATCHES: readonly DealMatch[] = [];

export default function DealsScreen() {
  const theme = useAppTheme();
  const {
    settings, stores, deals, dealMatches, ingredients, setDealMatchStatus,
    importNewspaperText, refreshDeals, refreshingDeals, lastDealRefresh,
  } = useAppData();
  const today = todayDate();
  const [leafletOpen, setLeafletOpen] = useState(false);
  const [leafletText, setLeafletText] = useState('');
  const [leafletBusy, setLeafletBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const context = useMemo(() => [...stores.map((store) => store.name), ...ingredients.map((item) => item.name)], [stores, ingredients]);
  const recording = useLeafletRecording(settings.language, context);
  const ingredientNames = useMemo(() => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient.name])), [ingredients]);
  const storeById = useMemo(() => new Map(stores.map((store) => [store.id, store])), [stores]);
  const matchesByDeal = useMemo(() => {
    const map = new Map<number, DealMatch[]>();
    for (const match of dealMatches) {
      const list = map.get(match.dealId);
      if (list) list.push(match);
      else map.set(match.dealId, [match]);
    }
    return map;
  }, [dealMatches]);
  const lastScrapedAt = useMemo(() => stores.map((store) => store.lastScrapedAt)
    .filter((value): value is string => value !== null).sort().at(-1) ?? null, [stores]);
  const sections = useMemo(() => {
    const grouped = new Map<number, Deal[]>();
    const upcoming: Deal[] = [];
    for (const deal of deals) {
      if (isDealActive(deal, today)) {
        const group = grouped.get(deal.storeId);
        if (group) group.push(deal);
        else grouped.set(deal.storeId, [deal]);
      } else if (deal.validFrom !== null && deal.validFrom > today) upcoming.push(deal);
    }
    const result: OfferSection[] = [];
    if (upcoming.length) result.push({
      key: 'upcoming', title: 'Coming up', subtitle: 'Offers that start soon, so you can wait', upcoming: true,
      data: upcoming.sort((a, b) => (a.validFrom ?? '').localeCompare(b.validFrom ?? '') || a.productName.localeCompare(b.productName)),
    });
    for (const [id, data] of grouped) {
      const store = storeById.get(id);
      result.push({
        key: String(id), title: store?.name ?? 'Store', upcoming: false,
        subtitle: store?.lastScrapedAt ? `Updated ${formatDate(store.lastScrapedAt, 'D MMM, HH:mm')}` : 'Never refreshed',
        data: data.sort((a, b) => (savingsPercent(b) ?? 0) - (savingsPercent(a) ?? 0) || a.productName.localeCompare(b.productName)),
      });
    }
    return result;
  }, [deals, today, storeById]);

  const saveLeaflet = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLeafletBusy(true);
    try {
      const result = await importNewspaperText(text);
      setLeafletText('');
      setLeafletOpen(false);
      setToast(result.message);
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not read the leaflet');
    } finally {
      setLeafletBusy(false);
    }
  }, [importNewspaperText]);

  async function stopAndProcess() {
    const text = await recording.stopAndTranscribe();
    if (!text) return;
    const combined = [leafletText.trim(), text.trim()].filter(Boolean).join('\n');
    setLeafletText(combined);
    await saveLeaflet(combined);
  }

  async function closeLeaflet() {
    if (recording.busy || leafletBusy) return;
    try {
      await recording.discard();
      setLeafletOpen(false);
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not stop recording');
    }
  }

  return (
    <ScreenFade>
      <SectionList<Deal, OfferSection>
        sections={sections}
        keyExtractor={(deal) => String(deal.id)}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        stickySectionHeadersEnabled={false}
        renderScrollComponent={(props) => <KeyboardAwareScrollView {...props} />}
        contentContainerStyle={{ padding: theme.spacing[4] }}
        ListHeaderComponent={
          <Card style={{ marginBottom: theme.spacing[3] }}>
            <Card.Content>
              <Text variant="titleMedium">Current offers</Text>
              <Text variant="bodySmall">{lastScrapedAt ? `Updated ${formatDate(lastScrapedAt, 'D MMM, HH:mm')}` : 'Never refreshed'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2], marginTop: theme.spacing[3] }}>
                <Button mode="contained-tonal" icon="newspaper-variant-outline" onPress={() => setLeafletOpen(true)}
                  accessibilityRole="button" accessibilityLabel="Read a leaflet out loud">Read leaflet</Button>
                <Button mode="contained-tonal" icon="refresh" loading={refreshingDeals} disabled={refreshingDeals}
                  onPress={() => void refreshDeals().catch((caught: unknown) => setToast(caught instanceof Error ? caught.message : 'Refresh failed'))}
                  accessibilityRole="button" accessibilityLabel="Refresh offers from enabled stores">Refresh</Button>
              </View>
              {(lastDealRefresh ?? []).filter((result) => result.error !== null).map((result) => (
                <Text key={result.storeId} variant="bodySmall" style={{ color: theme.semantic.error, marginTop: theme.spacing[2] }}>
                  {STORE_LABELS[result.storeId]}: {result.error}
                </Text>
              ))}
            </Card.Content>
          </Card>
        }
        ListEmptyComponent={<EmptyState message="No current offers cached. Tap Refresh or read a leaflet." />}
        renderSectionHeader={({ section }) => (
          <View style={{ backgroundColor: theme.colors.surface, padding: theme.spacing[4], marginTop: theme.spacing[3] }}>
            <Text variant="titleMedium">{section.title}</Text>
            <Text variant="bodySmall">{section.subtitle}</Text>
          </View>
        )}
        renderItem={({ item, section }) => (
          <OfferRow deal={item} matches={matchesByDeal.get(item.id) ?? NO_MATCHES} ingredientNames={ingredientNames}
            storeName={storeById.get(item.storeId)?.name ?? 'Store'} upcoming={section.upcoming} onMatch={setDealMatchStatus} />
        )}
      />
      <AppDialog visible={leafletOpen} onDismiss={() => void closeLeaflet()}>
        <AppDialog.Title>Read a leaflet</AppDialog.Title>
        <AppDialog.Content>
          <Text variant="bodyMedium">
            Start recording, then open your leaflet in another app. Return here and stop to transcribe on this device and send the text to your AI.
          </Text>
          <ScrollableTextInput label="Leaflet" mode="outlined" multiline value={leafletText} onChangeText={setLeafletText}
            editable={!leafletBusy && !recording.busy} accessibilityLabel="Leaflet text"
            style={{ marginTop: theme.spacing[3], maxHeight: theme.spacing[10] * 3 }} />
          <Button mode="contained-tonal" icon={recording.recording ? 'stop-circle-outline' : 'microphone'}
            loading={recording.busy} disabled={recording.busy || leafletBusy}
            onPress={() => void (recording.recording || recording.hasRecording ? stopAndProcess() : recording.start())}
            accessibilityRole="button" accessibilityLabel={recording.recording ? 'Stop recording and process leaflet' : recording.hasRecording ? 'Retry transcription' : 'Start leaflet recording'}
            style={{ marginTop: theme.spacing[3] }}>
            {recording.busy ? 'Processing audio…' : recording.recording ? 'Stop and process' : recording.hasRecording ? 'Retry transcription' : 'Start recording'}
          </Button>
          {recording.recording ? <Text variant="bodySmall">Recording continues while you use another app.</Text> : null}
          {recording.error ? <Text variant="bodySmall" style={{ color: theme.semantic.error }}>{recording.error}</Text> : null}
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button disabled={recording.busy || leafletBusy} onPress={() => void closeLeaflet()}
            accessibilityRole="button" accessibilityLabel="Cancel leaflet recording">Cancel</Button>
          <Button loading={leafletBusy} disabled={leafletBusy || recording.recording || recording.busy || !leafletText.trim()}
            onPress={() => void saveLeaflet(leafletText)} accessibilityRole="button" accessibilityLabel="Send leaflet text to AI">
            Save offers
          </Button>
        </AppDialog.Actions>
      </AppDialog>
      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </ScreenFade>
  );
}
