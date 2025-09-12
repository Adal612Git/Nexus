import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function seedBasic(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.create({
    data: { email: "demo@nexus.dev", passwordHash },
  });
}

