import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useAppTheme } from '../theme';

type ScrollableTextInputProps = Omit<React.ComponentProps<typeof TextInput>, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

export function ScrollableTextInput({
  style, accessibilityLabel, label, ...props
}: ScrollableTextInputProps) {
  const theme = useAppTheme();
  const height = theme.spacing[10] * 2;
  return (
    <View style={[style, { flexGrow: 0, gap: theme.spacing[2] }]}>
      {label ? <Text variant="labelLarge" testID="scrollable-text-input-label"
        style={{ color: props.error ? theme.colors.error : theme.colors.onSurfaceVariant }}>
        {label}
      </Text> : null}
      <View testID="scrollable-text-input" style={{
        height, flexGrow: 0, overflow: 'hidden', borderRadius: theme.radii.medium,
      }}>
        <TextInput {...props} multiline scrollEnabled textAlignVertical="top"
          accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
          style={{ height }}
          contentStyle={[{ paddingVertical: theme.spacing[3] }, props.contentStyle]}
        />
      </View>
    </View>
  );
}
