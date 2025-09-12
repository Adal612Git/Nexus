import { describe, it, expect } from "vitest";
import { prisma } from "./setup";
import { CardStatus } from "@prisma/client";

describe("DB constraints", () => {
  it("prevents duplicate position within (projectId, status)", async () => {
    const user = await prisma.user.create({
      data: { email: "test@nexus.dev", passwordHash: "x" },
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
    ).rejects.toThrowError();
  });
});
