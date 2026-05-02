import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import type { Prisma, PrismaClient } from "../../generated/prisma-rbac";

import { env } from "../lib/env";
import { HttpError } from "../lib/http-error";

export const EMPLOYEE_PIN_LENGTH = 6;

export type EmployeePinMode = "auto" | "manual";
export type EmployeePinEventType = "generated" | "manual_set" | "revealed" | "reset";

export type EmployeePinAssignment = {
  assignedAt: Date;
  pinCiphertext: string;
  pinHash: string;
  pinLookupKey: string;
  pinMode: EmployeePinMode;
  plainTextPin: string;
};

type EmployeePinDbClient = PrismaClient | Prisma.TransactionClient;

function getEmployeePinSecret(): string {
  const secret = env.employeePinSecret?.trim();

  if (!secret) {
    throw new HttpError(500, "EMPLOYEE_PIN_SECRET is required for kiosk PIN operations.");
  }

  return secret;
}

function deriveKey(scope: string): Buffer {
  return createHash("sha256")
    .update(`${scope}:${getEmployeePinSecret()}`)
    .digest();
}

function assertNumericPin(pin: string): void {
  if (!/^\d{6}$/.test(pin)) {
    throw new HttpError(400, `PINs must be exactly ${EMPLOYEE_PIN_LENGTH} numeric digits.`);
  }
}

function buildPinDigest(scope: "hash" | "lookup", organizationId: string, pin: string): string {
  return createHmac("sha256", deriveKey(scope))
    .update(`${organizationId}:${pin}`)
    .digest("hex");
}

function encryptPin(organizationId: string, pin: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("cipher"), iv);
  cipher.setAAD(Buffer.from(organizationId, "utf8"));
  const encrypted = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function parseCiphertext(ciphertext: string): { authTag: Buffer; encrypted: Buffer; iv: Buffer } {
  const [version, ivHex, authTagHex, encryptedHex] = ciphertext.split(":");

  if (version !== "v1" || !ivHex || !authTagHex || !encryptedHex) {
    throw new HttpError(500, "Employee PIN ciphertext is malformed.");
  }

  return {
    iv: Buffer.from(ivHex, "hex"),
    authTag: Buffer.from(authTagHex, "hex"),
    encrypted: Buffer.from(encryptedHex, "hex"),
  };
}

function buildVerificationHash(organizationId: string, pin: string): string {
  return `v1:${buildPinDigest("hash", organizationId, pin)}`;
}

function isPinLookupKeyTaken(
  db: EmployeePinDbClient,
  organizationId: string,
  pinLookupKey: string,
  excludeEmployeeId?: string | null
) {
  return db.employee.findFirst({
    where: {
      organizationId,
      pinLookupKey,
      ...(excludeEmployeeId
        ? {
            NOT: {
              id: excludeEmployeeId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });
}

function buildRandomPin(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(EMPLOYEE_PIN_LENGTH, "0");
}

export function normalizeEmployeePinMode(value: string | null | undefined): EmployeePinMode {
  if (value === undefined || value === null || value === "") {
    return "auto";
  }

  if (value === "auto" || value === "manual") {
    return value;
  }

  throw new HttpError(400, "pinMode must be auto or manual.");
}

export function buildEmployeePinLookupKey(organizationId: string, pin: string): string {
  assertNumericPin(pin);
  return `v1:${buildPinDigest("lookup", organizationId, pin)}`;
}

export function verifyEmployeePinHash(
  organizationId: string,
  pin: string,
  storedHash: string | null | undefined
): boolean {
  if (!storedHash) {
    return false;
  }

  assertNumericPin(pin);
  const expectedHash = buildVerificationHash(organizationId, pin);
  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  const actualBuffer = Buffer.from(storedHash, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function revealEmployeePin(organizationId: string, ciphertext: string | null | undefined): string {
  if (!ciphertext) {
    throw new HttpError(404, "This employee does not have an active kiosk PIN.");
  }

  const { iv, authTag, encrypted } = parseCiphertext(ciphertext);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey("cipher"), iv);
  decipher.setAAD(Buffer.from(organizationId, "utf8"));
  decipher.setAuthTag(authTag);

  const pin = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  assertNumericPin(pin);

  return pin;
}

async function ensureUniquePin(
  db: EmployeePinDbClient,
  organizationId: string,
  pin: string,
  excludeEmployeeId?: string | null
): Promise<void> {
  const lookupKey = buildEmployeePinLookupKey(organizationId, pin);
  const existingEmployee = await isPinLookupKeyTaken(db, organizationId, lookupKey, excludeEmployeeId);

  if (existingEmployee) {
    throw new HttpError(409, "That PIN is already in use for this organization.");
  }
}

async function generateUniquePin(
  db: EmployeePinDbClient,
  organizationId: string,
  excludeEmployeeId?: string | null
): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const pin = buildRandomPin();
    const lookupKey = buildEmployeePinLookupKey(organizationId, pin);
    const existingEmployee = await isPinLookupKeyTaken(db, organizationId, lookupKey, excludeEmployeeId);

    if (!existingEmployee) {
      return pin;
    }
  }

  throw new HttpError(500, "Unable to generate a unique PIN for this organization.");
}

export async function prepareEmployeePinAssignment(
  db: EmployeePinDbClient,
  input: {
    excludeEmployeeId?: string | null;
    manualPin?: string | null;
    organizationId: string;
    pinMode: EmployeePinMode;
  }
): Promise<EmployeePinAssignment> {
  const pin =
    input.pinMode === "manual"
      ? (input.manualPin ?? "").trim()
      : await generateUniquePin(db, input.organizationId, input.excludeEmployeeId);

  assertNumericPin(pin);

  if (input.pinMode === "manual") {
    await ensureUniquePin(db, input.organizationId, pin, input.excludeEmployeeId);
  }

  const assignedAt = new Date();

  return {
    pinMode: input.pinMode,
    plainTextPin: pin,
    pinHash: buildVerificationHash(input.organizationId, pin),
    pinLookupKey: buildEmployeePinLookupKey(input.organizationId, pin),
    pinCiphertext: encryptPin(input.organizationId, pin),
    assignedAt,
  };
}

export async function recordEmployeePinEvent(
  db: EmployeePinDbClient,
  input: {
    employeeId: string;
    eventType: EmployeePinEventType;
    organizationId: string;
    performedByUserId: string;
    pinMode?: EmployeePinMode | null;
  }
): Promise<void> {
  await db.employeePinEvent.create({
    data: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      performedByUserId: input.performedByUserId,
      eventType: input.eventType,
      pinMode: input.pinMode ?? null,
    },
  });
}
