import type * as SQLite from "expo-sqlite";

import type { ClockEventSyncStatus, ClockEventType, LocalClockEvent } from "../../types/offlineClock";

type ClockEventRow = {
  id: number;
  client_event_id: string;
  server_event_id: string | null;
  employee_id: string;
  property_id: string;
  type: ClockEventType;
  timestamp: string;
  source: "KIOSK";
  photo_path: string | null;
  sync_status: ClockEventSyncStatus;
  sync_attempts: number;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ClockEventRow): LocalClockEvent {
  return {
    id: row.id,
    clientEventId: row.client_event_id,
    serverEventId: row.server_event_id,
    employeeId: row.employee_id,
    propertyId: row.property_id,
    type: row.type,
    timestamp: row.timestamp,
    source: row.source,
    photoPath: row.photo_path,
    syncStatus: row.sync_status,
    syncAttempts: row.sync_attempts,
    lastSyncError: row.last_sync_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ClockEventRepository {
  constructor(private readonly database: SQLite.SQLiteDatabase) {}

  async getLatestForEmployee(employeeId: string, propertyId: string): Promise<LocalClockEvent | null> {
    const row = await this.database.getFirstAsync<ClockEventRow>(
      `
        SELECT *
        FROM clock_events
        WHERE employee_id = ? AND property_id = ?
        ORDER BY timestamp DESC, id DESC
        LIMIT 1
      `,
      employeeId,
      propertyId
    );

    return row ? mapRow(row) : null;
  }

  async insertPending(
    input: {
      clientEventId: string;
      employeeId: string;
      propertyId: string;
      type: ClockEventType;
      timestamp: string;
      photoPath: string | null;
    },
    database: SQLite.SQLiteDatabase = this.database
  ): Promise<LocalClockEvent> {
    const now = new Date().toISOString();
    await database.runAsync(
      `
        INSERT INTO clock_events (
          client_event_id,
          server_event_id,
          employee_id,
          property_id,
          type,
          timestamp,
          source,
          photo_path,
          sync_status,
          sync_attempts,
          last_sync_error,
          created_at,
          updated_at
        )
        VALUES (?, NULL, ?, ?, ?, ?, 'KIOSK', ?, 'PENDING', 0, NULL, ?, ?)
      `,
      input.clientEventId,
      input.employeeId,
      input.propertyId,
      input.type,
      input.timestamp,
      input.photoPath,
      now,
      now
    );

    const event = await this.getByClientEventId(input.clientEventId, database);

    if (!event) {
      throw new Error("Local clock event was not saved.");
    }

    return event;
  }

  async getByClientEventId(
    clientEventId: string,
    database: SQLite.SQLiteDatabase = this.database
  ): Promise<LocalClockEvent | null> {
    const row = await database.getFirstAsync<ClockEventRow>(
      "SELECT * FROM clock_events WHERE client_event_id = ? LIMIT 1",
      clientEventId
    );

    return row ? mapRow(row) : null;
  }

  async markSynced(clientEventId: string, serverEventId: string | null): Promise<void> {
    await this.database.runAsync(
      `
        UPDATE clock_events
        SET sync_status = 'SYNCED',
            server_event_id = COALESCE(?, server_event_id),
            last_sync_error = NULL,
            sync_attempts = sync_attempts + 1,
            updated_at = ?
        WHERE client_event_id = ?
      `,
      serverEventId,
      new Date().toISOString(),
      clientEventId
    );
  }

  async markConflict(clientEventId: string, message: string | null): Promise<void> {
    await this.database.runAsync(
      `
        UPDATE clock_events
        SET sync_status = 'CONFLICT',
            last_sync_error = ?,
            sync_attempts = sync_attempts + 1,
            updated_at = ?
        WHERE client_event_id = ?
      `,
      message,
      new Date().toISOString(),
      clientEventId
    );
  }

  async markFailed(clientEventId: string, message: string): Promise<void> {
    await this.database.runAsync(
      `
        UPDATE clock_events
        SET sync_status = 'FAILED',
            last_sync_error = ?,
            sync_attempts = sync_attempts + 1,
            updated_at = ?
        WHERE client_event_id = ?
      `,
      message,
      new Date().toISOString(),
      clientEventId
    );
  }

  async getConflictCount(): Promise<number> {
    const row = await this.database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM clock_events WHERE sync_status = 'CONFLICT'"
    );

    return row?.count ?? 0;
  }
}
