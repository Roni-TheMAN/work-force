import { createApp } from "./app";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`Backend running on http://localhost:${env.port}`);
});

async function shutdown() {
  await prisma.$disconnect();

  server.close((error) => {
    if (error) {
      console.error("Failed to close backend server cleanly.", error);
      process.exit(1);
      return;
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
