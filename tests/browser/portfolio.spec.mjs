import { expect, test } from "@playwright/test";

test("normal-motion loader finishes even when browser storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    for (const key of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, key, { get() { throw new DOMException("Blocked", "SecurityError"); } });
    }
  });
  await page.goto("/");
  await expect(page.locator(".preloader")).toBeHidden({ timeout: 20000 });
  const otherLanguage = page.getByRole("group", { name: "Language" }).getByRole("button", { pressed: false });
  const before = await page.locator("html").getAttribute("lang");
  await otherLanguage.click();
  await expect(page.locator("html")).not.toHaveAttribute("lang", before);
});

test("mobile reduced-motion visit retains the selected language on a full detail navigation", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".preloader")).toBeHidden();
  const initial = await page.locator("html").getAttribute("lang");
  await page.getByRole("group", { name: "Language" }).getByRole("button", { pressed: false }).click();
  await expect(page.locator("html")).not.toHaveAttribute("lang", initial);
  const selected = await page.locator("html").getAttribute("lang");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const detail = sitemap.match(/<loc>([^<]+\/works\/[^<]+)<\/loc>/)?.[1];
  test.skip(!detail, "Snapshot has no work pages");
  await page.goto(new URL(detail).pathname);
  await expect(page.locator("html")).toHaveAttribute("lang", selected);
  await expect(page.locator(".wd-title")).toBeVisible();
  const picture = page.locator(".wd-frame img").first();
  if (await picture.count()) await expect(picture).toHaveCSS("object-fit", "contain");
  await page.locator(".wd-back").click();
  await expect(page).toHaveURL(/\/#works$/);
  await expect(page.locator("html")).toHaveAttribute("lang", selected);
  await expect(page.locator("#works")).toBeInViewport();
});

test("keyboard screening returns focus to a real work button", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#works");
  const row = page.locator(".work-row-hit").first();
  test.skip(!await row.count(), "Snapshot has no work rows");
  await expect(page.locator("#works")).toHaveAttribute("data-tv-phase", "rows");
  await page.keyboard.press("Tab");
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".tv-sheet-close")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
});

test("normal-motion Contact keeps the booth clear of the header and resumes its float", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const booth = page.locator(".contact-booth-float");
  await expect(booth).toHaveCSS("animation-play-state", "paused");
  await expect(page.locator(".preloader")).toBeHidden({ timeout: 20000 });
  await page.locator(".nav-entry").last().click();
  await expect(booth).toBeInViewport();
  await expect(booth).toHaveCSS("animation-play-state", "running");
  await expect.poll(() => page.evaluate(() => {
    const booth = document.querySelector(".contact-booth").getBoundingClientRect();
    const header = document.querySelector(".header").getBoundingClientRect();
    return booth.bottom <= innerHeight && booth.top > header.bottom;
  })).toBe(true);
});

test("home, work and offline shell inherit the root theme without hydration", async ({ browser, request, baseURL }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const work = sitemap.match(/<loc>([^<]+\/works\/[^<]+)<\/loc>/)?.[1];
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const routes = [["/", ".pf", ".contact-reel-dot"], ["/offline/", "main", "main a"]];
    if (work) routes.push([new URL(work).pathname, ".wd", ".wd-back"]);
    for (const [path, stage, accent] of routes) {
      await page.goto(path);
      await expect(page.locator("meta[name='theme-color']")).toHaveAttribute("content", manifest.theme_color);
      await expect(page.locator("html")).toHaveCSS("--stage", manifest.theme_color);
      // Override only the source tokens. Local defaults or hard-coded consumer
      // colours would still look correct with the stock snapshot, but fail here.
      await page.addStyleTag({ content: ":root { --stage: #182036 !important; --accent: #dddd55 !important; }" });
      await expect(page.locator(stage)).toHaveCSS("background-color", "rgb(24, 32, 54)");
      if (stage === ".wd") await page.locator(accent).hover();
      await expect(page.locator(accent).first()).toHaveCSS(stage === ".pf" ? "background-color" : "color", "rgb(221, 221, 85)");
    }
  } finally {
    await context.close();
  }
});
