// router.js

const tabs = ['today', 'calendar', 'score', 'settings'];
let activeTabIndex = 0;

function getActiveTab() {
  return tabs[activeTabIndex];
}

function goTo(tabName) {
  const index = tabs.indexOf(tabName);
  if (index !== -1) {
    activeTabIndex = index;
    updateTabUI();
  }
}

function goNext() {
  if (activeTabIndex < tabs.length - 1) {
    activeTabIndex++;
    updateTabUI();
  }
}

function goPrev() {
  if (activeTabIndex > 0) {
    activeTabIndex--;
    updateTabUI();
  }
}

function updateTabUI() {
  tabs.forEach((tab, idx) => {
    const page = document.getElementById(tab);
    const tabBtn = document.querySelector(`.tab-item[data-tab="${tab}"]`);
    if (page) page.classList.toggle('hidden', idx !== activeTabIndex);
    if (tabBtn) tabBtn.classList.toggle('active', idx === activeTabIndex);

    // Update image source based on active tab
    if (tabBtn) {
      const img = tabBtn.querySelector('img');
      if (img) {
        let src = '';
        switch (tab) {
          case 'today':
            src = 'images/tab/tab-calendar.png';
            break;
          case 'calendar':
            src = 'images/tab/tab-calendar.png';
            break;
          case 'score':
            src = 'images/tab/tab-score.png';
            break;
          case 'settings':
            src = 'images/tab/tab-settings.png';
            break;
        }
        img.src = src;
      }
    }
  });
}

function isInteractiveElement(el) {
  return el.closest('button, input, textarea, .task-item') !== null;
}

function setupTabClicks() {
  const tabButtons = document.querySelectorAll('.tab-item');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-tab');
      goTo(tab);
    });
  });
}

function setupSwipeNavigation() {
  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  document.addEventListener('touchstart', e => {
    if (isInteractiveElement(e.target)) return;
    if (e.touches.length !== 1) return;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = true;
  });

  document.addEventListener('touchmove', e => {
    if (!isSwiping) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (Math.abs(dy) > Math.abs(dx)) {
      isSwiping = false;
    }
  });

  document.addEventListener('touchend', e => {
    if (!isSwiping) return;

    const endX = e.changedTouches[0].clientX;
    const deltaX = endX - startX;

    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }

    isSwiping = false;
  });
}

function initRouter() {
  setupTabClicks();
  setupSwipeNavigation();
  updateTabUI();
}

document.addEventListener('DOMContentLoaded', initRouter);

export { goTo, goNext, goPrev, getActiveTab };