import { Router } from "express";
import { z } from "zod";
import { PrismaClient, CardStatus } from "@prisma/client";
import auth from "../auth/middleware.js";
import { calendarAdapter } from "../calendar/mockAdapter.js";

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

// Set or update due date for a card
const dueDateSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1).optional(),
  allDay: z.boolean().optional(),
});

router.patch("/:id/due-date", auth, async (req, res, next) => {
  const ownerId = (req as any).userId as string | undefined;
  let pid;
  let body;
  try {
    pid = idParam.parse(req.params);
    body = dueDateSchema.parse(req.body);
  } catch (e) { return next(e); }

  const card = await prisma.card.findUnique({ where: { id: pid.id }, include: { project: true } });
  if (!card || card.project.userId !== ownerId) return res.status(404).json({ success: false, error: "Not found" });

  const integ = await prisma.calendarIntegration.findUnique({ where: { userId: ownerId! } });
  const tz = integ?.timezone || "UTC";
  const { startUtc, endUtc, allDay } = computeUtcRange(body.start, body.end, body.allDay, tz);
  const idempotencyKey = String(req.headers["x-idempotency-key"] || `dd-${card.id}-${startUtc.toISOString()}`);

  try {
    // Upsert local event
    const existing = await prisma.calendarEvent.findUnique({ where: { cardId: card.id } });
    const provider = integ?.provider || null;
    const local = existing
      ? await prisma.calendarEvent.update({
          where: { cardId: card.id },
          data: { startUtc, endUtc, allDay: !!allDay, provider: provider || undefined, status: "Pending" },
        })
      : await prisma.calendarEvent.create({
          data: {
            cardId: card.id,
            startUtc,
            endUtc,
            allDay: !!allDay,
            provider: provider || undefined,
            status: integ ? "Pending" : "Synced",
          },
        });

    // Trigger sync if integration exists
    if (integ) {
      await syncCalendar(ownerId!, integ.provider, {
        action: existing ? "update" : "create",
        accountEmail: integ.accountEmail,
        calendarId: integ.defaultCalendarId,
        event: {
          id: local.externalId || undefined,
          accountEmail: integ.accountEmail,
          title: card.title,
          startsAt: startUtc.toISOString(),
          endsAt: endUtc.toISOString(),
          calendarId: integ.defaultCalendarId,
        },
        idempotencyKey,
        cardId: card.id,
      });
    }

    req.log.info({ msg: "due-date.set", card: anon(card.id) });
    return res.json({ success: true });
  } catch (e: any) {
    req.log.error({ msg: "due-date.set.error", card: anon(card.id) });
    return res.status(400).json({ success: false, error: e?.code || "Due date failed" });
  }
});

router.delete("/:id/due-date", auth, async (req, res) => {
  const ownerId = (req as any).userId as string | undefined;
  const pid = idParam.safeParse(req.params);
  if (!pid.success) return res.status(400).json({ success: false, error: pid.error.flatten() });
  const card = await prisma.card.findUnique({ where: { id: pid.data.id }, include: { project: true } });
  if (!card || card.project.userId !== ownerId) return res.status(404).json({ success: false, error: "Not found" });

  const integ = await prisma.calendarIntegration.findUnique({ where: { userId: ownerId! } });
  const ev = await prisma.calendarEvent.findUnique({ where: { cardId: card.id } });
  if (!ev) return res.status(204).send();
  try {
    await prisma.calendarEvent.delete({ where: { cardId: card.id } });
    if (integ && ev.externalId) {
      await calendarAdapter.delete({ id: ev.externalId, accountEmail: integ.accountEmail });
    }
    req.log.info({ msg: "due-date.delete", card: anon(card.id) });
    return res.status(204).send();
  } catch (e: any) {
    req.log.error({ msg: "due-date.delete.error", card: anon(card.id) });
    return res.status(400).json({ success: false, error: e?.code || "Delete failed" });
  }
});

router.get("/:id/event", auth, async (req, res) => {
  const ownerId = (req as any).userId as string | undefined;
  const pid = idParam.safeParse(req.params);
  if (!pid.success) return res.status(400).json({ success: false, error: pid.error.flatten() });
  const card = await prisma.card.findUnique({ where: { id: pid.data.id }, include: { project: true } });
  if (!card || card.project.userId !== ownerId) return res.status(404).json({ success: false, error: "Not found" });
  const ev = await prisma.calendarEvent.findUnique({ where: { cardId: card.id } });
  return res.json({ success: true, data: ev });
});

function computeUtcRange(start: string, end: string | undefined, allDay: boolean | undefined, tz: string) {
  // Basic normalization: if start/end include timezone or Z, rely on Date parsing; otherwise treat as UTC
  const hasTZ = /[zZ]|[\+\-]\d{2}:?\d{2}$/.test(start);
  const s = new Date(hasTZ ? start : start + (start.endsWith("Z") ? "" : "Z"));
  let e: Date;
  if (end) {
    const hasEndTZ = /[zZ]|[\+\-]\d{2}:?\d{2}$/.test(end);
    e = new Date(hasEndTZ ? end : end + (end.endsWith("Z") ? "" : "Z"));
  } else {
    e = new Date(s.getTime() + 60 * 60 * 1000);
  }
  // allDay: normalize to full-day range
  if (allDay) {
    const sDay = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 0, 0, 0));
    const eDay = new Date(sDay.getTime() + 24 * 60 * 60 * 1000);
    return { startUtc: sDay, endUtc: eDay, allDay: true };
  }
  return { startUtc: s, endUtc: e, allDay: false };
}

async function syncCalendar(
  userId: string,
  provider: any,
  opts: {
    action: "create" | "update";
    accountEmail: string;
    calendarId: string;
    event: { id?: string; accountEmail: string; title: string; startsAt: string; endsAt: string; calendarId: string };
    idempotencyKey: string;
    cardId: string;
  }
) {
  const maxRetries = 3;
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = opts.action === "create" ? await calendarAdapter.create({
        id: opts.event.id,
        accountEmail: opts.accountEmail,
        title: opts.event.title,
        startsAt: opts.event.startsAt,
        endsAt: opts.event.endsAt,
        calendarId: opts.calendarId,
      }) : await calendarAdapter.update({
        id: opts.event.id,
        accountEmail: opts.accountEmail,
        title: opts.event.title,
        startsAt: opts.event.startsAt,
        endsAt: opts.event.endsAt,
        calendarId: opts.calendarId,
      });
      if (res.status === "Synced") {
        await prisma.calendarEvent.update({ where: { cardId: opts.cardId }, data: { status: "Synced", lastSyncedAt: new Date(), externalId: (res as any).data?.id } });
        return;
      }
      if (res.status === "Pending") {
        await prisma.calendarEvent.update({ where: { cardId: opts.cardId }, data: { status: "Pending" } });
        return;
      }
      throw new Error(res.error || "Sync error");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401) {
        await prisma.calendarEvent.update({ where: { cardId: opts.cardId }, data: { status: "Pending" } });
        return;
      }
      if (status === 429 || status === 503) {
        const backoff = Math.pow(2, attempt) * 250;
        await new Promise((r) => setTimeout(r, backoff));
        attempt += 1;
        continue;
      }
      await prisma.calendarEvent.update({ where: { cardId: opts.cardId }, data: { status: "Error" } });
      return;
    }
  }
}

function anon(id: string) {
  return `c_${id.slice(0, 3)}...${id.slice(-3)}`;
}

export default router;
