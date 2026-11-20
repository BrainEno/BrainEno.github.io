"use client";

import { useSyncExternalStore } from "react";
import type { Language } from "../content/types";

const key = "pf-lang";
const changed = "pf-language-change";
let memory: Language | null = null;
function read(): Language | null {
  if (memory) return memory;
  try {
    const value = window.localStorage.getItem(key);
    return value === "zh" || value === "en" ? value : null;
  } catch {
    return null;
  }
}
function subscribe(notify: () => void) {
  window.addEventListener(changed, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(changed, notify);
    window.removeEventListener("storage", notify);
  };
}
export function changeLanguage(next: Language) {
  try {
    window.localStorage.setItem(key, next);
    memory = null;
  } catch {
    memory = next;
  }
  window.dispatchEvent(new Event(changed));
}
export function useLanguage(defaultLanguage: Language) {
  return useSyncExternalStore(subscribe, read, () => null) ?? defaultLanguage;
}
