import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Slot } from '../models';
import { batchMealDetails } from '../services/batch-cooking-service';
import { useAppTheme } from '../theme';
import { MEAL_TYPE_LABELS, weekDayLabel } from '../utils/labels';

interface BatchMealSummaryProps {
  slot: Slot;
  slots: readonly Slot[];
}

function portions(count: number): string {
  return `${count} ${count === 1 ? 'portion' : 'portions'}`;
}

export function BatchMealSummary({ slot, slots }: BatchMealSummaryProps) {
  const theme = useAppTheme();
  const details = batchMealDetails(slot, slots);
  const isLeftover = slot.kind === 'leftovers';
  if (!isLeftover && !details.leftovers.length) return null;
  const color = isLeftover ? theme.colors.onSecondaryContainer : theme.colors.onPrimaryContainer;
  return (
    <View testID={`batch-summary-${slot.id}`} style={{
      marginTop: theme.spacing[2], padding: theme.spacing[3], gap: theme.spacing[1],
      borderRadius: theme.radii.medium,
      backgroundColor: isLeftover ? theme.colors.secondaryContainer : theme.colors.primaryContainer,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
        <MaterialCommunityIcons name={isLeftover ? 'pot-steam-outline' : 'chef-hat'}
          size={theme.spacing[5]} color={color} />
        <Text variant="labelLarge" style={{ color, flex: 1 }}>
          {isLeftover ? details.source
            ? `Leftovers from ${weekDayLabel(details.source.day)} ${MEAL_TYPE_LABELS[details.source.mealType].toLowerCase()}`
            : 'Leftovers · choose a source meal'
            : `Cook ${portions(details.cookServings)}`}
        </Text>
      </View>
      <Text variant="bodyMedium" style={{ color }}>
        {isLeftover ? `Eat ${portions(slot.servings)} · No cooking`
          : `Eat ${portions(details.mealServings)} at this meal`}
      </Text>
      {!isLeftover ? details.leftovers.map((leftover) => (
        <Text key={leftover.id} variant="bodyMedium" style={{ color }}>
          {`Keep ${portions(leftover.servings)} for ${weekDayLabel(leftover.day)} ${MEAL_TYPE_LABELS[leftover.mealType].toLowerCase()}`}
        </Text>
      )) : null}
    </View>
  );
}
