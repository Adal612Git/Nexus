import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import authRouter from "./modules/auth/routes.js";
import boardsRouter from "./routes/boards.js";
import projectsRouter from "./modules/projects/routes.js";
import cardsRouter from "./modules/cards/routes.js";
import integrationsRouter from "./modules/calendar/routes.js";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "api", ts: new Date().toISOString() });
  });

  app.use("/auth", authRouter);
  app.use("/boards", boardsRouter);
  app.use("/projects", projectsRouter);
  app.use("/cards", cardsRouter);
  app.use("/integrations", integrationsRouter);

  return app;
}

export default createApp;
