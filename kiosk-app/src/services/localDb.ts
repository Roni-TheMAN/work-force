import * as SQLite from "expo-sqlite";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS clock_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_event_id TEXT NOT NULL UNIQUE,
      server_event_id TEXT,
      employee_id TEXT NOT NULL,
      property_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'KIOSK',
      photo_path TEXT,
      sync_status TEXT NOT NULL CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED', 'CONFLICT')),
      sync_attempts INTEGER NOT NULL DEFAULT 0,
      last_sync_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_clock_events_employee_property_timestamp
      ON clock_events (employee_id, property_id, timestamp DESC, id DESC);

    CREATE INDEX IF NOT EXISTS idx_clock_events_sync_status
      ON clock_events (sync_status, created_at);

    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_event_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('CLOCK_EVENT_CREATE')),
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SYNCED', 'FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (client_event_id) REFERENCES clock_events(client_event_id)
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_status_created_at
      ON outbox (status, next_retry_at, created_at, id);

    CREATE TABLE IF NOT EXISTS employee_pin_cache (
      employee_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      property_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      employee_code TEXT,
      employment_status TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_employee_pin_cache_property
      ON employee_pin_cache (property_id, employment_status);

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export async function getLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("workforce-kiosk.db").then(async (database) => {
      await migrate(database);
      return database;
    });
  }

  return databasePromise;
}
