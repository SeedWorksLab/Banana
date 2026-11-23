import React, { useRef, useState } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useAppTheme } from '../theme';

type ScrollableTextInputProps = Omit<React.ComponentProps<typeof TextInput>, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

export function ScrollableTextInput({
  style, onContentSizeChange, accessibilityLabel, label, ...props
}: ScrollableTextInputProps) {
  const theme = useAppTheme();
  const minimumHeight = theme.spacing[10] * 2;
  const [contentHeight, setContentHeight] = useState(minimumHeight);
  const scroll = useRef<ScrollView>(null);
  return <ScrollView ref={scroll} style={[style, { height: minimumHeight, flexGrow: 0 }]}
    showsVerticalScrollIndicator persistentScrollbar keyboardShouldPersistTaps="handled"
    nestedScrollEnabled testID="scrollable-text-input">
    <TextInput {...props} label={label} multiline scrollEnabled={false}
      accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
      style={{ height: contentHeight }}
      onContentSizeChange={(event) => {
        setContentHeight(Math.max(minimumHeight, event.nativeEvent.contentSize.height + theme.spacing[8]));
        onContentSizeChange?.(event);
      }}
      onSelectionChange={(event) => {
        if (event.nativeEvent.selection.end === props.value?.length) scroll.current?.scrollToEnd({ animated: false });
        props.onSelectionChange?.(event);
      }}
    />
  </ScrollView>;
}
