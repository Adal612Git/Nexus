import { Router } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import auth from "../auth/middleware.js";

const prisma = new PrismaClient();
const router = Router();

const createProjectSchema = z.object({ name: z.string().min(1).max(200) });
const idParamSchema = z.object({ id: z.string().min(1) });

router.use(auth);

router.get("/", async (req, res) => {
  const ownerId = (req as unknown as { userId?: string }).userId;
  const projects = await prisma.project.findMany({ where: { userId: ownerId }, orderBy: { createdAt: "asc" } });
  return res.json({ success: true, data: projects });
});

router.post("/", async (req, res) => {
  const ownerId = (req as unknown as { userId?: string }).userId;
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
  const project = await prisma.project.create({ data: { name: parsed.data.name, userId: ownerId! } });
  return res.status(201).json({ success: true, data: project });
});

router.delete("/:id", async (req, res) => {
  const ownerId = (req as unknown as { userId?: string }).userId;
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
  const proj = await prisma.project.findUnique({ where: { id: parsed.data.id } });
  if (!proj || proj.userId !== ownerId) return res.status(404).json({ success: false, error: "Not found" });
  // delete cards first to avoid FK constraints
  await prisma.card.deleteMany({ where: { projectId: proj.id } });
  await prisma.project.delete({ where: { id: proj.id } });
  return res.json({ success: true });
});

export default router;

