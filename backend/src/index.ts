import type { Server } from "node:http";

import { createApp } from "./app";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";
import { assertBillingCatalogReady } from "./services/billing-catalog.service";
import { reconcileOverdueOpenShifts } from "./services/time-tracking.service";

let server: Server | null = null;
let autoCloseInterval: NodeJS.Timeout | null = null;
let isReconcilingOpenShifts = false;

const OPEN_SHIFT_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

async function reconcileOpenShiftsForAutoClose() {
  if (isReconcilingOpenShifts) {
    return;
  }

  isReconcilingOpenShifts = true;

  try {
    await reconcileOverdueOpenShifts();
  } catch (error) {
    console.error("Failed to auto-close overdue open shifts.", error);
  } finally {
    isReconcilingOpenShifts = false;
  }
}

async function shutdown() {
  if (autoCloseInterval) {
    clearInterval(autoCloseInterval);
    autoCloseInterval = null;
  }

  await prisma.$disconnect();

  server?.close((error) => {
    if (error) {
      console.error("Failed to close backend server cleanly.", error);
      process.exit(1);
      return;
    }

    process.exit(0);
  });
}

async function start() {
  try {
    await assertBillingCatalogReady();
  } catch (error) {
    console.error("Billing catalog startup check failed.", error);
    await prisma.$disconnect();
    process.exit(1);
  }

  const app = createApp();
  server = app.listen(env.port, () => {
    console.log(`Backend running on http://localhost:${env.port}`);
  });
  void reconcileOpenShiftsForAutoClose();
  autoCloseInterval = setInterval(() => {
    void reconcileOpenShiftsForAutoClose();
  }, OPEN_SHIFT_RECONCILE_INTERVAL_MS);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

void start();
