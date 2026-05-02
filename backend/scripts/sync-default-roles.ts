import { prisma } from "../src/lib/prisma";
import { seedRolesForOrganization } from "../src/services/seedRoles";

async function main() {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (organizations.length === 0) {
    console.log("No organizations found. Nothing to sync.");
    return;
  }

  for (const organization of organizations) {
    await seedRolesForOrganization(organization.id);
    console.log(`Synced default roles for ${organization.name} (${organization.slug}).`);
  }

  console.log(`Completed role sync for ${organizations.length} organization(s).`);
}

main()
  .catch((error) => {
    console.error("Default role sync failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
