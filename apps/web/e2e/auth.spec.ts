import { test, expect } from "@playwright/test";

test("login exitoso redirige a /dashboard", async ({ page }) => {
  await page.goto("/");
  await page.click("text=Login");
  await page.fill("input[type=email]", "demo@nexus.dev");
  await page.fill("input[type=password]", "password123");
  await page.click("button:has-text('Entrar')");
  await expect(page).toHaveURL(/.*\/dashboard/);
});

test("credenciales inválidas muestran mensaje", async ({ page }) => {
  await page.goto("/login");
  await page.fill("input[type=email]", "demo@nexus.dev");
  await page.fill("input[type=password]", "wrongpass");
  await page.click("button:has-text('Entrar')");
  await expect(page.locator("text=Credenciales inválidas")).toBeVisible();
});

test("ruta protegida sin sesión redirige a /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/boards");
  // Guard redirige con query ?redirect=/boards; acepta query params
  await expect(page).toHaveURL(/\/login(\?.*)?$/);
});

test("olvido contraseña muestra mensaje genérico", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.fill("input[type=email]", "demo@nexus.dev");
  await page.click("text=Enviar");
  await expect(page.locator("text=Si existe, te enviamos instrucciones")).toBeVisible();
});

// Reset válido/expirado would require capturing token from email/logs.
// Skipping here; covered by API tests.
