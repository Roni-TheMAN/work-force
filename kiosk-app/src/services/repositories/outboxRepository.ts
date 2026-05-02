import type * as SQLite from "expo-sqlite";

import type { ClockEventOutboxPayload, OutboxItem, OutboxOperation, OutboxStatus } from "../../types/offlineClock";

type OutboxRow = {
  id: number;
  client_event_id: string;
  operation: OutboxOperation;
  payload_json: string;
  status: OutboxStatus;
  attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: OutboxRow): OutboxItem {
  return {
    id: row.id,
    clientEventId: row.client_event_id,
    operation: row.operation,
    payloadJson: row.payload_json,
    status: row.status,
    attempts: row.attempts,
    nextRetryAt: row.next_retry_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class OutboxRepository {
  constructor(private readonly database: SQLite.SQLiteDatabase) {}

  async insertClockEventCreate(
    payload: ClockEventOutboxPayload,
    database: SQLite.SQLiteDatabase = this.database
  ): Promise<void> {
    const now = new Date().toISOString();
    await database.runAsync(
      `
        INSERT INTO outbox (
          client_event_id,
          operation,
          payload_json,
          status,
          attempts,
          next_retry_at,
          last_error,
          created_at,
          updated_at
        )
        VALUES (?, 'CLOCK_EVENT_CREATE', ?, 'PENDING', 0, NULL, NULL, ?, ?)
      `,
      payload.clientEventId,
      JSON.stringify(payload),
      now,
      now
    );
  }

  async listReady(limit = 25): Promise<OutboxItem[]> {
    const now = new Date().toISOString();
    const rows = await this.database.getAllAsync<OutboxRow>(
      `
        SELECT *
        FROM outbox
        WHERE status IN ('PENDING', 'FAILED')
          AND (next_retry_at IS NULL OR next_retry_at <= ?)
        ORDER BY created_at ASC, id ASC
        LIMIT ?
      `,
      now,
      limit
    );

    return rows.map(mapRow);
  }

  async markProcessing(id: number): Promise<void> {
    await this.database.runAsync(
      "UPDATE outbox SET status = 'PROCESSING', updated_at = ? WHERE id = ?",
      new Date().toISOString(),
      id
    );
  }

  async markSynced(id: number): Promise<void> {
    await this.database.runAsync(
      "UPDATE outbox SET status = 'SYNCED', last_error = NULL, next_retry_at = NULL, updated_at = ? WHERE id = ?",
      new Date().toISOString(),
      id
    );
  }

  async markFailed(id: number, error: string, nextRetryAt: string): Promise<void> {
    await this.database.runAsync(
      `
        UPDATE outbox
        SET status = 'FAILED',
            attempts = attempts + 1,
            next_retry_at = ?,
            last_error = ?,
            updated_at = ?
        WHERE id = ?
      `,
      nextRetryAt,
      error,
      new Date().toISOString(),
      id
    );
  }

  async resetProcessingToPending(): Promise<void> {
    await this.database.runAsync(
      "UPDATE outbox SET status = 'PENDING', updated_at = ? WHERE status = 'PROCESSING'",
      new Date().toISOString()
    );
  }

  async getPendingCount(): Promise<number> {
    const row = await this.database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM outbox WHERE status IN ('PENDING', 'PROCESSING', 'FAILED')"
    );

    return row?.count ?? 0;
  }

  async getFailedCount(): Promise<number> {
    const row = await this.database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM outbox WHERE status = 'FAILED'"
    );

    return row?.count ?? 0;
  }
}
