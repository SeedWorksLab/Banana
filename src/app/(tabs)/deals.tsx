import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text } from 'react-native-paper';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { useAppData } from '../../data/DataProvider';
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
    refreshDeals,
    refreshingDeals,
    lastDealRefresh,
  } = useAppData();
  const today = todayDate();

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

        {activeDeals.length === 0 ? (
          <EmptyState message="No current offers cached. Tap Refresh to fetch them from the enabled stores." />
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
});
