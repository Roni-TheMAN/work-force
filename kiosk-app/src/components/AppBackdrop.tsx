import { StyleSheet, View } from "react-native";

import { colors } from "../theme/tokens";

export function AppBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.topBand} />
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 132,
    backgroundColor: colors.muted,
  },
  rule: {
    position: "absolute",
    top: 132,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
