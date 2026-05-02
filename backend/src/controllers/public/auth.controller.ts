import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Email is required.");
  }

  const normalizedEmail = value.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new HttpError(400, "Email is required.");
  }

  return normalizedEmail;
}

export const checkPublicEmailExistsController: RequestHandler = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

    res.json({ exists: Boolean(user) });
  } catch (error) {
    next(error);
  }
};
