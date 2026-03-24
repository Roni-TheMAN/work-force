import type { RequestHandler } from "express";

export const getPublicHealthController: RequestHandler = (_req, res) => {
  res.json({ status: "ok" });
};
