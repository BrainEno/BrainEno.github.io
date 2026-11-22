// TEMPORARY DIAGNOSTIC — not part of the suite. Prints the geometry the
// "Contact keeps the booth clear of the header" test relies on, so the CI log
// can tell us where the scroll actually lands. Delete before merging.
import { test } from "@playwright/test";

test.setTimeout(90000);

test("diag: contact arrival geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator(".contact-booth-float").waitFor({ state: "attached" });
  await page.locator(".preloader").waitFor({ state: "hidden", timeout: 20000 });

  const snap = () =>
    page.evaluate(() => {
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          h: Math.round(r.height),
          w: Math.round(r.width),
          vis: cs.visibility,
          op: Number(cs.opacity).toFixed(2),
          disp: cs.display,
          inline: el.getAttribute("style") || "",
        };
      };
      const content = document.getElementById("smooth-content");
      return {
        ih: innerHeight,
        scrollY: Math.round(window.scrollY),
        docH: document.documentElement.scrollHeight,
        maxScroll: document.documentElement.scrollHeight - innerHeight,
        contentTop: content ? Math.round(content.getBoundingClientRect().top) : null,
        booth: rect(".contact-booth"),
        stage: rect(".contact-stage"),
        contact: rect("#contact"),
        header: rect(".header"),
        boothVar: getComputedStyle(document.querySelector(".contact-stage") || document.body)
          .getPropertyValue("--booth-h")
          .trim(),
        navLabels: [...document.querySelectorAll(".nav-entry")].map((n) => n.textContent.trim()),
        hash: location.hash,
      };
    });

  const probe = (label, data) => console.log(`DIAG ${label} ${JSON.stringify(data)}`);

  probe("before-click", await snap());

  await page.locator(".nav-entry").last().click();

  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(400);
    probe(`t+${(i + 1) * 400}`, await snap());
  }
});
