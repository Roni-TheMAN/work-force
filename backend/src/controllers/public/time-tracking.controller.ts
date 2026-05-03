import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import {
  completeQrPropertyDevicePairing,
  getDeviceContextByToken,
  getDeviceScheduleWeek,
  recordDevicePunch,
  syncDeviceClockEvents,
  verifyEmployeePinForDevice,
} from "../../services/time-tracking.service";

type DevicePunchRequestBody = {
  breakType?: string | null;
  employeeCode?: string | null;
  employeeId?: string | null;
  note?: string | null;
  occurredAt?: string | null;
  paid?: boolean | null;
  photoUrl?: string | null;
};

type VerifyEmployeePinRequestBody = {
  pin?: string | null;
};

type CompleteQrPairingRequestBody = {
  deviceName?: string | null;
  deviceType?: string | null;
  token?: string | null;
};

type SyncClockEventsRequestBody = {
  events?: Array<{
    clientEventId?: string | null;
    employeeId?: string | null;
    type?: string | null;
    deviceTimestamp?: string | null;
    source?: string | null;
    photo?: {
      localPath?: string | null;
    } | null;
  }>;
  kioskDeviceId?: string | null;
  propertyId?: string | null;
};

function readDeviceToken(req: Parameters<RequestHandler>[0]): string {
  const authorizationHeader = req.headers.authorization;

  if (authorizationHeader) {
    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme === "Bearer" && token?.trim()) {
      return token.trim();
    }
  }

  const headerToken = req.headers["x-device-token"];

  if (typeof headerToken === "string" && headerToken.trim().length > 0) {
    return headerToken.trim();
  }

  throw new HttpError(401, "Device token is required.");
}

export const getPublicDeviceContextController: RequestHandler = async (req, res, next) => {
  try {
    const device = await getDeviceContextByToken(readDeviceToken(req));
    res.json({ device });
  } catch (error) {
    next(error);
  }
};

export const recordPublicDevicePunchController: RequestHandler = async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as DevicePunchRequestBody;
    const punchType = typeof req.params.punchType === "string" ? req.params.punchType : "";
    const result = await recordDevicePunch(readDeviceToken(req), punchType, {
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

export const syncPublicDeviceClockEventsController: RequestHandler = async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as SyncClockEventsRequestBody;
    const result = await syncDeviceClockEvents(readDeviceToken(req), {
      kioskDeviceId: body.kioskDeviceId ?? null,
      propertyId: body.propertyId ?? null,
      events: body.events ?? [],
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const verifyPublicDevicePinController: RequestHandler = async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as VerifyEmployeePinRequestBody;
    const result = await verifyEmployeePinForDevice(readDeviceToken(req), {
      pin: body.pin ?? "",
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPublicDeviceScheduleWeekController: RequestHandler = async (req, res, next) => {
  try {
    const rawWeekStartDate = req.query.weekStartDate;
    const weekStartDate =
      typeof rawWeekStartDate === "string" && rawWeekStartDate.trim().length > 0
        ? rawWeekStartDate.trim()
        : null;
    const week = await getDeviceScheduleWeek(readDeviceToken(req), {
      weekStartDate,
    });

    res.json({ week });
  } catch (error) {
    next(error);
  }
};

export const completePublicQrPairingController: RequestHandler = async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as CompleteQrPairingRequestBody;
    const result = await completeQrPropertyDevicePairing({
      token: body.token ?? "",
      deviceName: body.deviceName ?? "",
      deviceType: body.deviceType ?? "kiosk",
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};
