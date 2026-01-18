// Ritual V3 — main.js (RC1 GLUE)
// Wires screens + tabs + swipe + theme + recurring prompt once/day.

import { getSettings } from "./store.js";
import { renderToday } from "./today.js";
import { renderCalendar } from "./calendar.js";
import { renderScore } from "./score.js";
import { renderSettings } from "./settings.js";
import { maybePromptRecurringForToday } from "./templates.js";

const pages = ["today", "calendar", "score", "settings"];
let idx = 0;

const pager = document.getElementById("pager");
const topTitle = document.getElementById("topTitle");
const topSub = document.getElementById("topSub");

const roots = {
  today: document.getElementById("screenToday"),
  calendar: document.getElementById("screenCalendar"),
  score: document.getElementById("screenScore"),
  settings: document.getElementById("screenSettings"),
};

// ---------- Theme ----------
function applyAccentCSS(accentKey) {
  const map = {
    red: "#ef4444",
    ember: "#f97316",
    orange: "#f59e0b",
    pink: "#ec4899",
    purple: "#a855f7",
    blue: "#3b82f6",
    green: "#22c55e",
  };
  const val = map[String(accentKey || "red").toLowerCase()] || map.red;
  document.documentElement.style.setProperty("--accent", val);
}

async function applyThemeFromSettings() {
  const s = await getSettings();
  applyAccentCSS(s.accent || "red");
}

// ---------- Header ----------
function setHeader(name) {
  topTitle.textContent =
    name === "today" ? "Today" :
    name === "calendar" ? "Calendar" :
    name === "score" ? "Score" : "Settings";

  topSub.textContent = "Ritual • V3";
}

function setActiveTab(name) {
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  setHeader(name);
}

// ---------- Render ----------
async function renderPage(name) {
  // Ensure scroll space
  Object.values(roots).forEach(el => {
    if (!el) return;
    el.style.minHeight = "1px";
  });

  if (name === "today") return renderToday(roots.today);
  if (name === "calendar") return renderCalendar(roots.calendar);
  if (name === "score") return renderScore(roots.score);
  if (name === "settings") return renderSettings(roots.settings);
}

async function goTo(i, smooth = true) {
  idx = Math.max(0, Math.min(pages.length - 1, i));
  const name = pages[idx];

  if (pager) {
    pager.scrollTo({ left: idx * pager.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }

  setActiveTab(name);
  await renderPage(name);
}

// ---------- Tabs ----------
function wireTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.tab;
      const i = pages.indexOf(name);
      if (i >= 0) goTo(i, true);
    });
  });
}

// ---------- Swipe ----------
function wireSwipe() {
  if (!pager) return;

  let startX = 0, startY = 0, active = false;
  const EDGE = 20, SWIPE = 60, VERT = 12;

  pager.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) { active = false; return; }
    startX = t.clientX;
    startY = t.clientY;
    active = true;
  }, { passive: true });

  pager.addEventListener("touchmove", (e) => {
    if (!active || !e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (Math.abs(t.clientY - startY) > VERT) active = false;
  }, { passive: true });

  pager.addEventListener("touchend", (e) => {
    if (!active) return;
    active = false;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - startX;
    if (Math.abs(dx) < SWIPE) return;

    if (dx < 0 && idx < pages.length - 1) goTo(idx + 1, true);
    if (dx > 0 && idx > 0) goTo(idx - 1, true);
  }, { passive: true });

  window.addEventListener("resize", () => goTo(idx, false));
}

// ---------- Boot ----------
async function boot() {
  // Apply accent
  await applyThemeFromSettings();

  // Wire UI
  wireTabs();
  wireSwipe();

  // Initial render
  await goTo(0, false);

  // Recurring prompt once/day (X-only close behavior already built in templates.js)
  try {
    await maybePromptRecurringForToday();
  } catch (e) {
    // keep silent; app should still run
    console.warn("Recurring prompt failed", e);
  }
}

boot();