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

describe("projects/cards ownership", () => {
  let userId = "";
  beforeEach(async () => {
    const u = await prisma.user.findUnique({ where: { email: "demo@nexus.dev" } });
    userId = u!.id;
  });

  it("CRUD project and cards with ownership", async () => {
    // create project
    const pRes = await request(app).post("/projects").set("Authorization", bearer(userId)).send({ name: "P1" });
    expect(pRes.status).toBe(201);
    const projectId = pRes.body.data.id as string;

    // list projects
    const list = await request(app).get("/projects").set("Authorization", bearer(userId));
    expect(list.status).toBe(200);
    expect(list.body.data.some((p: any) => p.id === projectId)).toBe(true);

    // create cards
    const c1 = await request(app)
      .post("/cards")
      .set("Authorization", bearer(userId))
      .send({ projectId, title: "A", status: "TODO", position: 1 });
    expect(c1.status).toBe(201);

    const c2 = await request(app)
      .post("/cards")
      .set("Authorization", bearer(userId))
      .send({ projectId, title: "B", status: "TODO", position: 2 });
    expect(c2.status).toBe(201);

    // read by project
    const byProject = await request(app)
      .get(`/cards?projectId=${projectId}`)
      .set("Authorization", bearer(userId));
    expect(byProject.status).toBe(200);
    expect(byProject.body.data).toHaveLength(2);

    // update card
    const cardId = c1.body.data.id as string;
    const upd = await request(app)
      .put(`/cards/${cardId}`)
      .set("Authorization", bearer(userId))
      .send({ status: "DOING", position: 1, title: "A1" });
    expect(upd.status).toBe(200);
    expect(upd.body.data.status).toBe("DOING");

    // archive
    const arch = await request(app)
      .patch(`/cards/${cardId}/archive`)
      .set("Authorization", bearer(userId));
    expect(arch.status).toBe(200);
    expect(arch.body.data.status).toBe("ARCHIVED");

    // delete project
    const del = await request(app)
      .delete(`/projects/${projectId}`)
      .set("Authorization", bearer(userId));
    expect(del.status).toBe(200);
  });
});

