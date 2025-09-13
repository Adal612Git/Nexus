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

describe("calendar events endpoint", () => {
  let userId = "";
  let projectId = "";
  let cardId = "";

  beforeEach(async () => {
    const u = await prisma.user.create({ data: { email: `calv-${Date.now()}@nexus.dev`, passwordHash: "x" } });
    userId = u.id;
    const p = await prisma.project.create({ data: { name: "P", userId } });
    projectId = p.id;
    const c = await prisma.card.create({ data: { title: "Card A", status: "TODO", position: 1, projectId } });
    cardId = c.id;
    await prisma.calendarIntegration.create({
      data: { userId, provider: "GOOGLE", accountEmail: "x@y.com", defaultCalendarId: "primary", timezone: "America/Mexico_City" },
    });
    // Set due date via DB for simplicity
    await prisma.calendarEvent.create({
      data: {
        cardId,
        startUtc: new Date("2025-09-20T15:00:00Z"),
        endUtc: new Date("2025-09-20T16:00:00Z"),
        allDay: false,
        status: "Synced",
      },
    });
  });

  it("fetch events within range and map to user TZ", async () => {
    const res = await request(app)
      .get("/integrations/calendar/events")
      .set("Authorization", bearer(userId))
      .query({ from: "2025-09-20T00:00:00Z", to: "2025-09-21T00:00:00Z" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const ev = res.body.data[0];
    expect(ev.cardId).toBe(cardId);
    expect(ev.boardId).toBe(projectId);
    expect(ev.title).toBe("Card A");
    // Expect offset with -06:00 or -05:00 depending on DST rules; assert it has a timezone offset
    expect(/T\d{2}:\d{2}:\d{2}[\+\-]\d{2}:\d{2}$/.test(ev.start)).toBe(true);
  });

  it("filters by board and status", async () => {
    const res = await request(app)
      .get("/integrations/calendar/events")
      .set("Authorization", bearer(userId))
      .query({ from: "2025-09-20T00:00:00Z", to: "2025-09-21T00:00:00Z", boardId: projectId, status: "TODO" });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].status).toBe("TODO");
  });
});

