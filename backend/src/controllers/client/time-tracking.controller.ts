import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import {
  adjustShiftForAuthenticatedUser,
  createManualShiftForAuthenticatedUser,
  createPropertyDevicePairingTokenForAuthenticatedUser,
  deletePropertyDeviceRecordForAuthenticatedUser,
  listPropertyDevicesForAuthenticatedUser,
  listShiftsForAuthenticatedUser,
  recordClientPunchForAuthenticatedUser,
  registerPropertyDeviceForAuthenticatedUser,
  retirePropertyDeviceForAuthenticatedUser,
} from "../../services/time-tracking.service";

type RegisterPropertyDeviceBody = {
  deviceName?: string;
  deviceType?: string;
};

type ClientPunchRequestBody = {
  breakType?: string | null;
  employeeCode?: string | null;
  employeeId?: string | null;
  note?: string | null;
  occurredAt?: string | null;
  organizationId?: string;
  paid?: boolean | null;
  photoUrl?: string | null;
  propertyId?: string;
};

type ShiftAdjustmentBody = {
  breakSegments?:
    | Array<{
        breakType?: string | null;
        endedAt?: string | null;
        paid?: boolean | null;
        startedAt?: string;
      }>
    | null;
  endedAt?: string | null;
  payableMinutes?: number | null;
  reason?: string;
  startedAt?: string | null;
};

type ManualShiftCreateBody = {
  propertyId?: string;
  employeeId?: string;
  startedAt?: string;
  endedAt?: string;
  payableMinutes?: number | null;
  reason?: string;
  breakSegments?:
    | Array<{
        breakType?: string | null;
        endedAt?: string | null;
        paid?: boolean | null;
        startedAt?: string;
      }>
    | null;
};

function readRequiredPropertyId(propertyId: unknown): string {
  const normalizedValue = typeof propertyId === "string" ? propertyId.trim() : "";

  if (!normalizedValue) {
    throw new HttpError(400, "propertyId is required.");
  }

  return normalizedValue;
}

function readRequiredOrganizationId(organizationId: unknown): string {
  const normalizedValue = typeof organizationId === "string" ? organizationId.trim() : "";

  if (!normalizedValue) {
    throw new HttpError(400, "organizationId is required.");
  }

  return normalizedValue;
}

function readRequiredShiftSessionId(shiftSessionId: unknown): string {
  const normalizedValue = typeof shiftSessionId === "string" ? shiftSessionId.trim() : "";

  if (!normalizedValue) {
    throw new HttpError(400, "shiftSessionId is required.");
  }

  return normalizedValue;
}

function readRequiredDeviceId(deviceId: unknown): string {
  const normalizedValue = typeof deviceId === "string" ? deviceId.trim() : "";

  if (!normalizedValue) {
    throw new HttpError(400, "deviceId is required.");
  }

  return normalizedValue;
}

export const registerPropertyDeviceController: RequestHandler = async (req, res, next) => {
  try {
    const propertyId = readRequiredPropertyId(req.params.propertyId);
    const { deviceName, deviceType } = (req.body ?? {}) as RegisterPropertyDeviceBody;
    const authUser = getAuthenticatedUser(req);
    const result = await registerPropertyDeviceForAuthenticatedUser(authUser, propertyId, {
      deviceName: deviceName ?? "",
      deviceType: deviceType ?? "",
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const listPropertyDevicesController: RequestHandler = async (req, res, next) => {
  try {
    const propertyId = readRequiredPropertyId(req.params.propertyId);
    const authUser = getAuthenticatedUser(req);
    const devices = await listPropertyDevicesForAuthenticatedUser(authUser, propertyId);

    res.json({ devices });
  } catch (error) {
    next(error);
  }
};

export const retirePropertyDeviceController: RequestHandler = async (req, res, next) => {
  try {
    const propertyId = readRequiredPropertyId(req.params.propertyId);
    const deviceId = readRequiredDeviceId(req.params.deviceId);
    const authUser = getAuthenticatedUser(req);
    const device = await retirePropertyDeviceForAuthenticatedUser(authUser, propertyId, deviceId);

    res.json({ device });
  } catch (error) {
    next(error);
  }
};

export const deletePropertyDeviceRecordController: RequestHandler = async (req, res, next) => {
  try {
    const propertyId = readRequiredPropertyId(req.params.propertyId);
    const deviceId = readRequiredDeviceId(req.params.deviceId);
    const authUser = getAuthenticatedUser(req);
    await deletePropertyDeviceRecordForAuthenticatedUser(authUser, propertyId, deviceId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const createPropertyDevicePairingTokenController: RequestHandler = async (req, res, next) => {
  try {
    const propertyId = readRequiredPropertyId(req.params.propertyId);
    const authUser = getAuthenticatedUser(req);
    const pairingToken = await createPropertyDevicePairingTokenForAuthenticatedUser(authUser, propertyId);

    res.status(201).json({ pairingToken });
  } catch (error) {
    next(error);
  }
};

export const recordClientPunchController: RequestHandler = async (req, res, next) => {
  try {
    const punchType = typeof req.params.punchType === "string" ? req.params.punchType : "";
    const body = (req.body ?? {}) as ClientPunchRequestBody;
    const authUser = getAuthenticatedUser(req);
    const result = await recordClientPunchForAuthenticatedUser(authUser, punchType, {
      organizationId: body.organizationId ?? "",
      propertyId: body.propertyId ?? "",
      employeeId: body.employeeId ?? null,
      employeeCode: body.employeeCode ?? null,
      occurredAt: body.occurredAt ?? null,
      note: body.note ?? null,
      photoUrl: body.photoUrl ?? null,
      breakType: body.breakType ?? null,
      paid: body.paid ?? null,
    });

    res.status(result.alreadyAutoClosed ? 200 : 201).json(result);
  } catch (error) {
    next(error);
  }
};

export const listClientShiftsController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req.params.organizationId);
    const authUser = getAuthenticatedUser(req);
    const result = await listShiftsForAuthenticatedUser(authUser, organizationId, {
      propertyId: typeof req.query.propertyId === "string" ? req.query.propertyId : null,
      employeeId: typeof req.query.employeeId === "string" ? req.query.employeeId : null,
      businessDateFrom: typeof req.query.businessDateFrom === "string" ? req.query.businessDateFrom : null,
      businessDateTo: typeof req.query.businessDateTo === "string" ? req.query.businessDateTo : null,
      status: typeof req.query.status === "string" ? req.query.status : null,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const adjustClientShiftController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req.params.organizationId);
    const shiftSessionId = readRequiredShiftSessionId(req.params.shiftSessionId);
    const body = (req.body ?? {}) as ShiftAdjustmentBody;
    const authUser = getAuthenticatedUser(req);
    const normalizedBreakSegments =
      body.breakSegments === undefined
        ? undefined
        : body.breakSegments === null
          ? null
          : body.breakSegments.map(
              (segment): { breakType?: string | null; endedAt?: string | null; paid?: boolean | null; startedAt: string } => ({
                startedAt: typeof segment.startedAt === "string" ? segment.startedAt : "",
                endedAt: segment.endedAt ?? null,
                breakType: segment.breakType ?? null,
                paid: segment.paid ?? null,
              })
            );
    const result = await adjustShiftForAuthenticatedUser(authUser, organizationId, shiftSessionId, {
      reason: body.reason ?? "",
      startedAt: body.startedAt ?? null,
      endedAt: body.endedAt ?? null,
      payableMinutes: body.payableMinutes ?? null,
      breakSegments: normalizedBreakSegments,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createManualShiftController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId = readRequiredOrganizationId(req.params.organizationId);
    const body = (req.body ?? {}) as ManualShiftCreateBody;
    const authUser = getAuthenticatedUser(req);
    const normalizedBreakSegments =
      body.breakSegments === undefined
        ? undefined
        : body.breakSegments === null
          ? null
          : body.breakSegments.map(
              (segment): { breakType?: string | null; endedAt?: string | null; paid?: boolean | null; startedAt: string } => ({
                startedAt: typeof segment.startedAt === "string" ? segment.startedAt : "",
                endedAt: segment.endedAt ?? null,
                breakType: segment.breakType ?? null,
                paid: segment.paid ?? null,
              })
            );
    const result = await createManualShiftForAuthenticatedUser(authUser, organizationId, {
      propertyId: body.propertyId ?? "",
      employeeId: body.employeeId ?? "",
      startedAt: body.startedAt ?? "",
      endedAt: body.endedAt ?? "",
      payableMinutes: body.payableMinutes ?? null,
      reason: body.reason ?? "",
      breakSegments: normalizedBreakSegments ?? null,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};
