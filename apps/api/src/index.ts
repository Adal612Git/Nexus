import "dotenv/config";
import { createApp } from "./app.js";

const app = createApp();

const host = process.env.API_HOST || "0.0.0.0";
const port = Number(process.env.API_PORT || 3000);
app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://${host}:${port}`);
});
