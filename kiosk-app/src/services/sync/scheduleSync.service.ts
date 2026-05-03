import { getLocalDatabase } from "../localDb";
import { ScheduleCacheRepository } from "../repositories/scheduleCacheRepository";
import { SyncMetadataRepository } from "../repositories/syncMetadataRepository";
import type { CachedScheduleWeek, ScheduleWeek } from "../../types/schedule";

export type ScheduleFetchSource = "network" | "cache" | "empty";

export type ScheduleFetchResult = {
  source: ScheduleFetchSource;
  week: ScheduleWeek | null;
  fetchedAt: string | null;
  error: string | null;
};

export type ScheduleNetworkClient = (params: {
  weekStartDate: string | null;
}) => Promise<{ week: ScheduleWeek }>;

type FetchInput = {
  propertyId: string;
  weekStartDate: string | null;
  network: ScheduleNetworkClient;
};

let pullInFlight = false;

export async function fetchAndCacheScheduleWeek({
  propertyId,
  weekStartDate,
  network,
}: FetchInput): Promise<ScheduleFetchResult> {
  if (pullInFlight) {
    return readCachedScheduleWeek({ propertyId, weekStartDate });
  }

  pullInFlight = true;

  try {
    const response = await network({ weekStartDate });
    const database = await getLocalDatabase();
    const cache = new ScheduleCacheRepository(database);
    const fetchedAt = new Date().toISOString();
    await cache.upsert(response.week, fetchedAt);
    await new SyncMetadataRepository(database).markSuccessfulSync(fetchedAt);

    return {
      source: "network",
      week: response.week,
      fetchedAt,
      error: null,
    };
  } catch (error) {
    const cached = await readCachedScheduleWeek({ propertyId, weekStartDate });
    const message = error instanceof Error ? error.message : "Unable to load schedule.";

    if (cached.week) {
      return {
        ...cached,
        error: message,
      };
    }

    return {
      source: "empty",
      week: null,
      fetchedAt: null,
      error: message,
    };
  } finally {
    pullInFlight = false;
  }
}

export async function readCachedScheduleWeek({
  propertyId,
  weekStartDate,
}: {
  propertyId: string;
  weekStartDate: string | null;
}): Promise<ScheduleFetchResult> {
  const database = await getLocalDatabase();
  const cache = new ScheduleCacheRepository(database);

  const cached: CachedScheduleWeek | null = weekStartDate
    ? await cache.findByWeek(propertyId, weekStartDate)
    : await findMostRecentCachedWeek(cache, propertyId);

  if (!cached) {
    return {
      source: "empty",
      week: null,
      fetchedAt: null,
      error: null,
    };
  }

  return {
    source: "cache",
    week: cached.week,
    fetchedAt: cached.fetchedAt,
    error: null,
  };
}

async function findMostRecentCachedWeek(
  cache: ScheduleCacheRepository,
  propertyId: string
): Promise<CachedScheduleWeek | null> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const covering = await cache.findCoveringDate(propertyId, todayIso);

  if (covering) {
    return covering;
  }

  return cache.findMostRecent(propertyId);
}
