import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import type { IncomingHttpHeaders } from "http";
import { addLog as probeAddLog } from "./observability/logProbe.js";
import authRouter from "./modules/auth/routes.js";
import boardsRouter from "./routes/boards.js";
import projectsRouter from "./modules/projects/routes.js";
import cardsRouter from "./modules/cards/routes.js";
import integrationsRouter from "./modules/calendar/routes.js";
import dashboardRouter from "./modules/dashboard/routes.js";

// Pino logger with basic redaction (avoid PII)
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.email",
      "password",
      "email",
    ],
    remove: true,
  },
});

// Simple unique request id generator
let REQ_SEQ = 0;
function genReqId() {
  REQ_SEQ = (REQ_SEQ + 1) % 1_000_000_000;
  return `req-${Date.now()}-${REQ_SEQ}`;
}

// Security headers (helmet-like minimal)
function securityHeaders(_req: any, res: any, next: any) {
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "0");
  next();
}

// Basic CORS from env CORS_ORIGINS (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",").map((s) => s.trim());
function corsMiddleware(req: any, res: any, next: any) {
  const origin = (req.headers as IncomingHttpHeaders)["origin"] as string | undefined;
  if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
}

// Simple metrics for selected routes
function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  res.on("finish", () => {
    const rt = Date.now() - start;
    const path = req.path || req.url;
    if (
      path.endsWith("/auth/login") ||
      path.endsWith("/login") ||
      path.includes("/sync") ||
      path.includes("/integrations/calendar/refresh")
    ) {
      // Normalize route for consistency in tests/logs
      const routeName = path.endsWith("/login") ? "/auth/login" : path;
      const entry = {
        event: "http_metrics",
        route: routeName,
        method: req.method,
        statusCode: res.statusCode,
        responseTime: rt,
        requestId: req.id,
      };
      req.log.info(entry);
      // Push to in-memory probe for tests
      try { probeAddLog(entry); } catch {}
    }
  });
  next();
}

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId,
      autoLogging: true,
      serializers: {
        // Avoid logging full headers/body
        req(req) {
          return { id: (req as any).id, method: req.method, url: req.url };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    })
  );
  app.use(metricsMiddleware);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "api", ts: new Date().toISOString() });
  });

  app.use("/auth", authRouter);
  app.use("/boards", boardsRouter);
  app.use("/projects", projectsRouter);
  app.use("/cards", cardsRouter);
  app.use("/integrations", integrationsRouter);
  app.use("/dashboard", dashboardRouter);

  // Uniform error handler: Zod errors → 422
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err?.name === "ZodError" || err?._errors || err?.issues) {
      return res.status(422).json({ success: false, error: "ValidationError", details: err?.issues || err });
    }
    return res.status(500).json({ success: false, error: "ServerError" });
  });

  return app;
}

export default createApp;
