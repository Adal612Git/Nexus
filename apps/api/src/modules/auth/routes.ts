import { Router } from "express";
import authService from "./service.js";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

// Simple in-memory rate limiter for reset request (3/hour per email/IP)
type Entry = number[]; // epoch ms
const emailBuckets = new Map<string, Entry>();
const ipBuckets = new Map<string, Entry>();
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 3;

function allowed(key: string, map: Map<string, Entry>) {
  const now = Date.now();
  const arr = map.get(key) || [];
  const recent = arr.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  map.set(key, recent);
  return true;
}

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const ip = req.ip;
  const ua = req.get("user-agent") || "";

  if (!email || !password) return res.status(400).json({ error: "Bad Request" });

  const result = await authService.login(email, password, { ip, ua });

  if (!result.ok && "locked" in result) {
    return res.status(423).json({ error: "Cuenta temporalmente bloqueada" });
  }
  if (!result.ok) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }
  return res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken });
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "Bad Request" });
  const result = await authService.refresh(refreshToken);
  if (!result.ok) return res.status(401).json({ error: "Invalid token" });
  res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken });
});

router.post("/password-reset/request", async (req, res) => {
  const { email } = req.body || {};
  const ip = req.ip || "";
  if (!email) return res.status(200).json({ message: "Si existe, te enviamos instrucciones" });

  const emailAllowed = allowed(`email:${email}`, emailBuckets);
  const ipAllowed = allowed(`ip:${ip}`, ipBuckets);
  if (!emailAllowed || !ipAllowed) {
    // Still reply generically
    return res.status(200).json({ message: "Si existe, te enviamos instrucciones" });
  }

  const { token } = await authService.requestPasswordReset(email, { ip, ua: req.get("user-agent") || "" });
  logger.info({ event: "email_send_simulated", to: email }, `Reset link: /reset-password?token=${token}`);
  res.json({ message: "Si existe, te enviamos instrucciones" });
});

router.post("/password-reset/confirm", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Bad Request" });
  }
  const result = await authService.confirmPasswordReset(token, password);
  if (!result.ok) return res.status(400).json({ error: "Enlace inválido o expirado" });
  res.json({ message: "Tu contraseña fue actualizada" });
});

export default router;
