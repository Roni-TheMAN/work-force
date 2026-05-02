import type * as SQLite from "expo-sqlite";

const LAST_SUCCESSFUL_SYNC_KEY = "lastSuccessfulSyncAt";
const OFFLINE_GRACE_HOURS_KEY = "offlineGraceHours";
const DEFAULT_OFFLINE_GRACE_HOURS = 24;

export class SyncMetadataRepository {
  constructor(private readonly database: SQLite.SQLiteDatabase) {}

  async get(key: string): Promise<string | null> {
    const row = await this.database.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_metadata WHERE key = ? LIMIT 1",
      key
    );

    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    await this.database.runAsync(
      `
        INSERT INTO sync_metadata (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `,
      key,
      value,
      now
    );
  }

  async getLastSuccessfulSyncAt(): Promise<string | null> {
    return this.get(LAST_SUCCESSFUL_SYNC_KEY);
  }

  async markSuccessfulSync(timestamp = new Date().toISOString()): Promise<void> {
    await this.set(LAST_SUCCESSFUL_SYNC_KEY, timestamp);
  }

  async getOfflineGraceHours(): Promise<number> {
    const value = await this.get(OFFLINE_GRACE_HOURS_KEY);
    const parsed = value ? Number(value) : DEFAULT_OFFLINE_GRACE_HOURS;

    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_OFFLINE_GRACE_HOURS;
  }

  async isWithinOfflineGraceWindow(referenceTime = new Date()): Promise<boolean> {
    const lastSuccessfulSyncAt = await this.getLastSuccessfulSyncAt();

    if (!lastSuccessfulSyncAt) {
      return false;
    }

    const parsed = new Date(lastSuccessfulSyncAt).getTime();

    if (Number.isNaN(parsed)) {
      return false;
    }

    const graceMs = (await this.getOfflineGraceHours()) * 60 * 60 * 1000;
    return referenceTime.getTime() - parsed <= graceMs;
  }
}
