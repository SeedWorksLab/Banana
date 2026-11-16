import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  keyboardBottomOffset?: number;
}

/**
 * A scroll view that keeps its content reachable above the software keyboard.
 * On Android the window already resizes, so only the extra bottom padding is
 * added; on iOS `automaticallyAdjustKeyboardInsets` handles the rest.
 */
export const KeyboardAwareScrollView = React.forwardRef<ScrollView, KeyboardAwareScrollViewProps>(function KeyboardAwareScrollView({
  keyboardBottomOffset = 24,
  contentContainerStyle,
  children,
  ...rest
}: KeyboardAwareScrollViewProps, ref) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) =>
      setKeyboardHeight(event.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentContainerStyle={[
        contentContainerStyle,
        keyboardHeight > 0 ? { paddingBottom: keyboardBottomOffset } : null,
      ]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
});
