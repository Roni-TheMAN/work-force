import type { TextStyle, ViewStyle } from "react-native";

export const colors = {
  background: "hsl(210, 20%, 98%)",
  foreground: "hsl(218, 22%, 12%)",
  card: "hsl(0, 0%, 100%)",
  cardForeground: "hsl(218, 22%, 12%)",
  primary: "hsl(176, 58%, 36%)",
  primaryForeground: "hsl(0, 0%, 100%)",
  primarySoft: "hsl(176, 40%, 92%)",
  secondary: "hsl(212, 18%, 94%)",
  secondaryForeground: "hsl(218, 18%, 20%)",
  muted: "hsl(210, 18%, 96%)",
  mutedForeground: "hsl(216, 9%, 42%)",
  accent: "hsl(222, 18%, 18%)",
  accentForeground: "hsl(0, 0%, 100%)",
  border: "hsl(214, 16%, 86%)",
  ring: "hsl(176, 58%, 36%)",
  success: "hsl(150, 46%, 32%)",
  successSoft: "hsla(150, 46%, 32%, 0.12)",
  warning: "hsl(38, 84%, 42%)",
  warningSoft: "hsla(38, 84%, 42%, 0.13)",
  destructive: "hsl(356, 70%, 47%)",
  destructiveSoft: "hsla(356, 70%, 47%, 0.1)",
  overlay: "hsla(218, 22%, 12%, 0.5)",
  overlaySoft: "hsla(218, 22%, 12%, 0.1)",
  shadow: "hsla(218, 22%, 12%, 0.1)",
  transparent: "transparent",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 8,
  xl: 8,
  pill: 999,
} as const;

export const typography = {
  overline: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  } satisfies TextStyle,
  title: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 40,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 30,
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "500",
  } satisfies TextStyle,
  helper: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  } satisfies TextStyle,
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  } satisfies TextStyle,
  keypadDigit: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0,
  } satisfies TextStyle,
  clock: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: "700",
    letterSpacing: 0,
  } satisfies TextStyle,
} as const;

export const surfaces = {
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
  } satisfies ViewStyle,
  mutedCard: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
  } satisfies ViewStyle,
  floating: {
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  } satisfies ViewStyle,
} as const;
