import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { PrismaClient, CardStatus } from "@prisma/client";

const prisma = new PrismaClient();

describe("DB constraints", () => {
  beforeAll(async () => {
    // Ensure connection is valid
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean tables between tests
    await prisma.calendarEvent.deleteMany({});
    await prisma.card.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it("prevents duplicate position within (projectId, status)", async () => {
    const user = await prisma.user.create({
      data: { email: "test@nexus.dev" },
    });
    const project = await prisma.project.create({
      data: { name: "Test Project", userId: user.id },
    });

    await prisma.card.create({
      data: {
        title: "Card 1",
        position: 1,
        status: CardStatus.TODO,
        projectId: project.id,
      },
    });

    await expect(
      prisma.card.create({
        data: {
          title: "Card 2",
          position: 1, // duplicate position in same (projectId, status)
          status: CardStatus.TODO,
          projectId: project.id,
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

