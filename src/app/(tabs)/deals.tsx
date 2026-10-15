import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text } from 'react-native-paper';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { useAppData } from '../../data/DataProvider';
import { isDealActive, savingsPercent } from '../../services/deal-service';
import { STORE_LABELS } from '../../utils/labels';
import { formatCents } from '../../utils/currency';
import { todayDate } from '../../utils/date';

export default function DealsScreen() {
  const { stores, deals, dealMatches, ingredients, setDealMatchStatus } = useAppData();
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
    return [...map.entries()];
  }, [activeDeals]);

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        {activeDeals.length === 0 ? (
          <EmptyState message="No deals cached yet. Refresh from Settings once the scraper is configured." />
        ) : (
          grouped.map(([storeId, storeDeals]) => (
            <Card key={storeId} style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium">
                  {storeById.get(storeId)?.name ?? STORE_LABELS[storeById.get(storeId)?.storeId ?? 'lidl']}
                </Text>
                <Divider style={styles.divider} />
                {storeDeals.map((deal) => {
                  const matches = matchesByDeal.get(deal.id) ?? [];
                  const percent = savingsPercent(deal);
                  return (
                    <View key={deal.id} style={styles.deal}>
                      <View style={styles.row}>
                        <Text variant="bodyMedium" style={styles.flex}>
                          {deal.productName}
                        </Text>
                        <Text variant="bodyMedium">{formatCents(deal.priceCents)}</Text>
                      </View>
                      {percent !== null ? (
                        <Text variant="bodySmall">{percent}% off</Text>
                      ) : null}
                      {matches.map((match) => (
                        <View key={match.id} style={styles.matchRow}>
                          <Chip compact>{ingredientNameById.get(match.ingredientId) ?? 'Ingredient'}</Chip>
                          <Button compact onPress={() => void setDealMatchStatus(match.id, 'confirmed')}>
                            Confirm
                          </Button>
                          <Button compact onPress={() => void setDealMatchStatus(match.id, 'rejected')}>
                            Reject
                          </Button>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </Card.Content>
            </Card>
          ))
        )}
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  card: {},
  divider: {
    marginVertical: 8,
  },
  deal: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
});
