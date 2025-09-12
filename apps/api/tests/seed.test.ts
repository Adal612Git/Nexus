import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "./setup";
import jwt from "jsonwebtoken";
import { CardStatus } from "@prisma/client";

const app = createApp();
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";

function bearer(userId: string) {
  const token = jwt.sign({ sub: userId }, ACCESS_SECRET, { expiresIn: 60 });
  return `Bearer ${token}`;
}

describe("demo seed data flow", () => {
  let userId = "";
  let projectId = "";

  beforeEach(async () => {
    // Ensure demo user exists (setup already seeds demo user)
    const demo = await prisma.user.findUnique({ where: { email: "demo@nexus.dev" } });
    userId = demo!.id;
    // Create Demo Project and 12 cards across 4 columns with positions 1..3
    const project = await prisma.project.create({ data: { name: "Demo Project", userId } });
    projectId = project.id;
    const statuses: CardStatus[] = ["TODO", "DOING", "DONE", "ARCHIVED"] as any;
    for (const s of statuses) {
      for (let pos = 1; pos <= 3; pos++) {
        await prisma.card.create({ data: { projectId, title: `${s} #${pos}`, status: s, position: pos } });
      }
    }
  });

  it("projects and cards distribution is correct", async () => {
    // GET /projects
    const plist = await request(app).get("/projects").set("Authorization", bearer(userId));
    expect(plist.status).toBe(200);
    const demo = plist.body.data.find((p: any) => p.name === "Demo Project");
    expect(demo).toBeTruthy();

    // GET /cards by projectId
    const clist = await request(app)
      .get(`/cards?projectId=${demo.id}`)
      .set("Authorization", bearer(userId));
    expect(clist.status).toBe(200);
    const cards = clist.body.data as any[];
    expect(cards.length).toBe(12);
    const byStatus = (st: string) => cards.filter((c) => c.status === st).sort((a, b) => a.position - b.position);
    for (const st of ["TODO", "DOING", "DONE", "ARCHIVED"]) {
      const grp = byStatus(st);
      expect(grp.length).toBe(3);
      expect(grp.map((c) => c.position)).toEqual([1, 2, 3]);
    }
  });
});

