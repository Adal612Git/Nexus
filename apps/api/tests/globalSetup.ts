import { execSync } from "node:child_process";

export default async function () {
  if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";
  if (process.env.NODE_ENV === "test" && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "file:./test.db";
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

