// Ritual V3 — app.js (Phase B1)
// Purpose: navigation + swipe only (moved out of index.html)

const pages = ["today","calendar","score","settings"];
let idx = 0;

const pager = document.getElementById("pager");
const topTitle = document.getElementById("topTitle");
const topSub = document.getElementById("topSub");
const pillDate = document.getElementById("pillDate");

function pad2(n){ return String(n).padStart(2,"0"); }
function todayKey(){
  const d=new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

if (pillDate) pillDate.textContent = `Date: ${todayKey()}`;

function setHeader(i){
  const name = pages[i];
  topTitle.textContent =
    name==="today" ? "Today" :
    name==="calendar" ? "Calendar" :
    name==="score" ? "Score" : "Settings";

  topSub.textContent = "Ritual • V3";
}

function setActive(i){
  document.querySelectorAll(".tab").forEach(t=>{
    t.classList.toggle("active", t.dataset.tab === pages[i]);
  });
  setHeader(i);
}

function goTo(i, smooth=true){
  idx = Math.max(0, Math.min(pages.length-1, i)); // NO LOOP
  pager.scrollTo({ left: idx * pager.clientWidth, behavior: smooth ? "smooth" : "auto" });
  setActive(idx);
}

// Tap tabs
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>goTo(pages.indexOf(btn.dataset.tab)));
});

// Swipe between tabs (no loop)
let startX=0, startY=0, active=false;
const EDGE=20, SWIPE=60, VERT=12;

pager.addEventListener("touchstart",(e)=>{
  if(!e.touches || e.touches.length!==1) return;
  const t=e.touches[0];
  if(t.clientX < EDGE || t.clientX > window.innerWidth-EDGE){ active=false; return; }
  startX=t.clientX; startY=t.clientY; active=true;
},{passive:true});

pager.addEventListener("touchmove",(e)=>{
  if(!active || !e.touches || e.touches.length!==1) return;
  const t=e.touches[0];
  if(Math.abs(t.clientY-startY) > VERT) active=false;
},{passive:true});

pager.addEventListener("touchend",(e)=>{
  if(!active) return;
  active=false;
  const t=e.changedTouches && e.changedTouches[0];
  if(!t) return;

  const dx=t.clientX-startX;
  if(Math.abs(dx) < SWIPE) return;

  if(dx < 0 && idx < pages.length-1) goTo(idx+1);
  if(dx > 0 && idx > 0) goTo(idx-1);
},{passive:true});

window.addEventListener("resize", ()=>goTo(idx,false));

// init
goTo(0,false);
