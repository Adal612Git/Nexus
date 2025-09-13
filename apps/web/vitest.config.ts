import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.spec.ts"],
  },
  coverage: {
    provider: "v8",
    reportsDirectory: "./coverage",
    reporter: ["text", "html", "json-summary"],
    lines: 70,
    functions: 70,
    statements: 70,
    branches: 50,
    include: ["src/**/*.{ts,vue}"]
  },
});
