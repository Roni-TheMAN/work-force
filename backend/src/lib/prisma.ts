import { PrismaClient } from "../../generated/prisma-rbac";

export const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 5_000,
    timeout: 30_000,
  },
});
