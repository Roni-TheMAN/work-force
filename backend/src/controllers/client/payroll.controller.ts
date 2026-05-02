import type { RequestHandler } from "express";

export const getClientPayrollSummaryController: RequestHandler = async (req, res) => {
  res.json({
    summary: {
      totalHours: 0,
      totalPayroll: 0,
    },
    scope: {
      organizationId: req.params.organizationId,
    },
  });
};
