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

describe("cards dev bypass create", () => {
  let userId = "";
  let projectId = "";

  beforeEach(async () => {
    // Force dev mode for this suite
    process.env.NODE_ENV = "development";
    const demo = await prisma.user.findUnique({ where: { email: "demo@nexus.dev" } });
    userId = demo!.id;
    const project = await prisma.project.create({ data: { name: "Bypass Project", userId } });
    projectId = project.id;
  });

  it("creates without token in development", async () => {
    const res = await request(app)
      .post("/cards")
      .send({ projectId, title: "DevCreate", status: "TODO", position: 1 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("DevCreate");
  });

  it("creates with valid token and ownership", async () => {
    const res = await request(app)
      .post("/cards")
      .set("Authorization", bearer(userId))
      .send({ projectId, title: "AuthCreate", status: "TODO", position: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("AuthCreate");
  });

  it("401 with invalid token", async () => {
    const res = await request(app)
      .post("/cards")
      .set("Authorization", "Bearer invalid")
      .send({ projectId, title: "Bad", status: "TODO", position: 3 });
    expect(res.status).toBe(401);
  });
});

