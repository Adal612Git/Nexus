import { Router } from "express";
import { z } from "zod";
import { PrismaClient, Provider } from "@prisma/client";
import auth from "../auth/middleware.js";

const prisma = new PrismaClient();
const router = Router();

const connectSchema = z.object({
  provider: z.nativeEnum(Provider),
  accountEmail: z.string().email(),
  defaultCalendarId: z.string().min(1),
  timezone: z.string().min(1),
});

router.get("/calendar", auth, async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  const integ = await prisma.calendarIntegration.findUnique({ where: { userId: userId! } });
  if (!integ) return res.status(404).json({ success: false, error: "Not connected" });
  req.log.info({ msg: "calendar.get", provider: integ.provider, user: anonymize(userId) });
  return res.json({ success: true, data: integ });
});

router.post("/calendar/connect", auth, async (req, res, next) => {
  const userId = (req as any).userId as string | undefined;
  try {
    const data = connectSchema.parse(req.body);
  try {
    const exists = await prisma.calendarIntegration.findUnique({ where: { userId: userId! } });
    const integ = exists
      ? await prisma.calendarIntegration.update({
          where: { userId: userId! },
          data: { ...data, status: "Synced" },
        })
      : await prisma.calendarIntegration.create({ data: { ...data, userId: userId! } });
    req.log.info({ msg: "calendar.connect", provider: integ.provider, user: anonymize(userId) });
    return res.status(exists ? 200 : 201).json({ success: true, data: integ });
  } catch (e: any) {
    req.log.error({ msg: "calendar.connect.error", user: anonymize(userId) });
    return res.status(400).json({ success: false, error: e?.code || "Connect failed" });
  }
  } catch (e) { return next(e); }
});

router.post("/calendar/refresh", auth, async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  const integ = await prisma.calendarIntegration.findUnique({ where: { userId: userId! } });
  if (!integ) return res.status(404).json({ success: false, error: "Not connected" });
  const updated = await prisma.calendarIntegration.update({ where: { userId: userId! }, data: { status: "Synced" } });
  req.log.info({ msg: "calendar.refresh", provider: updated.provider, user: anonymize(userId) });
  return res.json({ success: true, data: updated });
});

router.delete("/calendar/disconnect", auth, async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  const integ = await prisma.calendarIntegration.findUnique({ where: { userId: userId! } });
  if (!integ) return res.status(404).json({ success: false, error: "Not connected" });
  await prisma.calendarIntegration.delete({ where: { userId: userId! } });
  req.log.info({ msg: "calendar.disconnect", provider: integ.provider, user: anonymize(userId) });
  return res.status(204).send();
});

function anonymize(id?: string) {
  return id ? `u_${id.slice(0, 3)}...${id.slice(-3)}` : "unknown";
}

export default router;
 
// List calendar events within a range, optional filters
router.get("/calendar/events", auth, async (req, res, next) => {
  const userId = (req as any).userId as string | undefined;
  const querySchema = z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    boardId: z.string().min(1).optional(),
    status: z.enum(["TODO", "DOING", "DONE", "ARCHIVED"]).optional(),
    label: z.string().optional(),
  });
  try {
    const { from, to, boardId, status } = querySchema.parse(req.query);
  // labels not modeled yet; kept for future

  const integ = await prisma.calendarIntegration.findUnique({ where: { userId: userId! } });
  const tz = integ?.timezone || null;

  // Fetch events joined with cards and projects owned by user
  const events = await prisma.calendarEvent.findMany({
    where: {
      startUtc: { gte: new Date(from) },
      endUtc: { lte: new Date(to) },
      card: {
        project: { userId: userId! },
        ...(status ? { status } : {}),
        ...(boardId ? { projectId: boardId } : {}),
      },
    },
    include: { card: { include: { project: true } } },
    orderBy: [{ startUtc: "asc" }],
  });

  function tzParts(date: Date, timeZone: string) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const map: any = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = parseInt(p.value, 10);
    // Build offset
    const asUTC = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
    const offsetMs = asUTC - date.getTime();
    const sign = offsetMs <= 0 ? "-" : "+";
    const abs = Math.abs(offsetMs);
    const oh = Math.floor(abs / 3600000)
      .toString()
      .padStart(2, "0");
    const om = Math.floor((abs % 3600000) / 60000)
      .toString()
      .padStart(2, "0");
    const yyyy = map.year.toString().padStart(4, "0");
    const mm = map.month.toString().padStart(2, "0");
    const dd = map.day.toString().padStart(2, "0");
    const hh = map.hour.toString().padStart(2, "0");
    const mi = map.minute.toString().padStart(2, "0");
    const ss = map.second.toString().padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${oh}:${om}`;
  }

  const data = events.map((ev) => {
    const startISO = tz ? tzParts(ev.startUtc, tz) : ev.startUtc.toISOString();
    const endISO = tz ? tzParts(ev.endUtc, tz) : ev.endUtc.toISOString();
    return {
      eventId: ev.id,
      cardId: ev.cardId,
      title: ev.card.title,
      status: ev.card.status,
      boardId: ev.card.projectId,
      start: startISO,
      end: endISO,
      allDay: !!ev.allDay,
      syncStatus: ev.status,
    };
  });

  req.log.info({ msg: "calendar.events", user: anonymize(userId) });
  return res.json({ success: true, data });
  } catch (e) { return next(e); }
});
