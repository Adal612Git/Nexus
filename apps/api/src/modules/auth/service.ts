import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import pino from "pino";

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

const ACCESS_TTL = 15 * 60; // 15m seconds
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7d seconds
const RESET_TTL = 15 * 60; // 15m seconds
const MAX_FAILED = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000;

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";
const RESET_SECRET = process.env.JWT_RESET_SECRET || "dev-reset-secret";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export class AuthService {
  async login(email: string, password: string, meta?: { ip?: string; ua?: string }) {
    const user = await prisma.user.findUnique({ where: { email } });
    const now = new Date();

    const fail = async () => {
      if (user) {
        const nextFailed = (user.failedAttempts ?? 0) + 1;
        if (nextFailed >= MAX_FAILED) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS) },
          });
        } else {
          await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: nextFailed } });
        }
      }

      logger.warn({ event: "auth_login_failed", ip: meta?.ip, ua: meta?.ua }, "Login failed");
      return { ok: false as const };
    };

    // Never reveal if user exists
    if (!user) return fail();

    if (user.lockedUntil && user.lockedUntil > now) {
      return { ok: false as const, locked: true };
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return fail();

    // reset failed and locked
    await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });

    // rotate: delete existing refresh tokens for this user
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    const accessToken = jwt.sign({ sub: user.id }, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
    const refreshToken = jwt.sign({ sub: user.id, type: "refresh" }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
      },
    });

    logger.info({ event: "auth_login_success", ip: meta?.ip, ua: meta?.ua }, "Login success");
    return { ok: true as const, accessToken, refreshToken, userId: user.id };
  }

  async refresh(oldRefreshToken: string) {
    try {
      const payload = jwt.verify(oldRefreshToken, REFRESH_SECRET) as { sub?: string; type?: string };
      if (payload?.type !== "refresh") throw new Error("invalid");
      const userId = String(payload.sub || "");
      const tokenHash = sha256(oldRefreshToken);

      const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (!record || record.userId !== userId || (record.expiresAt && record.expiresAt < new Date())) {
        return { ok: false as const };
      }

      // rotate: remove old token
      await prisma.refreshToken.delete({ where: { tokenHash } });

      const accessToken = jwt.sign({ sub: userId }, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
      const refreshToken = jwt.sign({ sub: userId, type: "refresh" }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
      await prisma.refreshToken.create({
        data: {
          userId,
          tokenHash: sha256(refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
        },
      });

      return { ok: true as const, accessToken, refreshToken };
    } catch {
      return { ok: false as const };
    }
  }

  async requestPasswordReset(email: string, meta?: { ip?: string; ua?: string }) {
    const token = jwt.sign({ email, type: "reset" }, RESET_SECRET, { expiresIn: RESET_TTL });
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + RESET_TTL * 1000);

    // Save regardless of whether user exists or not? We'll only log if exists,
    // but to avoid leaking, we create record with email provided.
    await prisma.passwordReset.create({ data: { email, tokenHash, expiresAt } });
    logger.info({ event: "password_reset_request", ip: meta?.ip, ua: meta?.ua }, `Password reset requested for ${email}`);
    return { token };
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    let payload: { email?: string; type?: string };
    try {
      payload = jwt.verify(token, RESET_SECRET) as { email?: string; type?: string };
      if (payload?.type !== "reset") throw new Error("invalid");
    } catch {
      return { ok: false as const, reason: "invalid" };
    }
    const tokenHash = sha256(token);
    const record = await prisma.passwordReset.findUnique({ where: { tokenHash } });
    if (!record || record.used || record.expiresAt < new Date()) {
      return { ok: false as const, reason: "invalid" };
    }

    const user = await prisma.user.findUnique({ where: { email: record.email } });
    if (!user) {
      // Mark as used anyway
      await prisma.passwordReset.update({ where: { tokenHash }, data: { used: true, usedAt: new Date() } });
      return { ok: false as const, reason: "invalid" };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordReset.update({ where: { tokenHash }, data: { used: true, usedAt: new Date() } }),
    ]);

    logger.info({ event: "password_reset_confirmed" }, `Password updated for ${record.email}`);
    return { ok: true as const };
  }
}

export default new AuthService();
