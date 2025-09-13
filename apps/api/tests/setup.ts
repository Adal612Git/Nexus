import { beforeAll, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

export const prisma = new PrismaClient();

function ensureEnv() {
  if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";
  if (process.env.NODE_ENV === "test" && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "file:./test.db";
  }
}

function migrate() {
  ensureEnv();
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

function generateClient() {
  ensureEnv();
  try {
    execSync("pnpm --filter @nexus/api exec prisma generate", { stdio: "inherit" });
  } catch {
    try {
      execSync("npx prisma generate", { stdio: "inherit" });
    } catch {}
  }
}

async function truncateAll() {
  await prisma.$transaction([
    prisma.calendarEvent.deleteMany({}),
    prisma.card.deleteMany({}),
    prisma.refreshToken.deleteMany({}),
    prisma.passwordReset.deleteMany({}),
    prisma.project.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
}

beforeAll(async () => {
  ensureEnv();
  generateClient();
  migrate();
  await prisma.$connect();
});

beforeEach(async () => {
  await truncateAll();
  // Minimal seed for reproducibility
  const { seedBasic } = await import("./helpers/seed");
  await seedBasic(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});
