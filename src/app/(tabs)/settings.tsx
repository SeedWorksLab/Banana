import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Divider, List, Switch, Text, TextInput } from 'react-native-paper';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { NumberField } from '../../components/number-field';
import { OptionField } from '../../components/option-field';
import { useAppData } from '../../data/DataProvider';
import { COUNTRIES, CURRENCIES, DIETS, THEME_MODES } from '../../models';
import { isStoreSupported } from '../../deals/providers';
import { COUNTRY_LABELS, DIET_LABELS } from '../../utils/labels';
import {
  CURRENCY_LABELS,
  currencySymbol,
  formatCents,
  fromMinorUnits,
  toMinorUnits,
} from '../../utils/currency';

const THEME_OPTIONS = THEME_MODES.map((mode) => ({
  value: mode,
  label: mode.charAt(0).toUpperCase() + mode.slice(1),
}));
const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency,
  label: CURRENCY_LABELS[currency],
}));
const DIET_OPTIONS = DIETS.map((diet) => ({ value: diet, label: DIET_LABELS[diet] }));

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

export default function SettingsScreen() {
  const router = useRouter();
  const {
    settings,
    preferences,
    stores,
    saveSettings,
    savePreferences,
    setStoreEnabled,
  } = useAppData();
  const [allergiesText, setAllergiesText] = useState(() => preferences.allergies.join(', '));
  const [dislikesText, setDislikesText] = useState(() => preferences.dislikes.join(', '));

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <Card>
          <Card.Content>
            <Text variant="titleMedium">Appearance</Text>
            <OptionField
              label="Theme"
              value={settings.themeMode}
              options={THEME_OPTIONS}
              nullable={false}
              onChange={(value) => value !== null && void saveSettings({ themeMode: value })}
            />
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            <Text variant="titleMedium">Currency</Text>
            <OptionField
              label="Budget and list currency"
              value={settings.currency}
              options={CURRENCY_OPTIONS}
              nullable={false}
              onChange={(value) => value !== null && void saveSettings({ currency: value })}
            />
            <Text variant="bodySmall">
              Store offers stay in their own currency. Amounts are not converted.
            </Text>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            <Text variant="titleMedium">Planning defaults</Text>
            <NumberField
              label="Default servings"
              value={settings.defaultServings}
              integer
              onChange={(value) => value !== null && void saveSettings({ defaultServings: value })}
            />
            <NumberField
              label="Weeknight cook minutes"
              value={settings.defaultWeeknightMinutes}
              integer
              onChange={(value) =>
                value !== null && void saveSettings({ defaultWeeknightMinutes: value })
              }
            />
            <NumberField
              label="Weekend cook minutes"
              value={settings.defaultWeekendMinutes}
              integer
              onChange={(value) =>
                value !== null && void saveSettings({ defaultWeekendMinutes: value })
              }
            />
            <View style={styles.switchRow}>
              <Text variant="bodyLarge">Dinner only</Text>
              <Switch
                value={settings.dinnerOnly}
                onValueChange={(value) => void saveSettings({ dinnerOnly: value })}
              />
            </View>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            <Text variant="titleMedium">Preferences</Text>
            <OptionField
              label="Diet"
              value={preferences.diet}
              options={DIET_OPTIONS}
              nullable={false}
              onChange={(value) => value !== null && void savePreferences({ diet: value })}
            />
            <TextInput
              label="Allergies"
              value={allergiesText}
              onChangeText={setAllergiesText}
              onBlur={() => void savePreferences({ allergies: splitList(allergiesText) })}
              mode="outlined"
              placeholder="comma separated"
            />
            <TextInput
              label="Dislikes"
              value={dislikesText}
              onChangeText={setDislikesText}
              onBlur={() => void savePreferences({ dislikes: splitList(dislikesText) })}
              mode="outlined"
              placeholder="comma separated"
            />
            <NumberField
              label="Weekly budget"
              unit={currencySymbol(settings.currency)}
              value={fromMinorUnits(preferences.weeklyBudgetCents, settings.currency)}
              onChange={(value) =>
                value !== null &&
                void savePreferences({
                  weeklyBudgetCents: toMinorUnits(value, settings.currency),
                })
              }
              helperText={formatCents(preferences.weeklyBudgetCents, settings.currency)}
            />
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            <Text variant="titleMedium">Shops</Text>
            <Text variant="bodySmall">
              Deals are fetched only from enabled shops. Unavailable shops have no public offer
              feed yet.
            </Text>
          </Card.Content>
          {COUNTRIES.map((country) => (
            <View key={country}>
              <List.Subheader>{COUNTRY_LABELS[country]}</List.Subheader>
              {stores
                .filter((store) => store.country === country)
                .map((store) => {
                  const supported = isStoreSupported(store.storeId);
                  return (
                    <List.Item
                      key={store.id}
                      title={store.name}
                      description={supported ? undefined : 'No public offer feed found'}
                      right={() => (
                        <Switch
                          value={store.enabled}
                          disabled={!supported}
                          onValueChange={(value) => void setStoreEnabled(store.id, value)}
                          accessibilityLabel={`Enable ${store.name} offers`}
                          accessibilityState={{ checked: store.enabled, disabled: !supported }}
                        />
                      )}
                    />
                  );
                })}
            </View>
          ))}
        </Card>

        <Card>
          <List.Item
            title="AI provider"
            description="Endpoint, key and model"
            left={(props) => <List.Icon {...props} icon="robot-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/ai-provider')}
          />
          <Divider />
          <List.Item
            title="Backup and restore"
            left={(props) => <List.Icon {...props} icon="database-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/backup')}
          />
          <Divider />
          <List.Item
            title="Tutorial"
            left={(props) => <List.Icon {...props} icon="school-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/tutorial')}
          />
          <Divider />
          <List.Item
            title="What's new"
            left={(props) => <List.Icon {...props} icon="gift-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/whats-new')}
          />
          <Divider />
          <List.Item
            title="About"
            left={(props) => <List.Icon {...props} icon="information-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/about')}
          />
        </Card>
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
});
