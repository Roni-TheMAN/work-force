import { prisma } from "../src/lib/prisma";
import { DEFAULT_ROLES } from "../src/lib/defaultRoles";
import { listBillingAddons, listBillingPlans } from "../src/services/billing-catalog.service";
import { seedBillingCatalog } from "../src/services/billing-seed.service";

async function main(): Promise<void> {
  await seedBillingCatalog();

  const [plans, addons] = await Promise.all([listBillingPlans(), listBillingAddons()]);

  console.log("Essential seed complete.");
  console.log("");
  console.log("Seeded:");
  console.log("- Billing catalog");
  console.log("");
  console.log("Plans:");

  for (const plan of plans) {
    console.log(
      `- ${plan.name} [${plan.code}] ${plan.unitAmountCents === null ? "n/a" : `$${(plan.unitAmountCents / 100).toFixed(2)}`}`
    );
  }

  console.log("");
  console.log("Add-ons:");

  for (const addon of addons) {
    console.log(
      `- ${addon.name} [${addon.code}] ${addon.unitAmountCents === null ? "n/a" : `$${(addon.unitAmountCents / 100).toFixed(2)}`}`
    );
  }

  console.log("");
  console.log("Default role templates:");

  for (const role of DEFAULT_ROLES) {
    console.log(`- ${role.name}`);
  }

  console.log("");
  console.log("Note: roles are organization-scoped and are created automatically when an organization is created.");
  console.log("No users, organizations, memberships, properties, or test data were seeded.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
