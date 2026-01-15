// ======================================================
// Ritual v3 — main.js
// Central navigation + app bootstrap
// ======================================================

import { store } from "./store.js"
import { renderToday } from "./today.js"
import { renderCalendar } from "./calendar.js"
import { renderScore } from "./score.js"
import { renderSettings } from "./settings.js"

// ------------------------------------------------------
// DOM REFERENCES (REQUIRED IN index.html)
// ------------------------------------------------------

const screens = {
  today: document.getElementById("screenToday"),
  calendar: document.getElementById("screenCalendar"),
  score: document.getElementById("screenScore"),
  settings: document.getElementById("screenSettings")
}

const navButtons = document.querySelectorAll("[data-nav]")
const topTitle = document.getElementById("topTitle")
const topSub = document.getElementById("topSub")
const pager = document.getElementById("pager")
const debugOverlay = document.getElementById("debugOverlay")

// ------------------------------------------------------
// APP STATE
// ------------------------------------------------------

let currentScreen = "today"

// ------------------------------------------------------
// INITIAL BOOT
// ------------------------------------------------------

function boot() {
  store.load()

  renderAll()
  bindNav()
  navigate("today", false)

  if (debugOverlay) {
    debugOverlay.style.display = store.debugEnabled ? "block" : "none"
  }

  console.log("Ritual v3 booted")
}

// ------------------------------------------------------
// NAVIGATION
// ------------------------------------------------------

function bindNav() {
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav
      navigate(target)
    })
  })
}

function navigate(target, animate = true) {
  if (!screens[target]) return

  currentScreen = target

  // Update nav active state
  navButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.nav === target)
  })

  // Hide all screens
  Object.values(screens).forEach(s => s.classList.remove("active"))

  // Show target
  screens[target].classList.add("active")

  // Pager transform (swipe feel)
  if (animate && pager) {
    const index = Object.keys(screens).indexOf(target)
    pager.style.transform = `translateX(-${index * 100}%)`
  }

  updateHeader(target)
  renderScreen(target)
}

// ------------------------------------------------------
// HEADER
// ------------------------------------------------------

function updateHeader(screen) {
  switch (screen) {
    case "today":
      topTitle.textContent = "Today"
      topSub.textContent = store.todayKey
      break

    case "calendar":
      topTitle.textContent = "Calendar"
      topSub.textContent = ""
      break

    case "score":
      topTitle.textContent = "Score"
      topSub.textContent = `Level: ${store.currentLevel.title}`
      break

    case "settings":
      topTitle.textContent = "Settings"
      topSub.textContent = ""
      break
  }
}

// ------------------------------------------------------
// RENDERING
// ------------------------------------------------------

function renderAll() {
  renderToday(screens.today)
  renderCalendar(screens.calendar)
  renderScore(screens.score)
  renderSettings(screens.settings)
}

function renderScreen(screen) {
  switch (screen) {
    case "today":
      renderToday(screens.today)
      break
    case "calendar":
      renderCalendar(screens.calendar)
      break
    case "score":
      renderScore(screens.score)
      break
    case "settings":
      renderSettings(screens.settings)
      break
  }
}

// ------------------------------------------------------
// SWIPE NAVIGATION (NATURAL FEEL)
// ------------------------------------------------------

let touchStartX = 0
let touchEndX = 0

pager.addEventListener("touchstart", e => {
  touchStartX = e.changedTouches[0].screenX
})

pager.addEventListener("touchend", e => {
  touchEndX = e.changedTouches[0].screenX
  handleSwipe()
})

function handleSwipe() {
  const delta = touchEndX - touchStartX
  if (Math.abs(delta) < 60) return

  const order = ["today", "calendar", "score", "settings"]
  let idx = order.indexOf(currentScreen)

  if (delta < 0 && idx < order.length - 1) {
    navigate(order[idx + 1])
  } else if (delta > 0 && idx > 0) {
    navigate(order[idx - 1])
  }
}

// ------------------------------------------------------
// DEBUG OVERLAY (SAFE, NON-BLOCKING)
// ------------------------------------------------------

if (debugOverlay) {
  debugOverlay.addEventListener("click", () => {
    debugOverlay.classList.toggle("collapsed")
  })
}

// ------------------------------------------------------
// BOOT
// ------------------------------------------------------

boot()