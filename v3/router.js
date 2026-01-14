// Ritual V3 — router.js
// One job: render the correct screen into a root container.
// We’ll wire this into index.html when we do the final replacement.

import { renderToday } from "./today.js";
import { renderCalendar } from "./calendar.js";
import { renderScore } from "./score.js";
import { renderSettings } from "./settings.js";
import { renderTemplates } from "./templates.js";

export const ROUTES = {
  today: { title: "Today", render: renderToday },
  calendar: { title: "Calendar", render: renderCalendar },
  score: { title: "Score", render: renderScore },
  settings: { title: "Settings", render: renderSettings },
};

export async function routeTo(pageName, rootEl) {
  const r = ROUTES[pageName] || ROUTES.today;
  await r.render(rootEl);
}

// Optional modal/screen routing for templates
export async function openTemplates(rootEl) {
  await renderTemplates(rootEl);
}
