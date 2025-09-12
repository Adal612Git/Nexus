import "dotenv/config";
import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api", ts: new Date().toISOString() });
});

const host = process.env.API_HOST || "0.0.0.0";
const port = Number(process.env.API_PORT || 3000);
app.listen(port, host, () => {
  console.log(`[api] listening on http://${host}:${port}`);
});

