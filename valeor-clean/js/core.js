/* AUREON · core.js — utilidades compartidas por el catálogo y el panel. */

export const CONFIG = window.AUREON_CONFIG || {};

export const CATEGORIES = [
  { id: "Anillos",  one: "Anillo",  prefix: "AN", size: "Talla",      sizeHint: "Ej: 7" },
  { id: "Cadenas",  one: "Cadena",  prefix: "CA", size: "Largo (cm)", sizeHint: "Ej: 50" },
  { id: "Collares", one: "Collar",  prefix: "CO", size: "Largo (cm)", sizeHint: "Ej: 45" },
  { id: "Aretes",   one: "Aretes",  prefix: "AR", size: "Tamaño",     sizeHint: "Ej: 2 cm" },
  { id: "Pulseras", one: "Pulsera", prefix: "PU", size: "Largo (cm)", sizeHint: "Ej: 19" },
  { id: "Dijes",    one: "Dije",    prefix: "DI", size: "Tamaño",     sizeHint: "Ej: 1,5 cm" },
  { id: "Relojes",  one: "Reloj",   prefix: "RE", size: "Tamaño",     sizeHint: "Ej: 38 mm" },
  { id: "Otros",    one: "Pieza",   prefix: "OT", size: "Tamaño",     sizeHint: "" },
];
export const categoryInfo = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

export const MATERIALS = ["Oro 18K", "Oro blanco 18K", "Oro rosa 18K", "Oro 18K italiano", "Plata 925", "Oro laminado", "Acero"];

export const AVAILABILITY = {
  disponible: "Disponible",
  bajo_pedido: "Bajo pedido",
  agotado: "Agotado",
};

export const PAYMENT_LABELS = {
  addi: "Addi",
  sistecredito: "Sistecrédito",
  plan_separe: "Plan separe",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta débito/crédito",
  efectivo: "Efectivo en tienda",
};

export const DEFAULT_SETTINGS = {
  hero_eyebrow: "Medellín",
  hero_title: "Cada pieza,",
  hero_highlight: "una herencia.",
  hero_text: "Oro 18K. Asesoría privada por WhatsApp.",
  address: "",
  city: "Medellín",
  hours: "",
  instagram: "",
  trust: ["Oro 18K", "Estuche incluido", "Envío asegurado"],
  payments: { addi: false, sistecredito: false, plan_separe: true, transferencia: true, tarjeta: false, efectivo: true },
  payment_link: "",
};

export function settingsOf(store) {
  const s = Object.assign({}, DEFAULT_SETTINGS, (store && store.settings) || {});
  s.payments = Object.assign({}, DEFAULT_SETTINGS.payments, (store && store.settings && store.settings.payments) || {});
  s.trust = Array.isArray(s.trust) ? s.trust.filter(Boolean).slice(0, 4) : DEFAULT_SETTINGS.trust;
  return s;
}

/* ---------- Texto y números ---------- */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

const COP_FMT = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const cop = (n) => COP_FMT.format(Math.round(Number(n) || 0));
const NUM_FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
export const num = (n) => NUM_FMT.format(Number(n) || 0);

/** Convierte lo que la persona escribe ("1.250.000", "$ 1'250.000", "3,5") en número. */
export function parseMoney(text) {
  const digits = String(text ?? "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : null;
}
export function parseDecimal(text) {
  let t = String(text ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
/** Formatea mientras se escribe: 1250000 → "1.250.000". */
export function formatThousands(text) {
  const n = parseMoney(text);
  return n == null ? "" : new Intl.NumberFormat("es-CO").format(n);
}

export function cleanName(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

/** WhatsApp colombiano: "300 123 4567" → "573001234567". */
export function normalizeWhatsapp(text) {
  let d = String(text ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 && d.startsWith("3")) d = "57" + d;
  return d;
}
export function prettyWhatsapp(d) {
  d = String(d || "");
  if (d.startsWith("57") && d.length === 12) return `${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return d;
}

/* ---------- Precios ---------- */
const round1000 = (n) => Math.round(n / 1000) * 1000;

/**
 * Precio que ve el cliente.
 * - fijo: el precio escrito.
 * - gramo: peso × precio del gramo de la joyería + hechura (se actualiza solo).
 * - consultar: sin precio.
 * Devuelve { base, final } o null si no hay precio.
 */
export function computePrice(p, store) {
  if (!p || p.price_mode === "consultar") return null;
  let base = null;
  if (p.price_mode === "gramo") {
    const g = Number(p.weight_g), gp = Number(store && store.gold_price_18k);
    if (!g || !gp) return null;
    base = round1000(g * gp + (Number(p.labor) || 0));
  } else {
    base = Number(p.price) || null;
  }
  if (!base) return null;
  const d = Number(p.discount_pct) || 0;
  const final = d > 0 ? round1000(base * (1 - d / 100)) : base;
  return { base, final };
}

export function priceLabel(p, store) {
  const pr = computePrice(p, store);
  return pr ? cop(pr.final) : "Precio a consultar";
}

/* ---------- Fechas ---------- */
export function timeAgo(date) {
  if (!date) return "nunca";
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 90) return "hace un momento";
  const m = s / 60, h = m / 60, d = h / 24;
  if (m < 60) return `hace ${Math.round(m)} min`;
  if (h < 24) return `hace ${Math.round(h)} h`;
  if (d < 2) return "ayer";
  return `hace ${Math.round(d)} días`;
}

/* ---------- IndexedDB mínima (borradores y modo demo) ---------- */
export function idb(dbName = "aureon", storeName = "kv") {
  let dbp;
  const open = () =>
    (dbp ||= new Promise((resolve, reject) => {
      const r = indexedDB.open(dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(storeName);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  const run = (mode, fn) =>
    open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, mode);
          const req = fn(tx.objectStore(storeName));
          tx.oncomplete = () => resolve(req && req.result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  return {
    get: (k) => run("readonly", (s) => s.get(k)),
    set: (k, v) => run("readwrite", (s) => s.put(v, k)),
    del: (k) => run("readwrite", (s) => s.delete(k)),
    keys: () => run("readonly", (s) => s.getAllKeys()),
  };
}

export const uuid = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );

export function applyTheme() {
  const t = CONFIG.theme || {};
  const root = document.documentElement.style;
  for (const k of ["bg", "gold", "gold2", "blue", "ice"]) if (t[k]) root.setProperty(`--${k}`, t[k]);
  const b = CONFIG.brand || {};
  const hasName = !!(b.name && b.name.trim());
  document.body.classList.toggle("brand-unset", !hasName);
  document.querySelectorAll("[data-brand-name]").forEach((el) => (el.textContent = hasName ? b.name : "Tu joyería"));
  document.querySelectorAll("[data-brand-tagline]").forEach((el) => (el.textContent = hasName ? (b.tagline || "") : "escribe aquí tu nombre"));
  document.querySelectorAll(".brand-mark").forEach((el) => el.setAttribute("data-letter", hasName ? (b.letter || b.name[0]).toUpperCase() : "?"));
  document.body.classList.toggle("logo-unset", !(b.logo || b.logoUrl));
  document.body.classList.toggle("photos-light", t.photoMode === "light");
  document.querySelectorAll("[data-brand-logo]").forEach((el) => {
    const src = b.logo || b.logoUrl;
    if (src) { el.src = src; el.hidden = false; } else { el.hidden = true; }
  });
}
