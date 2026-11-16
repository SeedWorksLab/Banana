import React from 'react';
import { View } from 'react-native';
import { Card, List, Switch, Text } from 'react-native-paper';
import { ScreenFade } from '../components/screen-fade';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { useAppData } from '../data/DataProvider';
import { isStoreSupported } from '../deals/providers';
import { COUNTRIES } from '../models';
import { useI18n } from '../i18n';
import { useAppTheme } from '../theme';

export default function ShopsScreen() {
  const { stores, setStoreEnabled } = useAppData();
  const { t } = useI18n();
  const theme = useAppTheme();
  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[3] }}>
        <Card>
          <Card.Content>
            <Text variant="bodySmall">{t('settings.shopsHint')}</Text>
          </Card.Content>
          {COUNTRIES.map((country) => (
            <View key={country}>
              <List.Subheader>{country === 'AT' ? t('settings.countryAT') : t('settings.countryHU')}</List.Subheader>
              {stores.filter((store) => store.country === country && isStoreSupported(store.storeId)).map((store) => (
                <List.Item key={store.id} title={store.name}
                  right={() => <Switch value={store.enabled}
                    onValueChange={(value) => void setStoreEnabled(store.id, value)}
                    accessibilityRole="switch" accessibilityLabel={`${t('settings.shops')} ${store.name}`}
                    accessibilityState={{ checked: store.enabled }} testID={`shop-${store.storeId}`} />} />
              ))}
            </View>
          ))}
        </Card>
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}
