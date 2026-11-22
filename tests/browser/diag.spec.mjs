// TEMPORARY DIAGNOSTIC — not part of the suite. Prints the geometry the
// "Contact keeps the booth clear of the header" test relies on, so the CI log
// can tell us where the scroll actually lands. Delete before merging.
import { test } from "@playwright/test";

test("diag: contact arrival geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator(".contact-booth-float").waitFor();
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
          left: Math.round(r.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
          visibility: cs.visibility,
          opacity: cs.opacity,
          display: cs.display,
          transform: cs.transform,
          animation: cs.animationPlayState,
        };
      };
      const content = document.getElementById("smooth-content");
      return {
        innerHeight,
        scrollY: window.scrollY,
        docHeight: document.documentElement.scrollHeight,
        maxScroll: document.documentElement.scrollHeight - innerHeight,
        booth: rect(".contact-booth"),
        float: rect(".contact-booth-float"),
        stage: rect(".contact-stage"),
        contact: rect("#contact"),
        header: rect(".header"),
        boothVar:
          getComputedStyle(document.querySelector(".contact-stage") || document.body)
            .getPropertyValue("--booth-h")
            .trim(),
        wrapperPresent: !!document.getElementById("smooth-wrapper"),
        contentTop: content ? Math.round(content.getBoundingClientRect().top) : null,
        navText: [...document.querySelectorAll(".nav-entry")].map((n) => n.textContent.trim()),
        hash: location.hash,
      };
    });

  const probe = (label, data) =>
    console.log(`DIAG ${label} ${JSON.stringify(data)}`);

  probe("before-click", await snap());

  await page.locator(".nav-entry").last().click();

  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(500);
    probe(`t+${(i + 1) * 500}ms`, await snap());
  }
});
