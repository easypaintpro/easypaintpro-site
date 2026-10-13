const APP_STORE_URL = "";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// App Store buttons: link when the listing exists, otherwise a short notice.
const toast = document.querySelector(".toast");
let toastTimer;
document.querySelectorAll(".app-store-link").forEach((button) => {
  button.addEventListener("click", () => {
    if (APP_STORE_URL) { window.location.href = APP_STORE_URL; return; }
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
  });
});

// Generic tab lists: each tablist controls only its own panels.
function selectTab(tab, focus = false) {
  const list = tab.closest('[role="tablist"]');
  [...list.querySelectorAll('[role="tab"]')].forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    const id = t.getAttribute("aria-controls");
    if (id) { const panel = document.getElementById(id); if (panel) panel.hidden = !on; }
  });
  if (focus) tab.focus();
  tab.dispatchEvent(new CustomEvent("tabselect", { bubbles: true }));
}
document.querySelectorAll('[role="tablist"]').forEach((list) => {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (e) => {
      const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      selectTab(tabs[(keys[e.key] + tabs.length) % tabs.length], true);
    });
  });
});
document.querySelectorAll("[data-legal-tab]").forEach((link) => {
  link.addEventListener("click", () => {
    const tab = document.getElementById(link.dataset.legalTab);
    if (tab) selectTab(tab);
  });
});

// Hero skin switcher: swap the screenshot once the next image has loaded.
const skinImage = document.getElementById("skin-image");
const skinFrame = skinImage?.closest(".window");
document.querySelectorAll(".skin-tabs [role='tab']").forEach((tab) => {
  // Warm the cache so switching feels instant.
  const pre = new Image(); pre.src = tab.dataset.src;
  tab.addEventListener("tabselect", () => {
    if (skinImage.getAttribute("src") === tab.dataset.src) return;
    skinFrame.classList.add("is-switching");
    const next = new Image();
    next.onload = () => {
      skinImage.src = tab.dataset.src;
      skinImage.alt = tab.dataset.alt;
      skinFrame.classList.remove("is-switching");
    };
    next.onerror = () => skinFrame.classList.remove("is-switching");
    next.src = tab.dataset.src;
  });
});

// Step-by-step demos stay still until the viewer presses Play.
document.querySelectorAll(".demo-media").forEach((media) => {
  const img = media.querySelector("img");
  const button = media.querySelector(".demo-play");
  button.addEventListener("click", () => {
    const playing = button.getAttribute("aria-pressed") === "true";
    img.src = playing ? img.dataset.poster : img.dataset.gif;
    button.setAttribute("aria-pressed", String(!playing));
    button.textContent = playing ? "Play steps" : "Stop";
  });
});

// Zoom recording: play when visible, unless the viewer prefers reduced motion.
document.querySelectorAll(".grow-card video").forEach((video) => {
  if (reduceMotion.matches) { video.controls = true; return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) video.play().catch(() => { video.controls = true; });
      else video.pause();
    });
  }, { threshold: 0.4 });
  io.observe(video);
});

const year = document.getElementById("copyright-year");
if (year) year.textContent = new Date().getFullYear();
