import cors from "cors";
import express from "express";
import path from "node:path";

import { env } from "./lib/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { adminRouter } from "./routes/admin";
import { clientRouter } from "./routes/client";
import { publicStripeWebhookRouter } from "./routes/public/billing.routes";
import { publicRouter } from "./routes/public";
import { clientDocumentRouter } from "./modules/documents/document.routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientWebUrl,
    })
  );
  app.use("/api/public", publicStripeWebhookRouter);
  app.use("/uploads/documents", express.static(path.join(process.cwd(), "uploads", "documents")));
  app.use(express.json());
  app.use("/api/public", publicRouter);
  app.use("/api", clientDocumentRouter);
  app.use("/api/client", clientRouter);
  app.use("/api/admin", adminRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
