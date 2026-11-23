import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { HelperText, Menu, Text, TextInput as PaperTextInput } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../theme';

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface OptionFieldProps<T extends string | number> {
  label: string;
  value: T | null;
  options: readonly Option<T>[];
  onChange: (value: T | null) => void;
  nullable?: boolean;
  emptyLabel?: string;
  error?: string | null;
}

export function OptionField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  nullable = true,
  emptyLabel = 'Not set',
  error,
}: OptionFieldProps<T>) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const display = selected ? selected.label : emptyLabel;

  return (
    <View>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${display}`}
            accessibilityState={{ expanded: open }}
            aria-expanded={open}
            testID={`option-${label}`}
          >
            <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <PaperTextInput
                label={label}
                mode="outlined"
                value={display}
                editable={false}
                error={Boolean(error)}
                contentStyle={{ paddingRight: theme.spacing[8] }}
                render={({ style }) => (
                  <View style={[style, { justifyContent: 'center' }]}>
                    <Text variant="bodyLarge" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                      {display}
                    </Text>
                  </View>
                )}
              />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
                alignItems: 'flex-end', justifyContent: 'center',
                paddingRight: theme.spacing[3], paddingTop: theme.spacing[2],
              }]}>
                <MaterialCommunityIcons name="menu-down" size={theme.spacing[6]}
                  color={error ? theme.colors.error : theme.colors.onSurfaceVariant} accessible={false} />
              </View>
            </View>
          </Pressable>
        }
      >
        {nullable ? (
          <Menu.Item
            title={emptyLabel}
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
          />
        ) : null}
        {options.map((option) => (
          <MenuItem
            key={String(option.value)}
            title={option.label}
            selected={option.value === value}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
          />
        ))}
      </Menu>
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </View>
  );
}

function MenuItem({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  return <Menu.Item title={title} leadingIcon={selected ? 'check' : undefined} onPress={onPress} />;
}
