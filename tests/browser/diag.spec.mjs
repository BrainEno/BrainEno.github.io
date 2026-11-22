// TEMPORARY DIAGNOSTIC — not part of the suite. Replicates the failing
// "Contact keeps the booth clear of the header" flow under CPU throttling to
// imitate the slower 1-worker CI runner, and logs the geometry each step.
// Delete before merging.
import { test } from "@playwright/test";

test.setTimeout(120000);

for (const rate of [4, 8]) {
  test(`diag: contact arrival under ${rate}x CPU throttle`, async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const booth = page.locator(".contact-booth-float");
    await booth.waitFor({ state: "attached" });
    const pausedAtLoad = await booth.evaluate((el) => getComputedStyle(el).animationPlayState);
    await page.locator(".preloader").waitFor({ state: "hidden", timeout: 40000 });

    const snap = () =>
      page.evaluate(() => {
        const pick = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            h: Math.round(r.height),
            vis: cs.visibility,
            op: Number(cs.opacity).toFixed(2),
          };
        };
        return {
          scrollY: Math.round(window.scrollY),
          maxScroll: document.documentElement.scrollHeight - innerHeight,
          contact: pick("#contact"),
          booth: pick(".contact-booth"),
          float: pick(".contact-booth-float"),
          anim: (() => {
            const el = document.querySelector(".contact-booth-float");
            return el ? getComputedStyle(el).animationPlayState : null;
          })(),
          contactInline: document.querySelector("#contact")?.getAttribute("style") || "",
        };
      });

    const log = (label, data) =>
      console.log(`DIAG rate=${rate} pausedAtLoad=${pausedAtLoad} ${label} ${JSON.stringify(data)}`);

    log("before-click", await snap());
    const t0 = Date.now();
    await page.locator(".nav-entry").last().click();
    log("clicked", { ms: 0 });

    let firstVisible = null;
    for (let i = 0; i < 24; i++) {
      await page.waitForTimeout(500);
      const s = await snap();
      const ms = Date.now() - t0;
      if (firstVisible === null && s.float && s.float.vis === "visible" && s.float.top < 900 && s.float.bottom > 0) {
        firstVisible = ms;
      }
      log(`t+${ms}`, { ...s, firstVisible });
      if (firstVisible !== null && ms > firstVisible + 1000) break;
    }
    log("summary", { firstVisible, total: Date.now() - t0 });
  });
}
