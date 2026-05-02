import { SyncMetadataRepository } from "../repositories/syncMetadataRepository";
import { getLocalDatabase } from "../localDb";

const SERVER_TIME_OFFSET_KEY = "serverTimeOffsetMs";

export async function storeServerTimeOffset(serverTimeIso: string, localReceivedAt = new Date()): Promise<void> {
  const serverTime = new Date(serverTimeIso).getTime();

  if (Number.isNaN(serverTime)) {
    return;
  }

  const database = await getLocalDatabase();
  const repository = new SyncMetadataRepository(database);
  await repository.set(SERVER_TIME_OFFSET_KEY, String(serverTime - localReceivedAt.getTime()));
}

export async function estimateServerTimestamp(deviceTimestampIso: string): Promise<string | null> {
  const database = await getLocalDatabase();
  const repository = new SyncMetadataRepository(database);
  const offsetValue = await repository.get(SERVER_TIME_OFFSET_KEY);
  const offset = offsetValue ? Number(offsetValue) : 0;
  const deviceTimestamp = new Date(deviceTimestampIso).getTime();

  if (!Number.isFinite(offset) || Number.isNaN(deviceTimestamp)) {
    return null;
  }

  return new Date(deviceTimestamp + offset).toISOString();
}
