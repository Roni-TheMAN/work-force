import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import { getPropertyContext } from "./property.middleware";
import {
  advancePropertyPayrollPeriod,
  createPropertyEmployee,
  getPropertyDashboard,
  getPropertyAccess,
  getPropertyOverview,
  getPropertyPayrollPreview,
  getPropertyPermissionSnapshot,
  getPropertyTimeLogs,
  listPropertyEmployees,
  updatePropertyAccess,
  updatePropertySettings,
} from "./property.service";
import {
  applyPropertyScheduleTemplate,
  createPropertyScheduleTemplate,
  createPropertyShift,
  deletePropertyShift,
  getPropertyScheduleWeek,
  listPropertyScheduleTemplates,
  publishPropertySchedule,
  updatePropertyScheduleTemplate,
  deletePropertyScheduleTemplate,
  updatePropertyShift,
} from "./property-scheduling";
import {
  approvePropertyPayrollEmployee,
  exportPropertyPayrollDetailPdf,
  createPropertyPayrollRun,
  exportPropertyPayrollShiftsCsv,
  exportPropertyPayrollSummaryCsv,
  finalizePropertyPayrollRun,
  getPropertyPayrollPeriodDetail,
  listPropertyPayrollPeriods,
  reopenPropertyPayrollRun,
  resetPropertyPayrollEmployeeApproval,
} from "./property-payroll-runs";
import { reconcileOpenShiftsForProperty } from "../../services/time-tracking.service";

type CreatePropertyEmployeeRequestBody = {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  employeeCode?: string | null;
  createLoginAccount?: boolean;
  loginPassword?: string | null;
  propertyRole?: "manager" | "property_admin" | "scheduler" | "viewer" | null;
  pinMode?: "auto" | "manual" | null;
  manualPin?: string | null;
};

type UpdatePropertySettingsRequestBody = {
  name?: string;
  timezone?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  payroll?: {
    frequency?: "biweekly" | "custom_days" | "monthly" | "quarterly" | "weekly";
    anchorStartDate?: string;
    customDayInterval?: number | null;
    autoCloseAfterHours?: number | null;
  } | null;
};

type UpdatePropertyAccessRequestBody = {
  roleId?: string | null;
};

type PayrollApprovalRequestBody = {
  note?: string | null;
};

type PropertyTimeLogsQuery = {
  businessDateFrom?: string;
  businessDateTo?: string;
  employeeId?: string;
  flags?: string | string[];
  status?: string;
};

type PropertyScheduleQuery = {
  weekStartDate?: string;
};

type UpsertPropertyShiftRequestBody = {
  breakMinutes?: number;
  date?: string;
  employeeId?: string | null;
  endTime?: string;
  notes?: string | null;
  positionLabel?: string | null;
  startTime?: string;
  status?: "cancelled" | "open" | "scheduled";
};

type PublishPropertyScheduleRequestBody = {
  weekStartDate?: string | null;
};

type UpsertPropertyScheduleTemplateShiftRequestBody = {
  breakMinutes?: number;
  dayIndex?: number;
  employeeId?: string | null;
  endMinutes?: number;
  id?: string;
  isOvernight?: boolean;
  notes?: string | null;
  positionLabel?: string | null;
  startMinutes?: number;
  status?: "cancelled" | "open" | "scheduled";
};

type CreatePropertyScheduleTemplateRequestBody = {
  name?: string | null;
  slotIndex?: number;
  sourceWeekStartDate?: string | null;
};

type UpdatePropertyScheduleTemplateRequestBody = {
  name?: string | null;
  shifts?: UpsertPropertyScheduleTemplateShiftRequestBody[] | null;
  sourceWeekStartDate?: string | null;
};

type ApplyPropertyScheduleTemplateRequestBody = {
  weekStartDate?: string | null;
};

export const getPropertyDashboardController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const dashboard = await getPropertyDashboard(context);

    res.json({ dashboard });
  } catch (error) {
    next(error);
  }
};

export const getPropertyPermissionsController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const permissions = await getPropertyPermissionSnapshot(context);

    res.json({ permissions });
  } catch (error) {
    next(error);
  }
};

export const getPropertyOverviewController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const overview = await getPropertyOverview(context);

    res.json({ overview });
  } catch (error) {
    next(error);
  }
};

export const getPropertyEmployeesController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const employees = await listPropertyEmployees(context);

    res.json(employees);
  } catch (error) {
    next(error);
  }
};

export const getPropertyScheduleController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const query = req.query as PropertyScheduleQuery;
    const week = await getPropertyScheduleWeek(
      context,
      typeof query.weekStartDate === "string" ? query.weekStartDate : null
    );

    res.json({ week });
  } catch (error) {
    next(error);
  }
};

export const createPropertyShiftController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const body = (req.body ?? {}) as UpsertPropertyShiftRequestBody;
    const week = await createPropertyShift(context, body);

    res.status(201).json({ week });
  } catch (error) {
    next(error);
  }
};

export const getPropertyScheduleTemplatesController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const templates = await listPropertyScheduleTemplates(context);

    res.json(templates);
  } catch (error) {
    next(error);
  }
};

export const createPropertyScheduleTemplateController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const body = (req.body ?? {}) as CreatePropertyScheduleTemplateRequestBody;
    const templates = await createPropertyScheduleTemplate(context, body);

    res.status(201).json(templates);
  } catch (error) {
    next(error);
  }
};

export const patchPropertyScheduleTemplateController: RequestHandler = async (req, res, next) => {
  try {
    const templateId = typeof req.params.templateId === "string" ? req.params.templateId : "";
    const context = getPropertyContext(req);
    const body = (req.body ?? {}) as UpdatePropertyScheduleTemplateRequestBody;
    const templates = await updatePropertyScheduleTemplate(context, templateId, body);

    res.json(templates);
  } catch (error) {
    next(error);
  }
};

export const deletePropertyScheduleTemplateController: RequestHandler = async (req, res, next) => {
  try {
    const templateId = typeof req.params.templateId === "string" ? req.params.templateId : "";
    const context = getPropertyContext(req);
    const templates = await deletePropertyScheduleTemplate(context, templateId);

    res.json(templates);
  } catch (error) {
    next(error);
  }
};

export const applyPropertyScheduleTemplateController: RequestHandler = async (req, res, next) => {
  try {
    const templateId = typeof req.params.templateId === "string" ? req.params.templateId : "";
    const context = getPropertyContext(req);
    const body = (req.body ?? {}) as ApplyPropertyScheduleTemplateRequestBody;
    const result = await applyPropertyScheduleTemplate(context, templateId, body.weekStartDate ?? null);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const patchPropertyShiftController: RequestHandler = async (req, res, next) => {
  try {
    const shiftId = typeof req.params.shiftId === "string" ? req.params.shiftId : "";
    const context = getPropertyContext(req);
    const body = (req.body ?? {}) as UpsertPropertyShiftRequestBody;
    const week = await updatePropertyShift(context, shiftId, body);

    res.json({ week });
  } catch (error) {
    next(error);
  }
};

export const deletePropertyShiftController: RequestHandler = async (req, res, next) => {
  try {
    const shiftId = typeof req.params.shiftId === "string" ? req.params.shiftId : "";
    const context = getPropertyContext(req);
    const week = await deletePropertyShift(context, shiftId);

    res.json({ week });
  } catch (error) {
    next(error);
  }
};

export const publishPropertyScheduleController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const body = (req.body ?? {}) as PublishPropertyScheduleRequestBody;
    const week = await publishPropertySchedule(context, body.weekStartDate ?? null);

    res.json({ week });
  } catch (error) {
    next(error);
  }
};

export const getPropertyTimeLogsController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const query = req.query as PropertyTimeLogsQuery;
    const rawFlags = Array.isArray(query.flags)
      ? query.flags
      : typeof query.flags === "string"
        ? query.flags.split(",")
        : [];
    const timeLogs = await getPropertyTimeLogs(context, {
      businessDateFrom: typeof query.businessDateFrom === "string" ? query.businessDateFrom : null,
      businessDateTo: typeof query.businessDateTo === "string" ? query.businessDateTo : null,
      employeeId: typeof query.employeeId === "string" ? query.employeeId : null,
      status: typeof query.status === "string" ? query.status : null,
      flags: rawFlags,
    });

    res.json(timeLogs);
  } catch (error) {
    next(error);
  }
};

export const getPropertyPayrollPreviewController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const payrollPreview = await getPropertyPayrollPreview(context);

    res.json({ payrollPreview });
  } catch (error) {
    next(error);
  }
};

export const listPropertyPayrollPeriodsController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const periods = await listPropertyPayrollPeriods(context);

    res.json(periods);
  } catch (error) {
    next(error);
  }
};

export const getPropertyPayrollPeriodDetailController: RequestHandler = async (req, res, next) => {
  try {
    const periodId = typeof req.params.periodId === "string" ? req.params.periodId : "";
    const context = getPropertyContext(req);
    const detail = await getPropertyPayrollPeriodDetail(context, periodId);

    res.json(detail);
  } catch (error) {
    next(error);
  }
};

export const createPropertyPayrollRunController: RequestHandler = async (req, res, next) => {
  try {
    const periodId = typeof req.params.periodId === "string" ? req.params.periodId : "";
    const context = getPropertyContext(req);
    await reconcileOpenShiftsForProperty(context.property.id);
    const detail = await createPropertyPayrollRun(context, periodId);

    res.status(201).json(detail);
  } catch (error) {
    next(error);
  }
};

export const approvePropertyPayrollEmployeeController: RequestHandler = async (req, res, next) => {
  try {
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";
    const employeeId = typeof req.params.employeeId === "string" ? req.params.employeeId : "";
    const body = (req.body ?? {}) as PayrollApprovalRequestBody;
    const context = getPropertyContext(req);
    const detail = await approvePropertyPayrollEmployee(context, runId, employeeId, body.note ?? null);

    res.json(detail);
  } catch (error) {
    next(error);
  }
};

export const resetPropertyPayrollEmployeeApprovalController: RequestHandler = async (req, res, next) => {
  try {
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";
    const employeeId = typeof req.params.employeeId === "string" ? req.params.employeeId : "";
    const body = (req.body ?? {}) as PayrollApprovalRequestBody;
    const context = getPropertyContext(req);
    const detail = await resetPropertyPayrollEmployeeApproval(context, runId, employeeId, body.note ?? null);

    res.json(detail);
  } catch (error) {
    next(error);
  }
};

export const finalizePropertyPayrollRunController: RequestHandler = async (req, res, next) => {
  try {
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";
    const context = getPropertyContext(req);
    const detail = await finalizePropertyPayrollRun(context, runId);

    res.json(detail);
  } catch (error) {
    next(error);
  }
};

export const reopenPropertyPayrollRunController: RequestHandler = async (req, res, next) => {
  try {
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";
    const context = getPropertyContext(req);
    const detail = await reopenPropertyPayrollRun(context, runId);

    res.json(detail);
  } catch (error) {
    next(error);
  }
};

export const exportPropertyPayrollSummaryCsvController: RequestHandler = async (req, res, next) => {
  try {
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";
    const context = getPropertyContext(req);
    const csv = await exportPropertyPayrollSummaryCsv(context, runId);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${csv.filename}"`);
    res.status(200).send(csv.content);
  } catch (error) {
    next(error);
  }
};

export const exportPropertyPayrollShiftsCsvController: RequestHandler = async (req, res, next) => {
  try {
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";
    const context = getPropertyContext(req);
    const csv = await exportPropertyPayrollShiftsCsv(context, runId);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${csv.filename}"`);
    res.status(200).send(csv.content);
  } catch (error) {
    next(error);
  }
};

export const exportPropertyPayrollDetailPdfController: RequestHandler = async (req, res, next) => {
  try {
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";
    const context = getPropertyContext(req);
    const pdf = await exportPropertyPayrollDetailPdf(context, runId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pdf.filename}"`);
    res.status(200).send(pdf.content);
  } catch (error) {
    next(error);
  }
};

export const getPropertyAccessController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    const access = await getPropertyAccess(context);

    res.json({ access });
  } catch (error) {
    next(error);
  }
};

export const patchPropertyAccessController: RequestHandler = async (req, res, next) => {
  try {
    const userId =
      typeof req.params.userId === "string" && req.params.userId.trim().length > 0 ? req.params.userId.trim() : null;
    const body = (req.body ?? {}) as UpdatePropertyAccessRequestBody;

    if (!userId) {
      throw new HttpError(400, "userId is required.");
    }

    const context = getPropertyContext(req);
    const assignment = await updatePropertyAccess(context, {
      userId,
      roleId: body.roleId === undefined ? null : body.roleId,
    });

    if (!assignment) {
      res.status(204).send();
      return;
    }

    res.json({ assignment });
  } catch (error) {
    next(error);
  }
};

export const patchPropertySettingsController: RequestHandler = async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as UpdatePropertySettingsRequestBody;

    if (!body.name?.trim()) {
      throw new HttpError(400, "Property name is required.");
    }

    if (!body.timezone?.trim()) {
      throw new HttpError(400, "Property timezone is required.");
    }

    const context = getPropertyContext(req);
    const property = await updatePropertySettings(context, {
      name: body.name,
      timezone: body.timezone,
      addressLine1: body.addressLine1 ?? null,
      addressLine2: body.addressLine2 ?? null,
      city: body.city ?? null,
      stateRegion: body.stateRegion ?? null,
      postalCode: body.postalCode ?? null,
      countryCode: body.countryCode ?? null,
      payroll:
        body.payroll === undefined
          ? undefined
          : body.payroll === null
            ? null
            : {
                frequency: body.payroll.frequency ?? "weekly",
                anchorStartDate: body.payroll.anchorStartDate ?? "",
                customDayInterval: body.payroll.customDayInterval ?? null,
                autoCloseAfterHours: body.payroll.autoCloseAfterHours ?? null,
              },
    });

    res.json(property);
  } catch (error) {
    next(error);
  }
};

export const advancePropertyPayrollPeriodController: RequestHandler = async (req, res, next) => {
  try {
    const context = getPropertyContext(req);
    await advancePropertyPayrollPeriod(context);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const createPropertyEmployeeController: RequestHandler = async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as CreatePropertyEmployeeRequestBody;

    if (!body.firstName?.trim() || !body.lastName?.trim()) {
      throw new HttpError(400, "firstName and lastName are required.");
    }

    const context = getPropertyContext(req);
    const employee = await createPropertyEmployee(context, {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email ?? null,
      phone: body.phone ?? null,
      employeeCode: body.employeeCode ?? null,
      createLoginAccount: body.createLoginAccount ?? false,
      loginPassword: body.loginPassword ?? null,
      propertyRole: body.propertyRole ?? "viewer",
      pinMode: body.pinMode ?? "auto",
      manualPin: body.manualPin ?? null,
    });

    res.status(201).json(employee);
  } catch (error) {
    next(error);
  }
};
