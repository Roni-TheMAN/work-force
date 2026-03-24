import cors from "cors";
import express from "express";

import { env } from "./lib/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { adminRouter } from "./routes/admin";
import { clientRouter } from "./routes/client";
import { publicRouter } from "./routes/public";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientWebUrl,
    })
  );
  app.use(express.json());
  app.use("/api/public", publicRouter);
  app.use("/api/client", clientRouter);
  app.use("/api/admin", adminRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
