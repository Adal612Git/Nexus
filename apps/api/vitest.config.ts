import { defineConfig } from "vitest/config";

// Ensure test env defaults
if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";

// Default DATABASE_URL for tests (SQLite in repo)
if (process.env.NODE_ENV === "test" && !process.env.DATABASE_URL) {
  // prisma will resolve relative to the schema location; using ./prisma/test.db
  process.env.DATABASE_URL = "file:./test.db";
}

export default defineConfig({
  test: {
    globals: true,
    threads: false,
    fileParallelism: false,
    sequence: { concurrent: false },
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Ensure we migrate before tests
    globalSetup: ["./tests/globalSetup.ts"],
  },
});
