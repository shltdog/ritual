// Ritual V3 — router.js (RC1 COMPAT)
// Compatibility router (safe even if unused).
// Routes screen names to the RC1 renderers.

import { renderToday } from "./today.js";
import { renderCalendar } from "./calendar.js";
import { renderScore } from "./score.js";
import { renderSettings } from "./settings.js";
import { debugLog } from "./store.js";

export async function routeTo(name, rootEl) {
  try {
    if (!rootEl) return;

    if (name === "today") return await renderToday(rootEl);
    if (name === "calendar") return await renderCalendar(rootEl);
    if (name === "score") return await renderScore(rootEl);
    if (name === "settings") return await renderSettings(rootEl);

    // default
    return await renderToday(rootEl);
  } catch (e) {
    await debugLog(`router:error ${String(e?.message || e)}`);
  }
}

export const ROUTES = ["today", "calendar", "score", "settings"];