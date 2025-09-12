import { Router } from "express";
import { authMiddleware } from "../modules/auth/middleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
  res.json({ boards: [] });
});

export default router;

