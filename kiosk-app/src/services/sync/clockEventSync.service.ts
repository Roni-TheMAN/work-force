import { getLocalDatabase } from "../localDb";
import { getNetworkStatus, isOnline } from "../network.service";
import { computeRetryDelayMs, sortOutboxForSync } from "../offlineClockState";
import { ClockEventRepository } from "../repositories/clockEventRepository";
import { OutboxRepository } from "../repositories/outboxRepository";
import { SyncMetadataRepository } from "../repositories/syncMetadataRepository";
import { estimateServerTimestamp, storeServerTimeOffset } from "../time/serverTimeOffset.service";
import type {
  ClockEventOutboxPayload,
  OutboxItem,
  SyncClockEventsRequest,
  SyncClockEventsResponse,
} from "../../types/offlineClock";
import type { KioskDeviceBinding } from "../../types/kiosk";

type SyncDependencies = {
  binding: KioskDeviceBinding;
  postClockEvents: (payload: SyncClockEventsRequest) => Promise<SyncClockEventsResponse>;
};

let syncInFlight = false;

function nextRetryAt(attempts: number): string {
  return new Date(Date.now() + computeRetryDelayMs(attempts)).toISOString();
}

function parsePayload(item: OutboxItem): ClockEventOutboxPayload {
  return JSON.parse(item.payloadJson) as ClockEventOutboxPayload;
}

export async function syncPendingClockEvents({ binding, postClockEvents }: SyncDependencies): Promise<void> {
  if (syncInFlight) {
    return;
  }

  syncInFlight = true;

  try {
    if (!isOnline(await getNetworkStatus())) {
      return;
    }

    const database = await getLocalDatabase();
    const outbox = new OutboxRepository(database);
    const clockEvents = new ClockEventRepository(database);
    const syncMetadata = new SyncMetadataRepository(database);
    await outbox.resetProcessingToPending();
    const readyItems = sortOutboxForSync(await outbox.listReady());

    for (const item of readyItems) {
      await outbox.markProcessing(item.id);
      const payload = parsePayload(item);

      try {
        const response = await postClockEvents({
          kioskDeviceId: binding.device.id,
          propertyId: binding.property.id,
          events: [
            {
              clientEventId: payload.clientEventId,
              employeeId: payload.employeeId,
              type: payload.type,
              deviceTimestamp: payload.deviceTimestamp,
              estimatedServerTimestamp: await estimateServerTimestamp(payload.deviceTimestamp),
              source: payload.source,
              photo: payload.photo,
            },
          ],
        });

        await storeServerTimeOffset(response.serverTime);
        const result = response.results.find((candidate) => candidate.clientEventId === payload.clientEventId);

        if (!result) {
          throw new Error("Sync response did not include this event.");
        }

        if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
          await clockEvents.markSynced(payload.clientEventId, result.serverEventId ?? null);
          await outbox.markSynced(item.id);
          await syncMetadata.markSuccessfulSync(response.serverTime);
        } else if (result.status === "CONFLICT" || result.status === "REJECTED") {
          await clockEvents.markConflict(payload.clientEventId, result.message ?? result.status);
          await outbox.markSynced(item.id);
          await syncMetadata.markSuccessfulSync(response.serverTime);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed.";
        await clockEvents.markFailed(payload.clientEventId, message);
        await outbox.markFailed(item.id, message, nextRetryAt(item.attempts + 1));
      }
    }
  } finally {
    syncInFlight = false;
  }
}
