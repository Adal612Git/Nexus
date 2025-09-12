import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const host = env.WEB_HOST || "0.0.0.0";
  const port = Number(env.WEB_PORT || 5173);

  return {
    plugins: [vue()],
    server: {
      host,
      port
    }
  };
});

