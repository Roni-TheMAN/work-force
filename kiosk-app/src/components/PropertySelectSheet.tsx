import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { PropertySummary } from "../types/kiosk";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { SurfaceCard } from "./SurfaceCard";

type PropertySelectSheetProps = {
  visible: boolean;
  properties: PropertySummary[];
  selectedPropertyId?: string | null;
  onSelect: (propertyId: string) => void;
  onClose: () => void;
};

export function PropertySelectSheet({
  visible,
  properties,
  selectedPropertyId,
  onSelect,
  onClose,
}: PropertySelectSheetProps) {
  const { height, width } = useWindowDimensions();
  const isCompact = width < 560 || height < 680;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, isCompact ? styles.overlayCompact : null]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SurfaceCard style={[styles.sheet, isCompact ? styles.sheetCompact : null]}>
          <View style={styles.header}>
            <Text style={styles.title}>Select property</Text>
            <Text style={styles.subtitle}>Only properties you can assign appear here.</Text>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {properties.map((property) => {
              const selected = property.id === selectedPropertyId;

              return (
                <Pressable
                  key={property.id}
                  onPress={() => onSelect(property.id)}
                  style={({ pressed }) => [
                    styles.row,
                    selected ? styles.rowSelected : null,
                    pressed ? styles.rowPressed : null,
                  ]}
                >
                  <View style={styles.rowContent}>
                    <Text style={styles.rowTitle}>{property.name}</Text>
                    <Text style={styles.rowSubtitle}>
                      {property.code ? `${property.code} • ` : ""}
                      {property.timezone}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={selected ? "check-circle" : "chevron-right"}
                    size={22}
                    color={selected ? colors.primary : colors.mutedForeground}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </SurfaceCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  overlayCompact: {
    padding: spacing.sm,
  },
  sheet: {
    maxHeight: "70%",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  sheetCompact: {
    maxHeight: "88%",
    padding: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.foreground,
  },
  subtitle: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  content: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: "hsla(176, 58%, 36%, 0.35)",
  },
  rowPressed: {
    opacity: 0.9,
  },
  rowContent: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    ...typography.label,
    color: colors.foreground,
  },
  rowSubtitle: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
});
