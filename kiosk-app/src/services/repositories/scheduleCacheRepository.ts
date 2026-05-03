import type * as SQLite from "expo-sqlite";

import type { CachedScheduleWeek, ScheduleWeek } from "../../types/schedule";

type ScheduleWeekRow = {
  property_id: string;
  week_start_date: string;
  payload_json: string;
  fetched_at: string;
};

const MAX_CACHED_WEEKS = 12;

function parseRow(row: ScheduleWeekRow): CachedScheduleWeek | null {
  try {
    const week = JSON.parse(row.payload_json) as ScheduleWeek;
    return {
      week,
      fetchedAt: row.fetched_at,
    };
  } catch {
    return null;
  }
}

export class ScheduleCacheRepository {
  constructor(private readonly database: SQLite.SQLiteDatabase) {}

  async upsert(week: ScheduleWeek, fetchedAt = new Date().toISOString()): Promise<void> {
    const payload = JSON.stringify(week);

    await this.database.runAsync(
      `
        INSERT INTO schedule_week_cache (property_id, week_start_date, payload_json, fetched_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(property_id, week_start_date) DO UPDATE SET
          payload_json = excluded.payload_json,
          fetched_at = excluded.fetched_at
      `,
      week.property.id,
      week.weekStartDate,
      payload,
      fetchedAt
    );
    await this.evictOldEntries(week.property.id);
  }

  async findByWeek(propertyId: string, weekStartDate: string): Promise<CachedScheduleWeek | null> {
    const row = await this.database.getFirstAsync<ScheduleWeekRow>(
      `
        SELECT property_id, week_start_date, payload_json, fetched_at
        FROM schedule_week_cache
        WHERE property_id = ? AND week_start_date = ?
        LIMIT 1
      `,
      propertyId,
      weekStartDate
    );

    return row ? parseRow(row) : null;
  }

  async findCoveringDate(propertyId: string, dateIso: string): Promise<CachedScheduleWeek | null> {
    const row = await this.database.getFirstAsync<ScheduleWeekRow>(
      `
        SELECT property_id, week_start_date, payload_json, fetched_at
        FROM schedule_week_cache
        WHERE property_id = ?
          AND week_start_date <= ?
          AND date(week_start_date, '+6 day') >= ?
        ORDER BY fetched_at DESC
        LIMIT 1
      `,
      propertyId,
      dateIso,
      dateIso
    );

    return row ? parseRow(row) : null;
  }

  async findMostRecent(propertyId: string): Promise<CachedScheduleWeek | null> {
    const row = await this.database.getFirstAsync<ScheduleWeekRow>(
      `
        SELECT property_id, week_start_date, payload_json, fetched_at
        FROM schedule_week_cache
        WHERE property_id = ?
        ORDER BY fetched_at DESC
        LIMIT 1
      `,
      propertyId
    );

    return row ? parseRow(row) : null;
  }

  async clearForProperty(propertyId: string): Promise<void> {
    await this.database.runAsync(
      "DELETE FROM schedule_week_cache WHERE property_id = ?",
      propertyId
    );
  }

  private async evictOldEntries(propertyId: string): Promise<void> {
    await this.database.runAsync(
      `
        DELETE FROM schedule_week_cache
        WHERE property_id = ?
          AND week_start_date NOT IN (
            SELECT week_start_date
            FROM schedule_week_cache
            WHERE property_id = ?
            ORDER BY fetched_at DESC
            LIMIT ?
          )
      `,
      propertyId,
      propertyId,
      MAX_CACHED_WEEKS
    );
  }
}
