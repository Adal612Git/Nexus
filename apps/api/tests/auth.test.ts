import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "./setup";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

const app = createApp();

async function setupUser(password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email: "test@nexus.dev", passwordHash } });
  return user;
}

describe("auth flows", () => {
  it("login exitoso → 200 + tokens", async () => {
    await setupUser("secret123");
    const res = await request(app).post("/auth/login").send({ email: "test@nexus.dev", password: "secret123" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("credenciales inválidas → 401 + failedAttempts++", async () => {
    const user = await setupUser("secret123");
    const res = await request(app).post("/auth/login").send({ email: "test@nexus.dev", password: "badpass" });
    expect(res.status).toBe(401);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.failedAttempts).toBe(1);
  });

  it("bloqueo tras N intentos → 423", async () => {
    await setupUser("secret123");
    for (let i = 0; i < 5; i++) {
      await request(app).post("/auth/login").send({ email: "test@nexus.dev", password: "badpass" });
    }
    const res = await request(app).post("/auth/login").send({ email: "test@nexus.dev", password: "secret123" });
    expect(res.status).toBe(423);
    expect(res.body.error).toContain("bloqueada");
  });

  it("reset password → request → confirm → login con nueva contraseña funciona", async () => {
    await setupUser("oldpassword");
    const reqRes = await request(app).post("/auth/password-reset/request").send({ email: "test@nexus.dev" });
    expect(reqRes.status).toBe(200);

    // Create a valid reset token and record (simulating email link)
    const RESET_SECRET = process.env.JWT_RESET_SECRET || "dev-reset-secret";
    const token = jwt.sign({ email: "test@nexus.dev", type: "reset" }, RESET_SECRET, { expiresIn: 60 });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.passwordReset.create({ data: { email: "test@nexus.dev", tokenHash, expiresAt: new Date(Date.now() + 60 * 1000) } });

    const confirmRes = await request(app).post("/auth/password-reset/confirm").send({ token, password: "newpassword" });
    expect(confirmRes.status).toBe(200);

    // Can login with new password
    const loginRes = await request(app).post("/auth/login").send({ email: "test@nexus.dev", password: "newpassword" });
    expect(loginRes.status).toBe(200);
  });

  it("token expirado/ya usado → 400", async () => {
    await setupUser("secret123");
    const RESET_SECRET = process.env.JWT_RESET_SECRET || "dev-reset-secret";
    const token = jwt.sign({ email: "test@nexus.dev", type: "reset" }, RESET_SECRET, { expiresIn: 1 });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.passwordReset.create({ data: { email: "test@nexus.dev", tokenHash, expiresAt: new Date(Date.now() - 1000) } });
    const expired = await request(app).post("/auth/password-reset/confirm").send({ token, password: "whatever123" });
    expect(expired.status).toBe(400);

    // Create valid and mark used
    const token2 = jwt.sign({ email: "test@nexus.dev", type: "reset" }, RESET_SECRET, { expiresIn: 60 });
    const token2Hash = crypto.createHash("sha256").update(token2).digest("hex");
    await prisma.passwordReset.create({ data: { email: "test@nexus.dev", tokenHash: token2Hash, expiresAt: new Date(Date.now() + 60000), used: true } });
    const used = await request(app).post("/auth/password-reset/confirm").send({ token: token2, password: "whatever123" });
    expect(used.status).toBe(400);
  });
});
