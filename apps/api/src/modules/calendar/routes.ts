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

router.post("/calendar/connect", auth, async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
  const data = parsed.data;
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

