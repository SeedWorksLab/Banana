import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { ScreenFade } from '../components/screen-fade';
import { whatsNew } from '../config/whats-new';
import { formatDate } from '../utils/date';

export default function WhatsNewScreen() {
  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        {whatsNew.map((entry) => (
          <Card key={entry.version} mode="contained" style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">Version {entry.version}</Text>
              <Text variant="bodySmall" style={styles.date}>
                {formatDate(entry.releasedAt, 'D MMM YYYY')}
              </Text>
              {entry.items.map((item) => (
                <View key={item} style={styles.item}>
                  <Text variant="bodyMedium">•  {item}</Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        ))}
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  date: {
    marginBottom: 12,
  },
  item: {
    marginBottom: 6,
  },
});
