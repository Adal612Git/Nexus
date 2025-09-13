import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data for idempotent seeds (safe for SQLite demo)
  await prisma.calendarEvent.deleteMany({});
  await prisma.card.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.passwordReset.deleteMany({});
  await prisma.user.deleteMany({ where: { email: "demo@nexus.dev" } });

  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.create({
    data: {
      email: "demo@nexus.dev",
      name: "Demo User",
      passwordHash,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Demo Project",
      userId: user.id,
    },
  });

  // Create 12 cards: 3 for each status
  const statuses: string[] = [
    "TODO",
    "DOING",
    "DONE",
    "ARCHIVED",
  ];

  for (const status of statuses) {
    for (let pos = 1; pos <= 3; pos++) {
      await prisma.card.create({
        data: {
          title: `${status} #${pos}`,
          position: pos,
          status,
          projectId: project.id,
        },
      });
    }
  }

  console.log("Seed complete: user, project, 12 cards");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
