import { Router } from "express";
import { z } from "zod";
import { PrismaClient, CardStatus } from "@prisma/client";
import auth from "../auth/middleware.js";

const prisma = new PrismaClient();
const router = Router();

const createCardSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(300),
  status: z.nativeEnum(CardStatus),
  position: z.number().int().nonnegative(),
});

const updateCardSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  status: z.nativeEnum(CardStatus).optional(),
  position: z.number().int().nonnegative().optional(),
});

const idParam = z.object({ id: z.string().min(1) });

router.use(auth);

// Read by projectId
router.get("/", async (req, res) => {
  const ownerId = (req as unknown as { userId?: string }).userId;
  const projectId = z.string().min(1).safeParse(req.query.projectId);
  if (!projectId.success) return res.status(400).json({ success: false, error: "projectId required" });
  const project = await prisma.project.findUnique({ where: { id: projectId.data } });
  if (!project || project.userId !== ownerId) return res.status(404).json({ success: false, error: "Not found" });
  const cards = await prisma.card.findMany({ where: { projectId: project.id }, orderBy: [{ status: "asc" }, { position: "asc" }] });
  return res.json({ success: true, data: cards });
});

router.post("/", async (req, res) => {
  const ownerId = (req as unknown as { userId?: string }).userId;
  const parsed = createCardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
  const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
  if (!project || project.userId !== ownerId) return res.status(404).json({ success: false, error: "Not found" });
  try {
    const card = await prisma.card.create({ data: parsed.data });
    return res.status(201).json({ success: true, data: card });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.code || "Create failed" });
  }
});

router.put("/:id", async (req, res) => {
  const ownerId = (req as unknown as { userId?: string }).userId;
  const pid = idParam.safeParse(req.params);
  if (!pid.success) return res.status(400).json({ success: false, error: pid.error.flatten() });
  const body = updateCardSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, error: body.error.flatten() });
  const card = await prisma.card.findUnique({ where: { id: pid.data.id }, include: { project: true } });
  if (!card || card.project.userId !== ownerId) return res.status(404).json({ success: false, error: "Not found" });
  try {
    const updated = await prisma.card.update({ where: { id: card.id }, data: body.data });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.code || "Update failed" });
  }
});

router.patch("/:id/archive", async (req, res) => {
  const ownerId = (req as unknown as { userId?: string }).userId;
  const pid = idParam.safeParse(req.params);
  if (!pid.success) return res.status(400).json({ success: false, error: pid.error.flatten() });
  const card = await prisma.card.findUnique({ where: { id: pid.data.id }, include: { project: true } });
  if (!card || card.project.userId !== ownerId) return res.status(404).json({ success: false, error: "Not found" });
  const archived = await prisma.card.update({ where: { id: card.id }, data: { status: CardStatus.ARCHIVED } });
  return res.json({ success: true, data: archived });
});

export default router;

