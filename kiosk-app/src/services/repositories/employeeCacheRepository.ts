import * as Crypto from "expo-crypto";
import type * as SQLite from "expo-sqlite";

import type { CachedEmployee } from "../../types/offlineClock";
import type { EmployeeKioskProfile } from "../../types/kiosk";

const HASH_ALGORITHM = Crypto.CryptoDigestAlgorithm.SHA256;

export async function hashPinForCache(organizationId: string, pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(HASH_ALGORITHM, `${organizationId}:${salt}:${pin}`);
}

export function createPinSalt(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

type CachedEmployeeRow = {
  employee_id: string;
  organization_id: string;
  property_id: string;
  first_name: string;
  last_name: string;
  employee_code: string | null;
  employment_status: string;
  pin_hash: string;
  pin_salt: string;
  cached_at: string;
};

function mapRow(row: CachedEmployeeRow): CachedEmployee {
  return {
    id: row.employee_id,
    organizationId: row.organization_id,
    propertyId: row.property_id,
    firstName: row.first_name,
    lastName: row.last_name,
    employeeCode: row.employee_code,
    employmentStatus: row.employment_status,
    pinHash: row.pin_hash,
    pinSalt: row.pin_salt,
    cachedAt: row.cached_at,
  };
}

export class EmployeeCacheRepository {
  constructor(private readonly database: SQLite.SQLiteDatabase) {}

  async upsertValidatedPin(employee: EmployeeKioskProfile, pin: string): Promise<void> {
    const pinSalt = createPinSalt();
    const pinHash = await hashPinForCache(employee.organizationId, pin, pinSalt);
    const cachedAt = new Date().toISOString();

    await this.database.runAsync(
      `
        INSERT INTO employee_pin_cache (
          employee_id,
          organization_id,
          property_id,
          first_name,
          last_name,
          employee_code,
          employment_status,
          pin_hash,
          pin_salt,
          cached_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(employee_id) DO UPDATE SET
          organization_id = excluded.organization_id,
          property_id = excluded.property_id,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          employee_code = excluded.employee_code,
          employment_status = excluded.employment_status,
          pin_hash = excluded.pin_hash,
          pin_salt = excluded.pin_salt,
          cached_at = excluded.cached_at
      `,
      employee.id,
      employee.organizationId,
      employee.propertyId,
      employee.firstName,
      employee.lastName,
      employee.employeeCode,
      employee.employmentStatus,
      pinHash,
      pinSalt,
      cachedAt
    );
  }

  async findActiveByPin(propertyId: string, pin: string): Promise<CachedEmployee | null> {
    const rows = await this.database.getAllAsync<CachedEmployeeRow>(
      `
        SELECT *
        FROM employee_pin_cache
        WHERE property_id = ? AND employment_status = 'active'
      `,
      propertyId
    );

    for (const row of rows) {
      const candidate = mapRow(row);
      const expectedHash = await hashPinForCache(candidate.organizationId, pin, candidate.pinSalt);

      if (expectedHash === candidate.pinHash) {
        return candidate;
      }
    }

    return null;
  }
}
