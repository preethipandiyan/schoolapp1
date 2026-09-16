import React, { useState, useEffect, forwardRef } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  Keyboard,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';

export interface KeyboardAwareFormScrollViewProps extends ScrollViewProps {
  extraPadding?: number;
}

/**
 * Universal KeyboardAwareFormScrollView component
 * Ensures that when the Android or iOS soft keyboard opens:
 * 1. The ScrollView gains extra bottom padding equal to keyboardHeight + extraPadding (default 80dp).
 * 2. Any focused input field near the bottom can be easily scrolled into full view above the keyboard.
 * 3. All bottom fields, calculation summaries, and Submit/Save buttons remain completely accessible.
 * 4. keyboardShouldPersistTaps is set to "handled" to allow immediate tapping without keyboard dismissal.
 */
export const KeyboardAwareFormScrollView = forwardRef<any, KeyboardAwareFormScrollViewProps>(
  ({ contentContainerStyle, extraPadding = 80, children, ...props }, ref) => {
    const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

    useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const showSubscription = Keyboard.addListener(showEvent, (e) => {
        const height = e?.endCoordinates?.height || 0;
        setKeyboardHeight(height);
      });

      const hideSubscription = Keyboard.addListener(hideEvent, () => {
        setKeyboardHeight(0);
      });

      return () => {
        showSubscription.remove();
        hideSubscription.remove();
      };
    }, []);

    const flatStyle = (StyleSheet.flatten(contentContainerStyle) || {}) as ViewStyle;
    const basePaddingBottom =
      typeof flatStyle.paddingBottom === 'number' ? flatStyle.paddingBottom : 40;

    const dynamicPaddingBottom =
      keyboardHeight > 0 ? basePaddingBottom + keyboardHeight + extraPadding : basePaddingBottom;

    return (
      <ScrollView
        ref={ref as any}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        {...props}
        contentContainerStyle={[contentContainerStyle, { paddingBottom: dynamicPaddingBottom }]}
      >
        {children}
      </ScrollView>
    );
  }
);

KeyboardAwareFormScrollView.displayName = 'KeyboardAwareFormScrollView';

/**
 * Custom hook providing live keyboard height for non-scrollable containers
 */
export const useKeyboardHeight = () => {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e?.endCoordinates?.height || 0);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardHeight;
};

export default KeyboardAwareFormScrollView;
