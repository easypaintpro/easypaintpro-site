// ---- Sales links: fill these in as each one goes live -----------------------
// DOWNLOAD_URL: the notarized .dmg (GitHub release asset on this repository).
// APP_STORE_URL: the Mac App Store listing.
// While a value is empty, its buttons show a short notice instead of a dead link.
const DOWNLOAD_URL = "https://github.com/easypaintpro/easypaintpro-site/releases/latest/download/EasyPaintPro.dmg";
const APP_STORE_URL = "";
// Paddle checkout (live). The client-side token is public by design: it can only
// open checkouts. Paddle.js loads only when someone chooses Buy.
const PADDLE_TOKEN = "live_57e942cd69dce4a4ee60057fa73";
const PADDLE_PRICE_ID = "pri_01m4yftx05h43r750bq0m3e3zf";
const LICENSE_API = "https://us-central1-easy-paint-pro.cloudfunctions.net/license";
// Web3Forms access key for the contact form. Messages go to the inbox tied to this key;
// the address itself never appears on the site. Replace when the key is ready.
const WEB3FORMS_KEY = "ffe1ef29-6b18-4dd0-accf-be2bf1bd9cf3";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const SALES = {
  download: { url: DOWNLOAD_URL, title: "The download is almost ready.", body: "The free 7-day trial will be available here very soon." },
  "app-store": { url: APP_STORE_URL, title: "Coming soon to the Mac App Store.", body: "You can download Easy Paint Pro from this website today." },
};
const toast = document.querySelector(".toast");
let toastTimer;
const showToast = (title, body) => {
  if (!toast) return;
  toast.querySelector("strong").textContent = title;
  toast.querySelector("span").textContent = body;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
};
// ---- Buying: Paddle overlay checkout, then the thank-you page shows the key ----
const ORDER_KEY = "epp-order";
let paddleReady;
function loadPaddle() {
  paddleReady ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      window.Paddle.Initialize({ token: PADDLE_TOKEN, eventCallback: onPaddleEvent });
      resolve(window.Paddle);
    };
    script.onerror = () => { paddleReady = undefined; script.remove(); reject(new Error("Paddle.js didn't load")); };
    document.head.append(script);
  });
  return paddleReady;
}
function onPaddleEvent(event) {
  if (event?.name !== "checkout.completed") return;
  const txn = event.data?.transaction_id;
  if (typeof txn !== "string" || !/^txn_[a-z0-9]+$/.test(txn)) return;
  let stored = false;
  try { sessionStorage.setItem(ORDER_KEY, txn); stored = true; } catch { /* private mode */ }
  try { window.Paddle.Checkout.close(); } catch { /* already closed */ }
  // The order number stays in this browser: it's never sent to this website's host.
  location.assign(stored ? "/thanks/" : `/thanks/#${txn}`);
}
async function openCheckout(button) {
  button.setAttribute("aria-busy", "true");
  try {
    const paddle = await loadPaddle();
    paddle.Checkout.open({
      items: [{ priceId: PADDLE_PRICE_ID, quantity: 1 }],
      settings: { displayMode: "overlay", theme: "light", allowLogout: true },
    });
  } catch {
    showToast("Checkout didn’t open.", "Check your internet connection and try again.");
  } finally {
    button.removeAttribute("aria-busy");
  }
}
document.querySelectorAll('[data-sales="buy"]').forEach((el) => {
  el.addEventListener("click", (e) => { e.preventDefault(); openCheckout(el); });
});
// Paddle payment links (…?_ptxn=txn_…) open their checkout once Paddle.js starts.
if (new URLSearchParams(location.search).has("_ptxn")) loadPaddle().catch(() => {});

// ---- Thank-you page: fetch the new key from the license server -----------------
const licenseCard = document.getElementById("license-card");
if (licenseCard) {
  const status = document.getElementById("key-status");
  const ready = document.getElementById("key-ready");
  const keyBox = document.getElementById("license-key");
  const meta = document.getElementById("key-meta");
  const copyButton = document.getElementById("copy-key");
  const copyStatus = document.getElementById("copy-status");
  let txn = location.hash.slice(1);
  try { txn = sessionStorage.getItem(ORDER_KEY) || txn; } catch { /* private mode */ }
  const emailHelp = "If it isn’t in your inbox in a few minutes, check your spam folder or contact us.";

  const finish = (text) => { status.textContent = text; };
  const showKey = (result) => {
    keyBox.value = result.key;
    meta.textContent = `Licensed to ${result.name}. We also emailed it to ${result.email}. Keep that email: it’s your proof of purchase.`;
    ready.hidden = false;
    const fit = () => { keyBox.style.height = "auto"; keyBox.style.height = `${keyBox.scrollHeight + 2}px`; };
    fit();
    addEventListener("resize", fit);
    finish("Here’s your license key. Copy it, then paste it into Easy Paint Pro.");
  };
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(keyBox.value);
      copyStatus.textContent = "Copied.";
    } catch {
      keyBox.focus();
      keyBox.select();
      copyStatus.textContent = "Selected. Press ⌘C to copy.";
    }
  });

  if (!/^txn_[a-z0-9]+$/.test(txn)) {
    finish(`Your license key is on its way to your email. ${emailHelp}`);
  } else {
    const waits = [800, 1200, 1500, 2000, 2000, 3000, 3000, 4000, 5000, 5000, 5000, 8000, 10000, 10000, 15000];
    const poll = async (attempt) => {
      try {
        const response = await fetch(`${LICENSE_API}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txn }),
        });
        const result = await response.json();
        if (result.ok && typeof result.key === "string") { showKey(result); return; }
        if (result.error === "revoked") { finish("This order was refunded, so its license key no longer works."); return; }
        if (result.error === "expired" || result.error === "invalid") { finish(`Your license key is in the email we sent you. ${emailHelp}`); return; }
      } catch { /* offline or server busy: keep trying */ }
      if (attempt < waits.length) setTimeout(() => poll(attempt + 1), waits[attempt]);
      else finish(`This is taking longer than usual. Your key will arrive by email within a few minutes. ${emailHelp} Your order number is ${txn}.`);
    };
    poll(0);
  }
}

document.querySelectorAll("[data-sales]").forEach((el) => {
  const item = SALES[el.dataset.sales];
  if (!item) return;
  if (item.url && el.tagName === "A") { el.href = item.url; return; }
  el.addEventListener("click", (e) => {
    if (item.url) { window.location.href = item.url; return; }
    e.preventDefault();
    showToast(item.title, item.body);
  });
});

// Tab lists: each tablist controls only its own panels.
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

// Small storage helpers: settings are a convenience, so failures are ignored.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  sset(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};
const root = document.documentElement;
const mqDark = window.matchMedia("(prefers-color-scheme: dark)");
const systemTheme = () => (mqDark.matches ? "dark" : "light");
const effectiveTheme = () => root.dataset.theme || systemTheme();

// Hero skin switcher: swap the screenshot once the next image has loaded.
const skinImage = document.getElementById("skin-image");
const skinFrame = skinImage?.closest(".window");
const skinSource = document.getElementById("skin-dark-source");
let skinChosenByVisitor = false;
let skinShow = null; // theme slideshow, set up below
if (skinImage) {
  // The <picture> already shows Modern Day or Night to match the system look.
  const shown = skinSource && systemTheme() === "dark" ? "skin-modern-night" : "skin-modern-day";
  skinImage.dataset.full = document.getElementById(shown).dataset.src;
}
document.querySelectorAll(".skin-tabs [role='tab']").forEach((tab) => {
  tab.addEventListener("click", () => { skinChosenByVisitor = true; skinShow?.stop(); });
  tab.addEventListener("keydown", (e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { skinChosenByVisitor = true; skinShow?.stop(); } });
  tab.addEventListener("tabselect", () => {
    if (skinImage.dataset.full === tab.dataset.src) return;
    if (skinShow?.isPlaying()) {
      // Slideshow frames are preloaded, so swap straight away with no fade.
      skinSource?.remove();
      skinImage.srcset = tab.dataset.srcset || "";
      skinImage.src = tab.dataset.src;
      skinImage.dataset.full = tab.dataset.src;
      skinImage.alt = tab.dataset.alt;
      return;
    }
    skinFrame.classList.add("is-switching");
    const next = new Image();
    next.sizes = skinImage.sizes;
    next.srcset = tab.dataset.srcset || "";
    next.onload = () => {
      skinSource?.remove();
      skinImage.srcset = tab.dataset.srcset || "";
      skinImage.src = tab.dataset.src;
      skinImage.dataset.full = tab.dataset.src;
      skinImage.alt = tab.dataset.alt;
      skinFrame.classList.remove("is-switching");
    };
    next.onerror = () => skinFrame.classList.remove("is-switching");
    next.src = tab.dataset.src;
  });
});
// Until the visitor picks a look, the hero follows Day/Night.
function syncHeroSkin() {
  if (!skinImage || skinChosenByVisitor || skinShow?.isPlaying()) return;
  const tab = document.getElementById(effectiveTheme() === "dark" ? "skin-modern-night" : "skin-modern-day");
  if (tab) selectTab(tab);
}

// Day / Night: follows the Mac until the visitor changes it.
const themeColors = { light: "#f6f7f9", dark: "#1c1e2a" };
function applyThemeChrome() {
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((m) => {
    const forced = root.dataset.theme;
    m.content = forced ? themeColors[forced] : (m.media.includes("dark") ? themeColors.dark : themeColors.light);
  });
  syncHeroSkin();
  syncReadingPanel();
}
function setTheme(mode) {
  if (mode === "light" || mode === "dark") { root.dataset.theme = mode; store.set("epp-theme", mode); }
  else { delete root.dataset.theme; store.set("epp-theme", null); }
  applyThemeChrome();
}
document.querySelectorAll(".theme-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = effectiveTheme() === "dark" ? "light" : "dark";
    // Going back to what the Mac shows means "follow my Mac" again.
    setTheme(target === systemTheme() ? "system" : target);
  });
});
mqDark.addEventListener("change", applyThemeChrome);

// Text size and reading font
const LEXEND_URL = "https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;700&display=swap";
function loadLexend() {
  if (document.getElementById("lexend-css")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet"; link.id = "lexend-css"; link.href = LEXEND_URL;
  document.head.appendChild(link);
}
function setFont(value) {
  if (value) { root.dataset.font = value; store.set("epp-font", value); if (value === "lexend") loadLexend(); }
  else { delete root.dataset.font; store.set("epp-font", null); }
}
function setSize(value) {
  if (value && value !== "1") { root.style.setProperty("--text-scale", value); store.set("epp-size", value); }
  else { root.style.removeProperty("--text-scale"); store.set("epp-size", null); }
}
const panel = document.getElementById("reading-panel");
function syncReadingPanel() {
  if (!panel) return;
  const check = (name, value) => { const input = panel.querySelector(`input[name="${name}"][value="${value}"]`); if (input) input.checked = true; };
  check("rp-theme", root.dataset.theme || "system");
  check("rp-size", root.style.getPropertyValue("--text-scale").trim() || "1");
  check("rp-font", root.dataset.font || "");
}
if (panel) {
  panel.addEventListener("change", (e) => {
    const { name, value } = e.target;
    if (name === "rp-theme") setTheme(value);
    if (name === "rp-size") setSize(value);
    if (name === "rp-font") setFont(value);
  });
  panel.querySelector("[data-reading-reset]")?.addEventListener("click", () => {
    setTheme("system"); setSize("1"); setFont("");
    syncReadingPanel();
  });
  panel.addEventListener("toggle", (e) => { if (e.newState === "open") { loadLexend(); syncReadingPanel(); } });
  // Older browsers without the Popover API: open and close it by hand.
  if (!("popover" in HTMLElement.prototype)) {
    const open = (on) => { panel.classList.toggle("is-open", on); if (on) { loadLexend(); syncReadingPanel(); } };
    document.querySelectorAll('[popovertarget="reading-panel"]').forEach((b) => {
      b.addEventListener("click", (e) => { e.stopPropagation(); open(b.getAttribute("popovertargetaction") === "hide" ? false : !panel.classList.contains("is-open")); });
    });
    document.addEventListener("click", (e) => { if (!panel.contains(e.target)) open(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") open(false); });
  }
  syncReadingPanel();
}
// Keep several open tabs in step.
window.addEventListener("storage", (e) => {
  if (e.key === "epp-theme") { e.newValue ? (root.dataset.theme = e.newValue) : delete root.dataset.theme; applyThemeChrome(); }
  if (e.key === "epp-font") { e.newValue ? (root.dataset.font = e.newValue) : delete root.dataset.font; if (e.newValue === "lexend") loadLexend(); syncReadingPanel(); }
  if (e.key === "epp-size") { e.newValue ? root.style.setProperty("--text-scale", e.newValue) : root.style.removeProperty("--text-scale"); syncReadingPanel(); }
});
// Theme slideshow: the hero cycles through the app's looks every half second.
const playButton = document.querySelector(".skin-play");
if (skinImage && playButton) {
  const SKIN_MS = 500;
  const stage = skinImage.closest(".stage");
  const tabs = [...document.querySelectorAll(".skin-tabs [role='tab']")];
  const label = playButton.querySelector(".skin-play-label");
  let wanted = !reduceMotion.matches; // what the visitor asked for
  let timer = null, ready = false, onScreen = true;
  const running = () => timer !== null;
  const advance = () => {
    const current = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    selectTab(tabs[(current + 1) % tabs.length]);
  };
  const update = () => {
    const shouldRun = wanted && ready && onScreen && !document.hidden;
    if (shouldRun && !running()) timer = setInterval(advance, SKIN_MS);
    if (!shouldRun && running()) { clearInterval(timer); timer = null; }
    stage.classList.toggle("is-playing", running());
    playButton.setAttribute("aria-pressed", String(wanted));
    label.textContent = wanted ? "Pause" : "Play";
    playButton.setAttribute("aria-label", wanted ? "Pause the theme slideshow" : "Play the theme slideshow");
  };
  skinShow = {
    isPlaying: () => wanted,
    stop() { wanted = false; update(); },
  };
  playButton.addEventListener("click", () => {
    wanted = !wanted;
    // Pausing keeps the look on screen, as if the visitor had picked it.
    skinChosenByVisitor = !wanted;
    update();
  });
  // Load every look first so the swaps are instant.
  const preload = () => Promise.all(tabs.map((t) => {
    const im = new Image();
    im.sizes = skinImage.sizes;
    im.srcset = t.dataset.srcset || "";
    im.src = t.dataset.src;
    return im.decode().catch(() => {});
  }));
  const start = () => preload().then(() => { ready = true; update(); });
  if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; update(); }, { threshold: 0.2 }).observe(skinImage);
  document.addEventListener("visibilitychange", update);
  update();
}

applyThemeChrome();

// Keep the header on one line when big text or a wide font would wrap it.
const nav = document.querySelector(".nav");
if (nav) {
  const fitNav = () => {
    nav.classList.remove("is-compact");
    const links = nav.querySelector(".nav-links");
    const wraps = links && getComputedStyle(links).display !== "none" && (nav.scrollWidth > nav.clientWidth + 1 || links.getBoundingClientRect().height > 48 || nav.querySelector(".brand").getBoundingClientRect().height > 48);
    nav.classList.toggle("is-compact", !!wraps);
  };
  new ResizeObserver(fitNav).observe(document.documentElement);
  new MutationObserver(fitNav).observe(root, { attributes: true, attributeFilter: ["data-font", "style"] });
  document.fonts?.ready.then(fitNav);
  fitNav();
}

// Paintbrush reminder: appears once the visitor scrolls past the first screen.
const nudge = document.getElementById("brush-nudge");
if (nudge) {
  const brush = nudge.querySelector(".nudge-brush");
  let tucked = store.sget("epp-nudge") === "tucked";
  const blockers = new Set();
  const render = () => {
    const show = window.scrollY > window.innerHeight * 0.9 && blockers.size === 0;
    nudge.classList.toggle("is-shown", show);
    if (show && !wasShown && !tucked) armAutoTuck();
    wasShown = show;
    nudge.classList.toggle("is-tucked", tucked);
    brush.setAttribute("aria-expanded", String(!tucked));
    brush.setAttribute("aria-label", tucked ? "Show the reminder again" : "Hide the reminder");
  };
  nudge.hidden = false;
  // After a while the bubble folds away and just the brush stays. Tap it to open again.
  let autoTuck;
  const armAutoTuck = () => { clearTimeout(autoTuck); autoTuck = setTimeout(() => { if (!tucked && nudge.classList.contains("is-shown") && !nudge.matches(":hover, :focus-within")) { tucked = true; render(); } }, 10000); };
  let wasShown = false;
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; render(); });
  }, { passive: true });
  // Step aside where the page already asks people to try it.
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => (en.isIntersecting ? blockers.add(en.target) : blockers.delete(en.target)));
    render();
  }, { threshold: 0.15 });
  document.querySelectorAll("#pricing, .final, footer").forEach((el) => io.observe(el));
  nudge.querySelector(".nudge-close").addEventListener("click", () => { tucked = true; store.sset("epp-nudge", "tucked"); render(); brush.focus(); });
  brush.addEventListener("click", () => { tucked = !tucked; store.sset("epp-nudge", tucked ? "tucked" : "open"); render(); if (!tucked) armAutoTuck(); });
  render();
}

// Lightbox: click any screenshot to see it full size.
const lightbox = document.getElementById("lightbox");
if (lightbox) {
  const lbImg = lightbox.querySelector("img");
  const lbCap = lightbox.querySelector("figcaption");
  document.addEventListener("click", (e) => {
    const img = e.target.closest("img.zoomable");
    if (!img) return;
    lbImg.src = img.dataset.full || img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = img.alt;
    lightbox.showModal();
  });
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.closest("[data-close]") || e.target === lbImg) lightbox.close();
  });
  lightbox.addEventListener("close", () => { lbImg.removeAttribute("src"); });
}

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

// Contact form
const form = document.getElementById("contact-form");
if (form) {
  const status = document.getElementById("form-status");
  const licenseFields = document.getElementById("license-fields");
  const submit = form.querySelector('button[type="submit"]');
  const topicInputs = [...form.querySelectorAll('input[name="topic"]')];
  const isLicense = (v) => v === "School or educator license" || v === "Business license";

  const syncTopic = () => {
    const v = form.querySelector('input[name="topic"]:checked')?.value || "";
    const show = isLicense(v);
    licenseFields.hidden = !show;
    licenseFields.querySelectorAll("input").forEach((i) => { i.required = show && i.dataset.required === "true"; });
  };
  topicInputs.forEach((i) => i.addEventListener("change", syncTopic));
  const param = new URLSearchParams(location.search).get("topic");
  if (param) {
    const map = { education: "School or educator license", business: "Business license", support: "Help with the app", press: "Press" };
    const match = topicInputs.find((i) => i.value === map[param]);
    if (match) match.checked = true;
  }
  syncTopic();

  const show = (kind, text) => { status.hidden = false; status.className = `form-status ${kind}`; status.textContent = text; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (!WEB3FORMS_KEY || WEB3FORMS_KEY.startsWith("YOUR_")) {
      show("err", "The contact form isn’t connected yet. Please check back soon.");
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    if (data.botcheck) return;
    data.access_key = WEB3FORMS_KEY;
    data.subject = `Easy Paint Pro: ${data.topic || "Message"}`;
    data.from_name = "easypaintpro.com";
    submit.disabled = true;
    submit.textContent = "Sending…";
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        form.reset(); syncTopic();
        show("ok", "Thanks, your message was sent. We’ll reply to the email you gave.");
      } else {
        show("err", "Your message didn’t send. Please try again in a minute.");
      }
    } catch {
      show("err", "Your message didn’t send. Check your connection and try again.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Send message";
    }
  });
}

const year = document.getElementById("copyright-year");
if (year) year.textContent = new Date().getFullYear();
