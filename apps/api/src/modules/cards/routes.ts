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

// Note: we'll attach auth per-route to allow a dev bypass for POST create

// Read by projectId
router.get("/", auth, async (req, res) => {
  const ownerId = (req as unknown as { userId?: string }).userId;
  const projectId = z.string().min(1).safeParse(req.query.projectId);
  if (!projectId.success) return res.status(400).json({ success: false, error: "projectId required" });
  const project = await prisma.project.findUnique({ where: { id: projectId.data } });
  if (!project || project.userId !== ownerId) return res.status(404).json({ success: false, error: "Not found" });
  const cards = await prisma.card.findMany({ where: { projectId: project.id }, orderBy: [{ status: "asc" }, { position: "asc" }] });
  return res.json({ success: true, data: cards });
});

// Dev bypass: allow creation without token only in development (for quick demos)
router.post("/", async (req, res, next) => {
  if (process.env.NODE_ENV === "development" && !req.headers.authorization) {
    const parsed = createCardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
    const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    try {
      const card = await prisma.card.create({ data: parsed.data });
      return res.status(201).json({ success: true, data: card });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e?.code || "Create failed" });
    }
  }
  return next();
});

router.post("/", auth, async (req, res) => {
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

router.put("/:id", auth, async (req, res) => {
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

router.patch("/:id/archive", auth, async (req, res) => {
  const ownerId = (req as unknown as { userId?: string }).userId;
  const pid = idParam.safeParse(req.params);
  if (!pid.success) return res.status(400).json({ success: false, error: pid.error.flatten() });
  const card = await prisma.card.findUnique({ where: { id: pid.data.id }, include: { project: true } });
  if (!card || card.project.userId !== ownerId) return res.status(404).json({ success: false, error: "Not found" });
  const archived = await prisma.card.update({ where: { id: card.id }, data: { status: CardStatus.ARCHIVED } });
  return res.json({ success: true, data: archived });
});

// Reorder cards within a project
const moveSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(CardStatus),
  position: z.number().int().positive(),
  version: z.string().datetime().optional(), // updatedAt precondition
});

router.patch("/reorder", auth, async (req, res) => {
  const ownerId = (req as unknown as { userId?: string }).userId;
  const parsed = z
    .object({ moves: z.array(moveSchema).min(1) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });

  const moves = parsed.data.moves;
  // Fetch cards for all move IDs with project
  const ids = moves.map((m) => m.id);
  const cards = await prisma.card.findMany({ where: { id: { in: ids } }, include: { project: true } });
  if (cards.length !== ids.length) return res.status(404).json({ success: false, error: "Not found" });

  const projectId = cards[0].projectId;
  // Ownership check and same project
  for (const c of cards) {
    if (c.projectId !== projectId) return res.status(400).json({ success: false, error: "Mixed projects" });
    if (c.project.userId !== ownerId) return res.status(403).json({ success: false, error: "Forbidden" });
  }

  // Concurrency check using updatedAt if provided
  const byId = new Map(cards.map((c) => [c.id, c] as const));
  for (const m of moves) {
    if (m.version) {
      const current = byId.get(m.id)!;
      if (new Date(m.version).getTime() !== current.updatedAt.getTime()) {
        return res.status(409).json({ success: false, error: "Conflict" });
      }
    }
  }

  // Compute final order for the entire project
  const all = await prisma.card.findMany({ where: { projectId }, orderBy: [{ status: "asc" }, { position: "asc" }] });
  const moveMap = new Map(moves.map((m) => [m.id, m] as const));
  const finalByStatus: Record<CardStatus, typeof all> = {
    TODO: [],
    DOING: [],
    DONE: [],
    ARCHIVED: [],
  } as any;

  // First, for every status create initial arrays without moved cards
  for (const c of all) {
    if (!moveMap.has(c.id)) finalByStatus[c.status].push(c);
  }
  // Insert moved cards into target status arrays respecting requested position
  for (const [id, m] of moveMap) {
    const card = all.find((c) => c.id === id)!;
    const target = finalByStatus[m.status];
    const idx = Math.max(0, Math.min(m.position - 1, target.length));
    target.splice(idx, 0, { ...card, status: m.status });
  }
  // Reindex positions compactly (1..n) within each status
  const updates: { id: string; status: CardStatus; position: number }[] = [];
  (Object.keys(finalByStatus) as CardStatus[]).forEach((status) => {
    const arr = finalByStatus[status];
    let pos = 1;
    for (const c of arr) {
      if (c.status !== status || c.position !== pos) {
        updates.push({ id: c.id, status, position: pos });
      }
      pos += 1;
    }
  });

  try {
    // Two-phase update to avoid unique constraint collisions:
    // 1) move all affected cards to unique temporary negative positions per status
    const groups = new Map<CardStatus, { id: string; status: CardStatus }[]>();
    for (const u of updates) {
      const arr = groups.get(u.status) || [];
      arr.push({ id: u.id, status: u.status });
      groups.set(u.status, arr);
    }
    const temp: { id: string; status: CardStatus; position: number }[] = [];
    for (const [status, arr] of groups) {
      arr.forEach((item, idx) => temp.push({ id: item.id, status, position: -1 * (idx + 1) }));
    }
    await prisma.$transaction([
      ...temp.map((t) => prisma.card.update({ where: { id: t.id }, data: { status: t.status, position: t.position } })),
      ...updates.map((u) => prisma.card.update({ where: { id: u.id }, data: { status: u.status, position: u.position } })),
    ]);
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.code || "Reorder failed" });
  }

  const result = await prisma.card.findMany({ where: { projectId }, orderBy: [{ status: "asc" }, { position: "asc" }] });
  return res.json({ success: true, data: result });
});

export default router;
