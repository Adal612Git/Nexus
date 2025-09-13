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

describe("dashboard metrics", () => {
  let userId = "";
  let projectId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({ data: { email: `dash-${Date.now()}@nexus.dev`, passwordHash: "x" } });
    userId = u.id;
    const p = await prisma.project.create({ data: { name: "P", userId } });
    projectId = p.id;
    // Create cards across statuses
    const statuses = ["TODO", "DOING", "DONE", "ARCHIVED"] as const;
    let pos = 1;
    for (const st of statuses) {
      for (let i = 0; i < 2; i++) {
        await prisma.card.create({ data: { title: `${st}-${i+1}`, position: pos++, status: st, projectId } });
      }
    }
  });

  it("returns KPIs mock and counts; upcoming empty without integration", async () => {
    const res = await request(app).get("/dashboard/metrics").set("Authorization", bearer(userId));
    expect(res.status).toBe(200);
    expect(res.body?.data?.kpis?.income).toBe(1200);
    // totals sum equals number of cards
    const totals = res.body?.data?.totals;
    expect(totals.TODO + totals.DOING + totals.DONE + totals.ARCHIVED).toBe(8);
    // upcoming empty
    expect(Array.isArray(res.body?.data?.upcoming)).toBe(true);
    expect(res.body?.data?.upcoming.length).toBe(0);
  });

  it("returns upcoming when integration and events present", async () => {
    await prisma.calendarIntegration.create({
      data: { userId, provider: "GOOGLE", accountEmail: "x@y.com", defaultCalendarId: "primary", timezone: "UTC" },
    });
    const c = await prisma.card.findFirst({ where: { projectId } });
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await prisma.calendarEvent.create({
      data: {
        cardId: c!.id,
        startUtc: soon,
        endUtc: new Date(soon.getTime() + 3600000),
        allDay: false,
        status: "Synced",
      },
    });
    const res = await request(app).get("/dashboard/metrics").set("Authorization", bearer(userId));
    expect(res.status).toBe(200);
    expect(res.body?.data?.upcoming.length).toBeGreaterThan(0);
  });
});

