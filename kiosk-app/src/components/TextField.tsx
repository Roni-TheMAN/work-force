import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";

import { colors, radius, spacing, typography } from "../theme/tokens";

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  helperText?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: KeyboardTypeOptions;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  secureTextEntry = false,
  autoCapitalize = "none",
  keyboardType = "default",
}: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={styles.input}
      />
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.foreground,
  },
  input: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    color: colors.foreground,
    ...typography.body,
  },
  helper: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
});
