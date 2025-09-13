import { test, expect } from "@playwright/test";

async function login(page) {
  await page.goto("/login");
  await page.fill("input[type=email]", "demo@nexus.dev");
  await page.fill("input[type=password]", "password123");
  await page.click("button:has-text('Entrar')");
  await page.waitForURL(/dashboard|boards/);
}

test.describe("Dashboard", () => {
  test("Scenario 1: without integration shows CTA and KPIs", async ({ page }) => {
    await login(page);
    // Try to disconnect if connected
    await page.goto("/settings/integrations");
    const hasDisconnect = await page.getByRole("button", { name: /Desconectar/i }).isVisible().catch(() => false);
    if (hasDisconnect) await page.getByRole("button", { name: /Desconectar/i }).click();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
    // KPIs render
    await expect(page.getByRole("region", { name: /KPIs/i })).toBeVisible();
    // CTA present
    await expect(page.getByRole("button", { name: /Conectar Google\/Outlook/i })).toBeVisible();
  });

  test("Scenario 2: with integration shows upcoming list", async ({ page }) => {
    await login(page);
    // Connect integration via UI
    await page.goto("/settings/integrations");
    const connect = page.getByRole("button", { name: /Conectar Google/i });
    if (await connect.isVisible().catch(() => false)) {
      await connect.click();
    }
    // Create a due-date event quickly via API using token from localStorage
    await page.goto("/boards");
    // Read first card id
    const el = page.locator("[data-id]").first();
    const cardId = await el.getAttribute("data-id");
    await page.evaluate(async (cardId) => {
      const at = localStorage.getItem("accessToken") || "";
      const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await fetch(`/api/cards/${cardId}/due-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${at}` },
        body: JSON.stringify({ start }),
      });
    }, cardId);
    await page.goto("/dashboard");
    // Expect at least one upcoming item or fallback to CTA if timing off
    const list = page.locator("section[aria-label='Próximos eventos'] ul li");
    const count = await list.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Scenario 3: quick access buttons navigate", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Ir a Tableros/i }).click();
    await expect(page).toHaveURL(/\/boards/);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Ir a Calendario/i }).click();
    await expect(page).toHaveURL(/\/calendar/);
  });
});

