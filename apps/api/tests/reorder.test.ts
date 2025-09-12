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

describe.skip("cards reorder", () => {
  let userId = "";
  let projectId = "";
  let ids: string[] = [];
  let versions: string[] = [];

  beforeEach(async () => {
    const u = await prisma.user.create({ data: { email: `rtest-${Date.now()}@nexus.dev`, passwordHash: "x" } });
    userId = u.id;
    const p = await prisma.project.create({ data: { name: "P", userId } });
    projectId = p.id;
    const c1 = await prisma.card.create({ data: { projectId, title: "A", status: "TODO", position: 1 } });
    const c2 = await prisma.card.create({ data: { projectId, title: "B", status: "TODO", position: 2 } });
    const c3 = await prisma.card.create({ data: { projectId, title: "C", status: "TODO", position: 3 } });
    ids = [c1.id, c2.id, c3.id];
    versions = [c1.updatedAt.toISOString(), c2.updatedAt.toISOString(), c3.updatedAt.toISOString()];
  });

  it("reorders successfully", async () => {
    const moves = [
      { id: ids[0], status: "DOING", position: 1, version: versions[0] },
      { id: ids[1], status: "TODO", position: 1, version: versions[1] },
      { id: ids[2], status: "TODO", position: 2, version: versions[2] },
    ];
    const res = await request(app).patch("/cards/reorder").set("Authorization", bearer(userId)).send({ moves });
    expect(res.status).toBe(200);
    const todo = res.body.data.filter((c: any) => c.status === "TODO");
    expect(todo.map((c: any) => c.title)).toEqual(["B", "C"]);
    const doing = res.body.data.filter((c: any) => c.status === "DOING");
    expect(doing.map((c: any) => c.title)).toEqual(["A"]);
  });

  it("conflict 409 when version mismatch", async () => {
    // Update one card to change updatedAt
    await prisma.card.update({ where: { id: ids[0] }, data: { title: "A1" } });
    const moves = [{ id: ids[0], status: "DOING", position: 1, version: versions[0] }];
    const res = await request(app).patch("/cards/reorder").set("Authorization", bearer(userId)).send({ moves });
    expect(res.status).toBe(409);
  });
});
