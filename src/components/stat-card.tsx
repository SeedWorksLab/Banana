import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAppTheme } from '../theme';
import { AnimatedNumber } from './animated-number';

export type StatTone = 'neutral' | 'success' | 'warning' | 'error' | 'saving' | 'pricey';

interface StatCardProps {
  label: string;
  value: number | null;
  format: (value: number) => string;
  sub?: string | null;
  tone?: Tone;
  icon?: React.ReactNode;
}

export type Tone = 'neutral' | 'saving' | 'pricey' | 'success' | 'error' | 'warning';

/**
 * A tile is absent rather than zero when there is no data, so a null value
 * renders as an em-dash instead of a misleading 0.
 */
export function StatCard({ label, value, format, sub, tone = 'neutral', icon }: StatCardProps) {
  const theme = useAppTheme();
  const toneColor: Record<Tone, string> = {
    neutral: theme.colors.onSurfaceVariant,
    success: theme.semantic.success,
    saving: theme.semantic.saving,
    pricey: theme.semantic.pricey,
    warning: theme.semantic.warning,
    error: theme.semantic.error,
  };
  const color = toneColor[tone];

  return (
    <Card style={[styles.card, { backgroundColor: theme.surfaces.surfaceSecondary }]}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          {icon}
          <Text variant="labelMedium" style={[styles.label, { color: theme.text.secondary }]}>
            {label}
          </Text>
        </View>
        {value === null ? (
          <Text variant="headlineSmall" style={{ color }}>
            —
          </Text>
        ) : (
          <AnimatedNumber value={value} format={format} style={{ ...styles.value, color }} />
        )}
        {sub ? (
          <Text variant="bodySmall" style={[styles.sub, { color: theme.text.tertiary }]}>
            {sub}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  content: {
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  label: {
    marginBottom: 2,
  },
  value: {
    fontSize: 28,
    lineHeight: 36,
  },
  sub: {
    marginTop: 2,
  },
});
