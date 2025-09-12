import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "./setup";
import jwt from "jsonwebtoken";

const app = createApp();
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";

function bearer(userId: string) {
  const token = jwt.sign({ sub: userId }, ACCESS_SECRET, { expiresIn: 60 });
  return `Bearer ${token}`;
}

describe("calendar integrations", () => {
  let userId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({ data: { email: `cal-${Date.now()}@nexus.dev`, passwordHash: "x" } });
    userId = u.id;
    // ensure none exists
    await prisma.calendarIntegration.deleteMany({ where: { userId } }).catch(() => {});
  });

  it("connect -> 201 with data", async () => {
    const res = await request(app)
      .post("/integrations/calendar/connect")
      .set("Authorization", bearer(userId))
      .send({ provider: "GOOGLE", accountEmail: "user@example.com", defaultCalendarId: "cal_1", timezone: "UTC" });
    expect(res.status).toBe(201);
    expect(res.body?.data?.provider).toBe("GOOGLE");
    expect(res.body?.data?.accountEmail).toBe("user@example.com");
  });

  it("refresh -> status set to Synced", async () => {
    await prisma.calendarIntegration.create({
      data: { userId, provider: "GOOGLE", accountEmail: "a@b.com", defaultCalendarId: "c1", timezone: "UTC", status: "Pending" },
    });
    const res = await request(app).post("/integrations/calendar/refresh").set("Authorization", bearer(userId));
    expect(res.status).toBe(200);
    expect(res.body?.data?.status).toBe("Synced");
  });

  it("disconnect -> removes integration", async () => {
    await prisma.calendarIntegration.create({
      data: { userId, provider: "OUTLOOK", accountEmail: "c@d.com", defaultCalendarId: "c2", timezone: "UTC" },
    });
    const res = await request(app).delete("/integrations/calendar/disconnect").set("Authorization", bearer(userId));
    expect(res.status).toBe(204);
    const after = await prisma.calendarIntegration.findUnique({ where: { userId } });
    expect(after).toBeNull();
  });

  it("validations: bad provider/email", async () => {
    const bad1 = await request(app)
      .post("/integrations/calendar/connect")
      .set("Authorization", bearer(userId))
      .send({ provider: "BAD", accountEmail: "user@example.com", defaultCalendarId: "c", timezone: "UTC" });
    expect(bad1.status).toBe(400);

    const bad2 = await request(app)
      .post("/integrations/calendar/connect")
      .set("Authorization", bearer(userId))
      .send({ provider: "GOOGLE", accountEmail: "not-an-email", defaultCalendarId: "c", timezone: "UTC" });
    expect(bad2.status).toBe(400);
  });
});

