const APP_STORE_URL = "";
// Web3Forms access key for the contact form. Messages go to the inbox tied to this key;
// the address itself never appears on the site. Replace when the key is ready.
const WEB3FORMS_KEY = "ffe1ef29-6b18-4dd0-accf-be2bf1bd9cf3";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// App Store buttons: link when the listing exists, otherwise a short notice.
const toast = document.querySelector(".toast");
let toastTimer;
document.querySelectorAll(".app-store-link").forEach((button) => {
  button.addEventListener("click", () => {
    if (APP_STORE_URL) { window.location.href = APP_STORE_URL; return; }
    if (!toast) return;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
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

// Hero skin switcher: swap the screenshot once the next image has loaded.
const skinImage = document.getElementById("skin-image");
const skinFrame = skinImage?.closest(".window");
document.querySelectorAll(".skin-tabs [role='tab']").forEach((tab) => {
  tab.addEventListener("tabselect", () => {
    if (skinImage.dataset.full === tab.dataset.src) return;
    skinFrame.classList.add("is-switching");
    const next = new Image();
    next.sizes = skinImage.sizes;
    next.srcset = tab.dataset.srcset || "";
    next.onload = () => {
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
