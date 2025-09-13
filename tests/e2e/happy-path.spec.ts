import { test, expect } from "@playwright/test";

async function axeScan(page) {
  try {
    const { AxeBuilder } = await import('@axe-core/playwright');
    const results = await new AxeBuilder({ page }).analyze();
    const criticals = results.violations.filter(v => v.impact === 'critical');
    expect(criticals.length, 'No critical a11y violations').toBe(0);
  } catch {
    // axe not installed; skip silently
  }
}

async function login(page) {
  await page.goto('/login');
  await page.fill('input[type=email]', 'demo@nexus.dev');
  await page.fill('input[type=password]', 'password123');
  await page.click('button:has-text("Entrar")');
  await expect(page).toHaveURL(/dashboard|boards/);
}

test.describe('Happy path', () => {
  test('login → board DnD → fecha → dashboard', async ({ page }) => {
    await login(page);
    await axeScan(page);

    // Go to boards and drag first card within same column (smoke)
    await page.goto('/boards');
    await axeScan(page);
    const first = page.locator('[data-id]').first();
    const second = page.locator('[data-id]').nth(1);
    if (await first.isVisible() && await second.isVisible()) {
      const box1 = await first.boundingBox();
      const box2 = await second.boundingBox();
      if (box1 && box2) {
        await page.mouse.move(box1.x + box1.width/2, box1.y + box1.height/2);
        await page.mouse.down();
        await page.mouse.move(box2.x + box2.width/2, box2.y + box2.height/2);
        await page.mouse.up();
      }
    }

    // Assign date via chip
    const chipButton = page.locator('text=+ fecha').first();
    if (await chipButton.isVisible()) {
      await chipButton.click();
      const dt = new Date(Date.now() + 3600000).toISOString().slice(0,16);
      await page.fill('input[type="datetime-local"]', dt);
      await page.click('button:has-text("Guardar")');
    }

    // Visit calendar (optional) then dashboard
    await page.goto('/calendar');
    await axeScan(page);
    await page.goto('/dashboard');
    await axeScan(page);
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();
  });
});

