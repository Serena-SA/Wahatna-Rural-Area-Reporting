import type { KeyboardAwareScrollViewProps } from "react-native-keyboard-controller";
import { Platform, ScrollView, ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView } from "@/components/keyboardController";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  // Web has no native module; Expo Go has the package but not its native side
  // (KeyboardAwareScrollView is null there) — fall back to a plain ScrollView.
  if (Platform.OS === "web" || !KeyboardAwareScrollView) {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
