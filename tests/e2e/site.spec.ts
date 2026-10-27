import { expect, test } from "@playwright/test";

test("home explains what the server serves", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Open Bible Stories + Theological Formation").first()).toBeVisible();
  await expect(page.locator('a[href="https://formationstories.org/"]').first()).toBeVisible();
});

test("the try page calls this site's own server", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/mcp")) calls.push(r.url());
  });
  await page.goto("/try");
  await page.getByRole("tab", { name: "Tools" }).click();
  await page.getByRole("button", { name: "Story 1, Movement 1" }).click();
  await expect(page.getByText("01-01").first()).toBeVisible({ timeout: 15_000 });
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every((u) => u.startsWith("http://127.0.0.1:8790/"))).toBe(true);
});

test("a broken shared link opens the guided session", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/try#not-a-state");
  await expect(page.getByRole("tab", { name: "Guided session" })).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("the tools page lists the primary tool", async ({ page }) => {
  await page.goto("/tools");
  await expect(page.locator("#fetch_obs_study_manual")).toBeVisible();
});

test("the old chat page redirects to try", async ({ page }) => {
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/try/);
});

for (const path of ["/", "/try", "/connect", "/tools", "/docs", "/docs/sessions"]) {
  test(`no horizontal scroll on ${path} at phone width`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const width = (await page.evaluate("document.documentElement.scrollWidth")) as number;
    expect(width).toBeLessThanOrEqual(375);
  });
}
