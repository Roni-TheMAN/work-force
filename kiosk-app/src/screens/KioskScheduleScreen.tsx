import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { KioskStatusBadge } from "../components/KioskStatusBadge";
import { ScreenFrame } from "../components/ScreenFrame";
import { SurfaceCard } from "../components/SurfaceCard";
import { formatRelativeTime } from "../lib/format";
import { colors, radius, spacing, surfaces, typography } from "../theme/tokens";
import type { ScheduleFetchResult } from "../services/sync/scheduleSync.service";
import type { KioskDeviceBinding } from "../types/kiosk";
import type { ScheduleDay, ScheduleShift, ScheduleWeek } from "../types/schedule";

type KioskScheduleScreenProps = {
  binding: KioskDeviceBinding;
  loadScheduleWeek: (
    binding: KioskDeviceBinding,
    options?: { weekStartDate?: string | null; preferCache?: boolean }
  ) => Promise<ScheduleFetchResult>;
  onBack: () => void;
};

function shiftWeekStartDate(weekStartDate: string, deltaDays: number): string {
  const parsed = new Date(`${weekStartDate}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return weekStartDate;
  }

  parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
  return parsed.toISOString().slice(0, 10);
}

function formatWeekRange(week: ScheduleWeek): string {
  return week.weekLabel ?? `${week.weekStartDate} – ${week.weekEndDate}`;
}

function groupShiftsByDay(shifts: ScheduleShift[]): Map<string, ScheduleShift[]> {
  const grouped = new Map<string, ScheduleShift[]>();

  for (const shift of shifts) {
    if (shift.status === "cancelled") {
      continue;
    }

    const list = grouped.get(shift.date) ?? [];
    list.push(shift);
    grouped.set(shift.date, list);
  }

  for (const [, list] of grouped) {
    list.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  return grouped;
}

function buildSourceLabel(result: ScheduleFetchResult | null): {
  label: string;
  tone: "success" | "warning" | "neutral";
} {
  if (!result) {
    return { label: "Loading", tone: "neutral" };
  }

  if (result.source === "network") {
    return { label: "Live", tone: "success" };
  }

  if (result.source === "cache") {
    return { label: "Cached", tone: "warning" };
  }

  return { label: "No data", tone: "neutral" };
}

export function KioskScheduleScreen({ binding, loadScheduleWeek, onBack }: KioskScheduleScreenProps) {
  const { height, width } = useWindowDimensions();
  const isCompact = width < 720 || height < 680;
  const isTight = width < 520;
  const [result, setResult] = useState<ScheduleFetchResult | null>(null);
  const [requestedWeekStartDate, setRequestedWeekStartDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWeek = useCallback(
    async (weekStartDate: string | null, options?: { silent?: boolean; preferCache?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const next = await loadScheduleWeek(binding, {
          weekStartDate,
          preferCache: options?.preferCache,
        });
        setResult(next);
        if (next.week) {
          setRequestedWeekStartDate(next.week.weekStartDate);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [binding, loadScheduleWeek]
  );

  useEffect(() => {
    void loadWeek(null, { preferCache: false });
  }, [loadWeek]);

  const week = result?.week ?? null;

  const groupedShifts = useMemo(() => {
    return week ? groupShiftsByDay(week.shifts) : new Map<string, ScheduleShift[]>();
  }, [week]);

  const handlePrev = useCallback(() => {
    if (!week) {
      return;
    }

    const prev = shiftWeekStartDate(week.weekStartDate, -7);
    void loadWeek(prev);
  }, [loadWeek, week]);

  const handleNext = useCallback(() => {
    if (!week) {
      return;
    }

    const next = shiftWeekStartDate(week.weekStartDate, 7);
    void loadWeek(next);
  }, [loadWeek, week]);

  const handleRefresh = useCallback(() => {
    void loadWeek(requestedWeekStartDate, { silent: true });
  }, [loadWeek, requestedWeekStartDate]);

  const handleToday = useCallback(() => {
    void loadWeek(null);
  }, [loadWeek]);

  const sourceBadge = buildSourceLabel(result);
  const offlineNotice = result?.error && result.source !== "network";
  const totalShifts = week?.shifts.filter((shift) => shift.status !== "cancelled").length ?? 0;

  return (
    <ScreenFrame style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed ? styles.buttonPressed : null]}
            accessibilityLabel="Go back to home"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{binding.property.name}</Text>
            <Text style={styles.subtitle}>{week ? formatWeekRange(week) : "Loading week schedule…"}</Text>
          </View>
          <View style={styles.headerActions}>
            <KioskStatusBadge label={sourceBadge.label} tone={sourceBadge.tone} />
            <Pressable
              onPress={handleRefresh}
              style={({ pressed }) => [styles.iconButton, pressed ? styles.buttonPressed : null]}
              accessibilityLabel="Refresh schedule"
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MaterialCommunityIcons name="refresh" size={20} color={colors.foreground} />
              )}
            </Pressable>
          </View>
        </View>

        <View style={[styles.weekControls, isTight ? styles.weekControlsTight : null]}>
          <Pressable
            onPress={handlePrev}
            disabled={!week}
            style={({ pressed }) => [styles.weekButton, pressed && week ? styles.buttonPressed : null, !week ? styles.weekButtonDisabled : null]}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.foreground} />
            <Text style={styles.weekButtonLabel}>Previous</Text>
          </Pressable>
          <Pressable
            onPress={handleToday}
            style={({ pressed }) => [styles.todayButton, pressed ? styles.buttonPressed : null]}
          >
            <MaterialCommunityIcons name="calendar-today" size={18} color={colors.primaryForeground} />
            <Text style={styles.todayButtonLabel}>This week</Text>
          </Pressable>
          <Pressable
            onPress={handleNext}
            disabled={!week}
            style={({ pressed }) => [styles.weekButton, pressed && week ? styles.buttonPressed : null, !week ? styles.weekButtonDisabled : null]}
          >
            <Text style={styles.weekButtonLabel}>Next</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {offlineNotice ? (
          <View style={styles.offlineBanner}>
            <MaterialCommunityIcons name="cloud-off-outline" size={18} color={colors.warning} />
            <Text style={styles.offlineBannerText}>
              Showing cached schedule. {result?.fetchedAt ? formatRelativeTime(result.fetchedAt) : "Last refresh unknown."}
            </Text>
          </View>
        ) : null}

        {loading && !week ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading schedule…</Text>
          </View>
        ) : null}

        {!loading && !week ? <EmptyState /> : null}

        {week ? (
          <ScrollView
            contentContainerStyle={[styles.daysList, isCompact ? styles.daysListCompact : null]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {totalShifts === 0
                  ? "No shifts scheduled this week."
                  : `${totalShifts} shift${totalShifts === 1 ? "" : "s"} this week.`}
              </Text>
              <Text style={styles.summaryStatus}>
                {week.status === "published" ? "Published" : "Draft"}
              </Text>
            </View>

            {week.days.map((day) => (
              <DayCard key={day.date} day={day} shifts={groupedShifts.get(day.date) ?? []} />
            ))}
          </ScrollView>
        ) : null}
      </View>
    </ScreenFrame>
  );
}

function EmptyState() {
  return (
    <SurfaceCard style={styles.emptyCard}>
      <MaterialCommunityIcons name="calendar-blank-outline" size={28} color={colors.mutedForeground} />
      <Text style={styles.emptyTitle}>No schedule available</Text>
      <Text style={styles.emptyHelper}>
        Connect this kiosk to the network to download the latest schedule. Once cached, it will remain available offline.
      </Text>
    </SurfaceCard>
  );
}

type DayCardProps = {
  day: ScheduleDay;
  shifts: ScheduleShift[];
};

function DayCard({ day, shifts }: DayCardProps) {
  return (
    <View style={[styles.dayCard, day.isToday ? styles.dayCardToday : null]}>
      <View style={styles.dayHeader}>
        <View style={styles.dayHeaderLabels}>
          <Text style={[styles.dayHeading, day.isToday ? styles.dayHeadingToday : null]}>
            {day.label}
          </Text>
          {day.isToday ? (
            <View style={styles.todayPill}>
              <Text style={styles.todayPillLabel}>Today</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.dayCount}>{shifts.length === 0 ? "No shifts" : `${shifts.length} shift${shifts.length === 1 ? "" : "s"}`}</Text>
      </View>

      {shifts.length === 0 ? (
        <View style={styles.dayEmpty}>
          <Text style={styles.dayEmptyText}>—</Text>
        </View>
      ) : (
        <View style={styles.shiftsList}>
          {shifts.map((shift) => (
            <ShiftRow key={shift.id} shift={shift} />
          ))}
        </View>
      )}
    </View>
  );
}

function ShiftRow({ shift }: { shift: ScheduleShift }) {
  const isOpen = shift.status === "open" || !shift.employeeId;
  const employeeLabel = shift.employee?.name ?? shift.employeeName ?? "Open shift";
  const employmentStatus = shift.employee?.employmentStatus;
  const inactive = employmentStatus && employmentStatus !== "active";

  return (
    <View style={[styles.shiftRow, isOpen ? styles.shiftRowOpen : null]}>
      <View style={styles.shiftTimeColumn}>
        <Text style={styles.shiftTimeLabel}>{shift.startTime}</Text>
        <Text style={styles.shiftTimeDivider}>—</Text>
        <Text style={styles.shiftTimeLabel}>{shift.endTime}</Text>
        {shift.isOvernight ? <Text style={styles.shiftOvernight}>overnight</Text> : null}
      </View>

      <View style={styles.shiftDetails}>
        <Text style={[styles.shiftEmployee, isOpen ? styles.shiftEmployeeOpen : null]} numberOfLines={1}>
          {employeeLabel}
        </Text>
        <View style={styles.shiftMeta}>
          {shift.positionLabel ? <Text style={styles.shiftMetaText}>{shift.positionLabel}</Text> : null}
          {shift.breakMinutes > 0 ? (
            <Text style={styles.shiftMetaText}>· {shift.breakMinutes}m break</Text>
          ) : null}
          {inactive ? <Text style={styles.shiftMetaWarning}>· {employmentStatus}</Text> : null}
        </View>
        {shift.notes ? <Text style={styles.shiftNotes} numberOfLines={2}>{shift.notes}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.foreground,
  },
  subtitle: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.6,
  },
  weekControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  weekControlsTight: {
    flexWrap: "wrap",
  },
  weekButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekButtonDisabled: {
    opacity: 0.5,
  },
  weekButtonLabel: {
    ...typography.label,
    color: colors.foreground,
  },
  todayButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  todayButtonLabel: {
    ...typography.label,
    color: colors.primaryForeground,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "hsla(38, 84%, 42%, 0.2)",
  },
  offlineBannerText: {
    ...typography.helper,
    color: colors.warning,
    flexShrink: 1,
  },
  loadingBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.label,
    color: colors.foreground,
    fontSize: 18,
  },
  emptyHelper: {
    ...typography.helper,
    color: colors.mutedForeground,
    textAlign: "center",
    maxWidth: 420,
  },
  daysList: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  daysListCompact: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
  },
  summaryText: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  summaryStatus: {
    ...typography.overline,
    color: colors.primary,
    fontSize: 11,
  },
  dayCard: {
    ...surfaces.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  dayCardToday: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayHeaderLabels: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dayHeading: {
    ...typography.label,
    fontSize: 16,
    color: colors.foreground,
  },
  dayHeadingToday: {
    color: colors.primary,
  },
  todayPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  todayPillLabel: {
    ...typography.overline,
    fontSize: 10,
    color: colors.primaryForeground,
  },
  dayCount: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  dayEmpty: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  dayEmptyText: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  shiftsList: {
    gap: spacing.sm,
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftRowOpen: {
    borderColor: "hsla(38, 84%, 42%, 0.4)",
    backgroundColor: colors.warningSoft,
  },
  shiftTimeColumn: {
    minWidth: 92,
    alignItems: "flex-start",
    gap: 2,
  },
  shiftTimeLabel: {
    ...typography.label,
    color: colors.foreground,
  },
  shiftTimeDivider: {
    ...typography.helper,
    color: colors.mutedForeground,
    fontSize: 12,
  },
  shiftOvernight: {
    ...typography.overline,
    fontSize: 10,
    color: colors.mutedForeground,
  },
  shiftDetails: {
    flex: 1,
    gap: 2,
  },
  shiftEmployee: {
    ...typography.label,
    color: colors.foreground,
  },
  shiftEmployeeOpen: {
    color: colors.warning,
  },
  shiftMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xxs,
  },
  shiftMetaText: {
    ...typography.helper,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  shiftMetaWarning: {
    ...typography.helper,
    fontSize: 13,
    color: colors.destructive,
  },
  shiftNotes: {
    ...typography.helper,
    fontSize: 13,
    color: colors.secondaryForeground,
    fontStyle: "italic",
    marginTop: spacing.xxs,
  },
});
