import { prisma } from "../src/lib/prisma";
import { listBillingPlans } from "../src/services/billing-catalog.service";
import { seedBillingCatalog } from "../src/services/billing-seed.service";

async function main(): Promise<void> {
  await seedBillingCatalog();

  const plans = await listBillingPlans();

  console.log("Billing catalog seeded.");
  console.log("");
  console.log("Plans:");

  for (const plan of plans) {
    console.log(
      `- ${plan.code} (${plan.kind}) stripe_product=${plan.stripeProductId} stripe_price=${plan.stripePriceId ?? "n/a"}`
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
