import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import jwt from "jsonwebtoken";

describe("observability & security", () => {
  let app: any;
  beforeAll(() => {
    app = createApp();
  });

  it("applies security headers (helmet-like)", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-dns-prefetch-control"]).toBeDefined();
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("CORS allows configured origin and blocks others", async () => {
    const expectedOrigin = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",")[0];
    const ok = await request(app).options("/health").set("Origin", expectedOrigin);
    expect(ok.headers["access-control-allow-origin"]).toBe(expectedOrigin);
    const bad = await request(app).options("/health").set("Origin", "http://blocked.test");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("validation errors return 422 consistently", async () => {
    // invalid provider should trigger ZodError → 422
    const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
    const token = jwt.sign({ sub: "test-user" }, ACCESS_SECRET, { expiresIn: 60 });
    const res = await request(app)
      .post("/integrations/calendar/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ provider: "BAD", accountEmail: "not-an-email", defaultCalendarId: "", timezone: "" });
    expect(res.status).toBe(422);
  });

  it("sanitizes logs (no PII) and includes responseTime for /login", async () => {
    const { clearLogs, getLogs } = await import("../src/observability/logProbe.js");
    clearLogs();
    await request(app).post("/auth/login").send({ email: "demo@nexus.dev", password: "password123" });
    await new Promise((r) => setTimeout(r, 50));
    const logs = getLogs();
    const asText = JSON.stringify(logs);
    expect(asText.includes("demo@nexus.dev")).toBe(false);
    expect(asText.includes("password123")).toBe(false);
    expect(logs.some((l: any) => l.route === "/auth/login" && typeof l.responseTime === "number")).toBe(true);
  });
});
