import { getLocalDatabase } from "./localDb";
import { ClockEventRepository } from "./repositories/clockEventRepository";
import { EmployeeCacheRepository } from "./repositories/employeeCacheRepository";
import { OutboxRepository } from "./repositories/outboxRepository";
import { SyncMetadataRepository } from "./repositories/syncMetadataRepository";
import { assertNoDuplicateLocalEvent, resolveActionFromLatestLocalEvent } from "./offlineClockState";
import { createClientUuid } from "./uuid";
import {
  clockActionToEventType,
  clockEventTypeToAction,
  type LocalClockCreationInput,
  type LocalClockEvent,
  type SyncSummary,
} from "../types/offlineClock";
import type { ClockActionType, EmployeeKioskProfile, KioskDeviceBinding } from "../types/kiosk";

type LocalValidationResult =
  | {
      ok: true;
      employee: EmployeeKioskProfile;
      nextAction: ClockActionType;
      requiresPhotoCapture: boolean;
    }
  | {
      ok: false;
      title: string;
      message: string;
    };

export class OfflineClockService {
  private repositoriesPromise:
    | Promise<{
        clockEvents: ClockEventRepository;
        employees: EmployeeCacheRepository;
        outbox: OutboxRepository;
        syncMetadata: SyncMetadataRepository;
      }>
    | null = null;

  private async getRepositories() {
    if (!this.repositoriesPromise) {
      this.repositoriesPromise = getLocalDatabase().then((database) => ({
        clockEvents: new ClockEventRepository(database),
        employees: new EmployeeCacheRepository(database),
        outbox: new OutboxRepository(database),
        syncMetadata: new SyncMetadataRepository(database),
      }));
    }

    return this.repositoriesPromise;
  }

  async cacheValidatedEmployeePin(employee: EmployeeKioskProfile, pin: string): Promise<void> {
    const { employees } = await this.getRepositories();
    await employees.upsertValidatedPin(employee, pin);
  }

  async validateCachedPin(binding: KioskDeviceBinding, pin: string): Promise<LocalValidationResult> {
    const { employees, syncMetadata } = await this.getRepositories();

    if (!(await syncMetadata.isWithinOfflineGraceWindow())) {
      return {
        ok: false,
        title: "Internet required",
        message: "This kiosk must reconnect before more offline clock events can be saved.",
      };
    }

    const employee = await employees.findActiveByPin(binding.property.id, pin);

    if (!employee) {
      return {
        ok: false,
        title: "PIN not recognized offline",
        message: "Reconnect to refresh employee access and try again.",
      };
    }

    return {
      ok: true,
      employee,
      nextAction: await this.resolveNextAction(employee.id, binding.property.id, "clock-in"),
      requiresPhotoCapture: false,
    };
  }

  async resolveNextAction(
    employeeId: string,
    propertyId: string,
    fallbackAction: ClockActionType
  ): Promise<ClockActionType> {
    const { clockEvents } = await this.getRepositories();
    const latestEvent = await clockEvents.getLatestForEmployee(employeeId, propertyId);

    // Pending events are real kiosk state. This prevents a second tap from offering the same action
    // while the outbox is still waiting for the backend idempotency response.
    if (!latestEvent) {
      return fallbackAction;
    }

    return resolveActionFromLatestLocalEvent(latestEvent.type, fallbackAction);
  }

  async createLocalClockEvent(input: LocalClockCreationInput): Promise<LocalClockEvent> {
    const database = await getLocalDatabase();
    const clockEvents = new ClockEventRepository(database);
    const outbox = new OutboxRepository(database);
    const requestedType = clockActionToEventType(input.action);
    let savedEvent: LocalClockEvent | null = null;

    await database.withExclusiveTransactionAsync(async (transaction) => {
      const latestEvent = await transaction.getFirstAsync<{ type: "IN" | "OUT" }>(
        `
          SELECT type
          FROM clock_events
          WHERE employee_id = ? AND property_id = ?
          ORDER BY timestamp DESC, id DESC
          LIMIT 1
        `,
        input.employee.id,
        input.binding.property.id
      );

      assertNoDuplicateLocalEvent(latestEvent?.type, requestedType);

      const clientEventId = createClientUuid();
      savedEvent = await clockEvents.insertPending(
        {
          clientEventId,
          employeeId: input.employee.id,
          propertyId: input.binding.property.id,
          type: requestedType,
          timestamp: input.occurredAt,
          photoPath: input.capturedImageUri,
        },
        transaction
      );

      await outbox.insertClockEventCreate(
        {
          clientEventId,
          employeeId: input.employee.id,
          propertyId: input.binding.property.id,
          type: requestedType,
          deviceTimestamp: input.occurredAt,
          source: "KIOSK",
          photo: input.capturedImageUri ? { localPath: input.capturedImageUri } : null,
        },
        transaction
      );
    });

    if (!savedEvent) {
      throw new Error("Clock event was not saved locally.");
    }

    return savedEvent;
  }

  async getSummary(): Promise<SyncSummary> {
    const { clockEvents, outbox, syncMetadata } = await this.getRepositories();

    return {
      pendingCount: await outbox.getPendingCount(),
      failedCount: await outbox.getFailedCount(),
      conflictCount: await clockEvents.getConflictCount(),
      lastSuccessfulSyncAt: await syncMetadata.getLastSuccessfulSyncAt(),
    };
  }

  async markSuccessfulSync(timestamp = new Date().toISOString()): Promise<void> {
    const { syncMetadata } = await this.getRepositories();
    await syncMetadata.markSuccessfulSync(timestamp);
  }
}

export function createOfflineClockService(): OfflineClockService {
  return new OfflineClockService();
}

export { clockEventTypeToAction };
