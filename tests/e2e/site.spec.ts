import { expect, test } from "@playwright/test";

test("home explains what the server serves", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Open Bible Stories + Theological Formation").first()).toBeVisible();
  await expect(page.locator('a[href="https://formationstories.org/"]').first()).toBeVisible();
});

type AnatomyPicker = {
  name: string;
  setup: (page: import("@playwright/test").Page) => Promise<void>;
  choose: (page: import("@playwright/test").Page, part: string) => Promise<void>;
};

const anatomyPickers: AnatomyPicker[] = [
  {
    name: "phone select",
    setup: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 });
    },
    choose: async (page, part) => {
      await page.locator("#a-part").selectOption(part);
    },
  },
  {
    name: "desktop click",
    setup: async (page) => {
      await page.setViewportSize({ width: 1280, height: 900 });
    },
    choose: async (page, part) => {
      const labels: Record<string, string> = {
        movement1: "Biblical Interpretation",
        movement2: "Theological Dialogue",
        movement3: "Personal Reflection",
        movement4: "Ministry Practice",
      };
      await page.getByRole("button", { name: labels[part] }).click();
    },
  },
];

function countInitialize(mcpBodies: string[]): number {
  return mcpBodies.filter((body) => body.includes('"initialize"')).length;
}

function decodeTryStateHash(href: string): Record<string, unknown> {
  const hash = href.split("#")[1] ?? "";
  const b64 = hash.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
}

async function waitForToolCall(page: import("@playwright/test").Page, part: string): Promise<void> {
  await page.waitForRequest(
    (req) =>
      req.url().endsWith("/mcp") &&
      (req.postData() ?? "").includes('"method":"tools/call"') &&
      (req.postData() ?? "").includes(`"part":"${part}"`),
    { timeout: 20_000 }
  );
}

for (const picker of anatomyPickers) {
  test(`home anatomy stays offline until a part is chosen, then reuses one session (${picker.name})`, async ({ page }) => {
    const mcpBodies: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/mcp")) mcpBodies.push(r.postData() ?? "");
    });

    await picker.setup(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Saved example · story 1")).toBeVisible();
    await expect(page.locator("[data-anatomy-excerpt]")).toContainText(/\S/);
    expect(mcpBodies).toHaveLength(0);

    const movement2Call = waitForToolCall(page, "movement2");
    await picker.choose(page, "movement2");
    await expect(page.locator("[data-anatomy-card]")).toContainText("Theological Dialogue");
    await movement2Call;
    expect(countInitialize(mcpBodies)).toBe(1);
    await expect(page.getByText("Live from the server · story 1")).toBeVisible({ timeout: 15_000 });

    const movement3Call = waitForToolCall(page, "movement3");
    await picker.choose(page, "movement3");
    await expect(page.locator("[data-anatomy-card]")).toContainText("Personal Reflection");
    await movement3Call;
    expect(countInitialize(mcpBodies)).toBe(1);
  });
}

test("home anatomy movement1 keeps include_answers in the shown call and first request", async ({ page }) => {
  const mcpBodies: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/mcp")) mcpBodies.push(r.postData() ?? "");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(mcpBodies).toHaveLength(0);
  await expect(page.locator("[data-anatomy-card]")).toContainText(
    'fetch_obs_study_manual {"reference":"1:5-8","part":"movement1","include_answers":false}'
  );
  const state = decodeTryStateHash(
    (await page.getByRole("link", { name: "Run this call" }).getAttribute("href")) ?? ""
  );
  expect(state).toMatchObject({
    tab: "tools",
    tool: "fetch_obs_study_manual",
    args: { reference: "1:5-8", part: "movement1", include_answers: false },
  });

  const movement1Call = page.waitForRequest(
    (req) =>
      req.url().endsWith("/mcp") &&
      (req.postData() ?? "").includes('"method":"tools/call"') &&
      (req.postData() ?? "").includes('"part":"movement1"') &&
      (req.postData() ?? "").includes('"reference":"1:5-8"') &&
      (req.postData() ?? "").includes('"include_answers":false'),
    { timeout: 20_000 }
  );
  await page.getByRole("button", { name: "Biblical Interpretation" }).click();
  await movement1Call;
  expect(countInitialize(mcpBodies)).toBe(1);
  await expect(page.getByText("Live from the server · story 1")).toBeVisible({ timeout: 15_000 });
  const excerptStrong = page.locator("[data-anatomy-excerpt] strong");
  await expect(excerptStrong.filter({ hasText: /^A:$/ })).toHaveCount(0);
  expect(await excerptStrong.filter({ hasText: /^Q:$/ }).count()).toBeGreaterThan(0);
});

test("home anatomy does not retry connection after a failed first connect", async ({ page }) => {
  const mcpBodies: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/mcp")) mcpBodies.push(r.postData() ?? "");
  });
  await page.route("**/mcp", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "server unavailable" } }),
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(mcpBodies).toHaveLength(0);

  await page.locator("#a-part").selectOption("movement2");
  await expect(page.locator("[data-anatomy-card]")).toContainText("Theological Dialogue");
  await expect.poll(() => countInitialize(mcpBodies)).toBe(1);

  await page.locator("#a-part").selectOption("movement3");
  await expect(page.locator("[data-anatomy-card]")).toContainText("Personal Reflection");
  await page.waitForTimeout(800);
  expect(countInitialize(mcpBodies)).toBe(1);
  await expect(page.getByText("Saved example · story 1")).toBeVisible();
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

test("try renders the study manual without the note for the assistant", async ({ page }) => {
  const state = {
    tab: "tools",
    tool: "fetch_obs_study_manual",
    args: { reference: "1:5-8", part: "movement1", format: "json" },
  };
  await page.goto("/try#" + Buffer.from(JSON.stringify(state)).toString("base64url"));
  const result = page.locator("[data-result]");
  await expect(result.getByText("01-05").first()).toBeVisible({ timeout: 20_000 });
  await expect(result).not.toContainText("For the assistant");
  await result.getByRole("tab", { name: "JSON-RPC" }).click();
  await expect(result).toContainText("For the assistant");
});

test("one click on an example makes one tool call", async ({ page }) => {
  const toolCalls: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/mcp") && (r.postData() ?? "").includes('"tools/call"')) toolCalls.push(r.postData()!);
  });
  await page.goto("/try");
  await expect(page.getByText(/Connected/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "Tools" }).click();
  toolCalls.length = 0;
  await page.getByRole("button", { name: "Languages", exact: true }).click();
  await expect(page.getByText("list_languages ·")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  expect(toolCalls.filter((b) => b.includes("list_languages"))).toHaveLength(1);
});

test.describe("on a phone, choosing something shows its result", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const inView = async (page: import("@playwright/test").Page, selector: string) => {
    const box = await page.locator(selector).first().boundingBox();
    return !!box && box.y < 844 && box.y + 40 > 0;
  };

  test("guided session: picking a part brings its content into view", async ({ page }) => {
    await page.goto("/try");
    await expect(page.getByText(/Connected/)).toBeVisible({ timeout: 20_000 });
    await page.locator("#g-part").selectOption("movement2");
    await expect(page.getByRole("heading", { name: /Movement 2/ }).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    expect(await inView(page, "[data-result]")).toBe(true);
  });

  test("tools: running an example brings the result into view", async ({ page }) => {
    await page.goto("/try");
    await expect(page.getByText(/Connected/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: "Tools" }).click();
    await expect(page.locator("#t-tool")).toBeVisible();
    await page.getByRole("button", { name: "Languages", exact: true }).click();
    await expect(page.getByText("list_languages ·")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    expect(await inView(page, "[data-result]")).toBe(true);
  });

  test("home anatomy: picking a part brings its card into view", async ({ page }) => {
    await page.goto("/");
    await page.locator("#a-part").selectOption("movement5");
    await page.waitForTimeout(800);
    expect(await inView(page, "[data-anatomy-card]")).toBe(true);
  });
});

test("the limits page only names fields the server sends", async ({ page }) => {
  await page.goto("/docs/limits");
  await expect(page.getByRole("heading", { name: "Limits and sizes" })).toBeVisible();
  await expect(page.getByText("response_size_bytes")).toHaveCount(0);
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
