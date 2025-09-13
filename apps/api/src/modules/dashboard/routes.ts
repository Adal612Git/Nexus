import { Router } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import auth from "../auth/middleware.js";

const prisma = new PrismaClient();
const router = Router();

router.get("/metrics", auth, async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  // KPIs mock
  const kpis = { income: 1200, expenses: 500, balance: 700, savings: 300 };

  // Totals by status for user's projects
  const totalsRaw = await prisma.card.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: { project: { userId: userId! } },
  });
  const totals: Record<string, number> = { TODO: 0, DOING: 0, DONE: 0, ARCHIVED: 0 };
  for (const r of totalsRaw) totals[r.status] = r._count._all;

  // Overdue: CalendarEvent.endUtc < now() for user's projects
  const now = new Date();
  const overdue = await prisma.calendarEvent.count({
    where: { endUtc: { lt: now }, card: { project: { userId: userId! } } },
  });

  // Upcoming 7 days only if user has integration
  const integ = await prisma.calendarIntegration.findUnique({ where: { userId: userId! } });
  let upcoming: Array<{ title: string; startUtc: string; allDay: boolean; projectId: string; syncStatus: string }> = [];
  if (integ) {
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const list = await prisma.calendarEvent.findMany({
      where: {
        startUtc: { gte: now, lte: to },
        card: { project: { userId: userId! } },
      },
      include: { card: true },
      orderBy: { startUtc: "asc" },
      take: 20,
    });
    upcoming = list.map((e) => ({
      title: e.card.title,
      startUtc: e.startUtc.toISOString(),
      allDay: !!e.allDay,
      projectId: e.card.projectId,
      syncStatus: e.status,
    }));
  }

  req.log.info({ msg: "dashboard.metrics", user: anonymize(userId) });
  return res.json({ success: true, data: { kpis, totals, overdue, upcoming } });
});

function anonymize(id?: string) {
  return id ? `u_${id.slice(0, 3)}...${id.slice(-3)}` : "unknown";
}

export default router;

