"use client";

import { useEffect } from "react";

import { BASE_PATH } from "../seo/asset";

/**
 * Registers `<base>/sw.js` (offline cache) in production builds. In `next dev`
 * any previously installed worker is removed so stale caches never mask edits.
 *
 * Both the script URL and the scope carry the base path: on a GitHub Pages
 * project site the site lives under `/repo/`, and a worker registered at the
 * origin root would be 404 (and, if it existed, would take over the whole
 * `*.github.io` origin, including other projects).
 */
export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      const scope = new URL(`${BASE_PATH}/`, location.origin).href;
      void navigator.serviceWorker.getRegistration(scope).then((reg) => {
        if (reg?.scope === scope) return reg.unregister();
      }).catch(() => undefined);
      return;
    }
    const register = () =>
      void navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
