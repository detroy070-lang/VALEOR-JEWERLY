/* =====================================================================
   AUREON · admin.js — Panel de la joyería.
   Pensado para el dueño: celular primero, pasos cortos, sin errores.
   ===================================================================== */
import {
  CONFIG, CATEGORIES, MATERIALS, AVAILABILITY, PAYMENT_LABELS, categoryInfo, settingsOf,
  esc, cop, num, parseMoney, parseDecimal, formatThousands, cleanName, normalizeWhatsapp, prettyWhatsapp,
  computePrice, priceLabel, timeAgo, idb, applyTheme,
} from "./core.js";
import { getApi, friendlyError, productSorter } from "./api.js";
import { processPhoto } from "./photo.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const MAX_PHOTOS = 5;
const drafts = idb("aureon-drafts", "drafts");
const DRAFT_KEY = `nueva-${CONFIG.storeSlug || "demo"}`;
const catalogUrl = () => new URL("../", location.href).href;
const pieceUrl = (p) => `${catalogUrl()}#/pieza/${encodeURIComponent(p.ref)}`;

const NAME_IDEAS = {
  Anillos: ["Anillo solitario", "Anillo de compromiso", "Argolla de matrimonio", "Anillo de 15 años"],
  Cadenas: ["Cadena cubana", "Cadena lazo", "Cadena gucci", "Cadena tejido rolo"],
  Collares: ["Collar de perlas", "Collar riviera", "Gargantilla"],
  Aretes: ["Topos", "Candongas", "Aretes largos", "Ear cuff"],
  Pulseras: ["Pulsera tenis", "Esclava", "Pulsera cubana", "Manilla"],
  Dijes: ["Dije Virgen", "Dije inicial", "Dije corazón", "Dije cruz"],
  Relojes: ["Reloj de dama", "Reloj de caballero"],
  Otros: ["Juego de collar y aretes", "Tobillera"],
};

const ICON = {
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  sold: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>',
  stock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  img: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg>',
  rotate: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/></svg>',
};

let api, store, products = [], stats = null;
const ui = { filter: "todas", query: "", route: "", ignoreHash: false };
let ed = null; // estado del editor

/* =====================================================================
   Utilidades de interfaz
   ===================================================================== */
function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), ms);
}
function busy(text) {
  $("#busy").hidden = !text;
  if (text) $("#busyText").textContent = text;
}
function dialog({ title, body = "", ok = "Aceptar", cancel = "Cancelar", danger = false, input = null }) {
  const d = $("#dlg");
  d.innerHTML = `<form method="dialog" class="dlg-card">
      <h2>${esc(title)}</h2>
      ${body ? `<div class="dlg-body">${body}</div>` : ""}
      ${input ? `<label class="field"><span>${esc(input.label)}</span><input id="dlgInput" inputmode="${input.mode || "text"}" value="${esc(input.value || "")}" autocomplete="off"></label><p class="form-error" id="dlgErr" hidden></p>` : ""}
      <div class="dlg-actions">
        ${cancel ? `<button value="cancel" class="btn ghost">${esc(cancel)}</button>` : ""}
        <button value="ok" class="btn ${danger ? "danger" : "primary"}" id="dlgOk">${esc(ok)}</button>
      </div></form>`;
  return new Promise((resolve) => {
    const inp = $("#dlgInput", d);
    if (inp && input.money) inp.addEventListener("input", () => { inp.value = formatThousands(inp.value); });
    $("#dlgOk", d).addEventListener("click", (e) => {
      if (inp && input.validate) {
        const err = input.validate(inp.value);
        if (err) { e.preventDefault(); const pe = $("#dlgErr", d); pe.textContent = err; pe.hidden = false; return; }
      }
    });
    d.addEventListener("close", () => resolve(d.returnValue === "ok" ? (inp ? inp.value : true) : false), { once: true });
    d.showModal();
    if (inp) setTimeout(() => { inp.focus(); inp.select(); }, 60);
  });
}
const alertBox = (title, body) => dialog({ title, body: `<p>${esc(body)}</p>`, cancel: null, ok: "Entendido" });

function sheet(title, actions) {
  const s = $("#sheet"), scrim = $("#sheetScrim");
  s.innerHTML = `<div class="sheet-grip"></div><h3>${title}</h3>
    <div class="sheet-actions">${actions.map((a, i) => `<button class="sheet-btn ${a.danger ? "danger" : ""}" data-i="${i}">${a.icon || ""}<span>${esc(a.label)}</span></button>`).join("")}</div>
    <button class="btn ghost full" data-close>Cerrar</button>`;
  const close = () => { s.classList.remove("open"); scrim.hidden = true; setTimeout(() => (s.hidden = true), 250); };
  s.hidden = false; scrim.hidden = false;
  requestAnimationFrame(() => s.classList.add("open"));
  scrim.onclick = close;
  $("[data-close]", s).onclick = close;
  $$("[data-i]", s).forEach((b) => (b.onclick = () => { close(); actions[+b.dataset.i].run(); }));
}

function whatsappLink(number, text) {
  return `https://wa.me/${number || ""}?text=${encodeURIComponent(text)}`;
}
function supportLink(text = "Hola, necesito ayuda con el panel de mi catálogo.") {
  return whatsappLink((CONFIG.support && CONFIG.support.whatsapp) || "", text);
}
function productThumb(p) {
  const im = p.images && p.images[0];
  return im ? api.imageUrl(im.thumb || im.path) : "";
}

/* =====================================================================
   Arranque y sesión
   ===================================================================== */
async function boot() {
  applyTheme();
  try {
    api = await getApi();
  } catch (e) {
    $("#boot").innerHTML = `<p class="form-error">${esc(friendlyError(e))}</p>`;
    return;
  }
  $("#forgotLink").href = supportLink("Hola, olvidé la contraseña del panel de mi catálogo.");
  if (api.mode === "demo") {
    $("#demoNote").hidden = false;
    $("#demoPass").textContent = (CONFIG.demo && CONFIG.demo.password) || "demo1234";
    $("#demoBar").hidden = false;
  }
  bindLogin();
  bindShell();
  api.onAuthChange((event) => {
    if (event === "SIGNED_OUT" && !$("#app").hidden) showLogin("Tu sesión se cerró. Vuelve a entrar.");
  });
  const user = await api.currentUser().catch(() => null);
  if (user) await enterApp(); else showLogin();
  $("#boot").hidden = true;
}

function showLogin(message) {
  $("#app").hidden = true;
  $("#login").hidden = false;
  $("#boot").hidden = true;
  const err = $("#loginError");
  err.hidden = !message;
  if (message) err.textContent = message;
}

function bindLogin() {
  $("#togglePass").onclick = () => {
    const i = $("#loginPassword");
    i.type = i.type === "password" ? "text" : "password";
    $("#togglePass").textContent = i.type === "password" ? "Ver" : "Ocultar";
  };
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#loginEmail").value.trim(), pass = $("#loginPassword").value;
    const err = $("#loginError");
    err.hidden = true;
    if (!email || !email.includes("@")) { err.textContent = "Escribe tu correo."; err.hidden = false; return; }
    if (!pass) { err.textContent = "Escribe tu contraseña."; err.hidden = false; return; }
    const btn = $("#loginBtn");
    btn.disabled = true; btn.textContent = "Entrando…";
    try {
      await api.signIn(email, pass);
      await enterApp();
    } catch (ex) {
      err.textContent = friendlyError(ex); err.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });
}

async function enterApp() {
  try {
    store = await api.getMyStore();
    products = (await api.listMyProducts()).sort(productSorter);
  } catch (e) {
    const msg = friendlyError(e);
    await api.signOut().catch(() => {});
    showLogin(msg);
    return;
  }
  $("#login").hidden = true;
  $("#app").hidden = false;
  $("#storeNameSmall").textContent = "PANEL";
  $("#openCatalog").href = catalogUrl();
  document.title = `Panel · ${store.name}`;
  applyTheme();
  loadStats();
  route();
}

async function refreshProducts() {
  products = (await api.listMyProducts()).sort(productSorter);
}
async function loadStats() {
  try { stats = await api.stats(30); } catch { stats = null; }
  if (ui.route === "home") renderHomeStats();
  if (ui.route === "estadisticas") renderStats();
}

function bindShell() {
  window.addEventListener("hashchange", onHashChange);
  $("#openCatalog").onclick = async (e) => { e.preventDefault(); if (await confirmLeaveEditor()) location.href = catalogUrl(); };
  $("#backBtn").onclick = () => history.length > 1 ? history.back() : (location.hash = "#/");
  $("#menuBtn").onclick = () =>
    sheet("Opciones", [
      { icon: ICON.share, label: "Volver al catálogo", run: async () => { if (await confirmLeaveEditor()) location.href = catalogUrl(); } },
      { icon: ICON.wa, label: "Compartir mi catálogo por WhatsApp", run: () => window.open(whatsappLink("", `Mira nuestro catálogo de joyas ✨\n${catalogUrl()}`), "_blank", "noopener") },
      { icon: ICON.wa, label: "Pedir ayuda a soporte", run: () => window.open(supportLink(), "_blank", "noopener") },
      { icon: ICON.x, label: "Cerrar sesión", danger: true, run: async () => {
          if (!(await confirmLeaveEditor())) return;
          await api.signOut(); location.hash = "#/"; showLogin();
        } },
    ]);
  window.addEventListener("online", () => ($("#offlineBar").hidden = true));
  window.addEventListener("offline", () => ($("#offlineBar").hidden = false));
  $("#offlineBar").hidden = navigator.onLine;
  window.addEventListener("beforeunload", (e) => {
    if (ed && ed.dirty && !ed.saving) { e.preventDefault(); e.returnValue = ""; }
  });
}

/* =====================================================================
   Rutas (#/ …) — el botón "atrás" del celular funciona normal.
   ===================================================================== */
async function onHashChange() {
  if (ui.ignoreHash) { ui.ignoreHash = false; return; }
  if (ed && ed.dirty && !ed.saving && !location.hash.startsWith(ed.hash)) {
    const target = location.hash;
    ui.ignoreHash = true;
    location.hash = ed.hash;
    const ok = await dialog({ title: "¿Salir sin guardar?", body: "<p>Los cambios de esta joya se van a perder.</p>", ok: "Salir sin guardar", cancel: "Seguir editando", danger: true });
    if (!ok) return;
    if (!ed.id) drafts.del(DRAFT_KEY).catch(() => {});
    ed = null;
    location.hash = target;
    return;
  }
  route();
}
async function confirmLeaveEditor() {
  if (!(ed && ed.dirty)) return true;
  return dialog({ title: "¿Salir sin guardar?", body: "<p>Los cambios de esta joya se van a perder.</p>", ok: "Salir", cancel: "Seguir editando", danger: true });
}

function route() {
  if ($("#app").hidden) return;
  const h = location.hash.replace(/^#/, "") || "/";
  const [, section, arg] = h.split("/");
  let name = section || "home";
  if (!["home", "nueva", "editar", "precios", "joyeria", "estadisticas"].includes(name)) name = "home";
  ui.route = name;
  $$("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
  const inEditor = name === "nueva" || name === "editar";
  document.body.classList.toggle("in-editor", inEditor);
  $("#backBtn").hidden = name === "home";
  if (!inEditor) ed = null;
  const view = $("#view");
  view.scrollTop = 0; window.scrollTo(0, 0);
  if (name === "home") renderHome();
  else if (name === "nueva") openEditor(null);
  else if (name === "editar") openEditor(decodeURIComponent(arg || ""));
  else if (name === "precios") renderPrices();
  else if (name === "joyeria") renderStore();
  else if (name === "estadisticas") renderStats();
}
const setTitle = (t) => ($("#barTitle").textContent = t);

/* =====================================================================
   INICIO · lista de joyas
   ===================================================================== */
const FILTERS = [
  { id: "todas", label: "Todas", test: () => true },
  { id: "catalogo", label: "En catálogo", test: (p) => p.status === "publicado" && p.availability !== "agotado" },
  { id: "agotadas", label: "Agotadas", test: (p) => p.availability === "agotado" },
  { id: "ocultas", label: "Ocultas", test: (p) => p.status === "oculto" },
  { id: "borradores", label: "Sin publicar", test: (p) => p.status === "borrador" },
];

function renderHome() {
  setTitle("Mis joyas");
  const gp = store.gold_price_18k;
  const perGram = products.filter((p) => p.price_mode === "gramo").length;
  const stale = store.gold_price_updated_at && Date.now() - new Date(store.gold_price_updated_at) > 3 * 864e5;
  $("#view").innerHTML = `
    <section class="home-top">
      <div class="stat-row" id="homeStats">${statCards()}</div>
      <a class="gold-card ${stale || (!gp && perGram) ? "attention" : ""}" href="#/precios">
        <div><span class="label">Precio del gramo · oro 18K</span>
        <strong>${gp ? cop(gp) : "Sin definir"}</strong>
        <small>${gp ? `Actualizado ${timeAgo(store.gold_price_updated_at)}${perGram ? ` · mueve ${perGram} ${perGram === 1 ? "joya" : "joyas"} solas` : ""}` : "Defínelo para vender por gramo"}</small></div>
        <span class="btn sm ${stale || (!gp && perGram) ? "primary" : "ghost"}">${stale ? "¿Cambió? Actualizar" : "Cambiar"}</span>
      </a>
    </section>
    <section class="list-tools">
      <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <input id="q" type="search" placeholder="Buscar por nombre o referencia" value="${esc(ui.query)}" autocomplete="off"></label>
      <div class="chips" id="filters">${FILTERS.map((f) => `<button class="chip ${ui.filter === f.id ? "on" : ""}" data-f="${f.id}">${f.label} <b>${products.filter(f.test).length}</b></button>`).join("")}</div>
    </section>
    <section id="list" class="plist"></section>
    <a href="#/nueva" class="fab hide-mobile">+ Agregar joya</a>`;
  $("#q").addEventListener("input", (e) => { ui.query = e.target.value; renderList(); });
  $$("#filters .chip").forEach((b) => (b.onclick = () => { ui.filter = b.dataset.f; renderHome(); }));
  renderList();
}

function statCards() {
  const live = products.filter((p) => p.status === "publicado" && p.availability !== "agotado").length;
  const s = stats;
  return `
    <div class="stat"><span>En catálogo</span><strong>${live}</strong></div>
    <div class="stat"><span>Visitas · 30 días</span><strong>${s ? num(s.visitas) : "—"}</strong></div>
    <div class="stat"><span>WhatsApp · 30 días</span><strong>${s ? num(s.whatsapp) : "—"}</strong></div>`;
}
function renderHomeStats() { const el = $("#homeStats"); if (el) el.innerHTML = statCards(); }

function statusChips(p) {
  const chips = [];
  if (p.status === "borrador") chips.push(`<i class="st draft">Sin publicar</i>`);
  if (p.status === "oculto") chips.push(`<i class="st hidden">Oculta</i>`);
  if (p.availability === "agotado") chips.push(`<i class="st out">Agotada</i>`);
  else if (p.availability === "bajo_pedido") chips.push(`<i class="st order">Bajo pedido</i>`);
  if (p.status === "publicado" && p.availability !== "agotado") chips.push(`<i class="st live">En catálogo</i>`);
  if (p.featured) chips.push(`<i class="st star">★ Destacada</i>`);
  return chips.join("");
}

function renderList() {
  const f = FILTERS.find((x) => x.id === ui.filter) || FILTERS[0];
  const q = ui.query.trim().toLowerCase();
  const list = products.filter(f.test).filter((p) => !q || `${p.name} ${p.ref} ${p.category} ${p.material}`.toLowerCase().includes(q));
  const box = $("#list");
  if (!products.length) {
    box.innerHTML = `<div class="empty"><div class="empty-ico">◇</div><h2>Aún no tienes joyas</h2><p>Toca <b>Agregar joya</b> y sube la primera. Toma 1 minuto.</p><a class="btn primary big" href="#/nueva">+ Agregar mi primera joya</a></div>`;
    return;
  }
  if (!list.length) { box.innerHTML = `<div class="empty small"><p>No hay joyas con ese filtro.</p></div>`; return; }
  box.innerHTML = list.map((p) => `
    <button class="prow" data-id="${esc(p.id)}">
      <span class="pthumb">${productThumb(p) ? `<img src="${esc(productThumb(p))}" alt="" loading="lazy">` : "<em>Sin foto</em>"}</span>
      <span class="pinfo">
        <b>${esc(p.name)}</b>
        <small>${esc(p.ref)} · ${esc(p.material)}${p.weight_g ? ` · ${num(p.weight_g)} g` : ""}</small>
        <span class="chips-inline">${statusChips(p)}</span>
      </span>
      <span class="pprice">${esc(priceLabel(p, store))}${p.price_mode === "gramo" ? "<small>por gramo</small>" : ""}</span>
    </button>`).join("");
  $$(".prow", box).forEach((b) => (b.onclick = () => productActions(products.find((p) => p.id === b.dataset.id))));
}

function productActions(p) {
  if (!p) return;
  const acts = [{ icon: ICON.edit, label: "Editar", run: () => (location.hash = `#/editar/${encodeURIComponent(p.id)}`) }];
  if (p.availability !== "agotado") acts.push({ icon: ICON.sold, label: "Marcar como vendida", run: () => markSold(p) });
  acts.push(p.availability === "agotado"
    ? { icon: ICON.stock, label: "Volver a tener disponible", run: () => quick(p, { availability: "disponible", sold_at: null }, "Disponible otra vez") }
    : { icon: ICON.stock, label: "Marcar agotada", run: () => quick(p, { availability: "agotado" }, "Marcada como agotada") });
  acts.push(p.status === "publicado"
    ? { icon: ICON.eye, label: "Ocultar del catálogo", run: () => quick(p, { status: "oculto" }, "Oculta: ya no la ven tus clientes") }
    : { icon: ICON.eye, label: "Publicar en el catálogo", run: () => quick(p, { status: "publicado" }, "¡Publicada en tu catálogo!") });
  acts.push({ icon: ICON.star, label: p.featured ? "Quitar de destacadas" : "Destacar (sale primero)", run: () => quick(p, { featured: !p.featured }, p.featured ? "Ya no está destacada" : "Destacada: sale primero") });
  if (p.status === "publicado") acts.push({ icon: ICON.wa, label: "Compartir por WhatsApp", run: () => sharePiece(p) });
  acts.push({ icon: ICON.trash, label: "Eliminar", danger: true, run: () => removeProduct(p) });
  sheet(`${esc(p.name)} <small>${esc(p.ref)} · ${esc(priceLabel(p, store))}</small>`, acts);
}

async function quick(p, patch, msg) {
  busy("Guardando…");
  try {
    const saved = await api.updateProduct(p.id, patch);
    Object.assign(p, saved);
    products.sort(productSorter);
    renderHome();
    toast(msg);
  } catch (e) { alertBox("No se pudo guardar", friendlyError(e)); }
  finally { busy(false); }
}

async function markSold(p) {
  const pr = computePrice(p, store);
  const val = await dialog({
    title: "¡Felicitaciones por la venta!",
    body: `<p><b>${esc(p.name)}</b> quedará como <b>Agotada</b> en el catálogo y la venta se suma a tus estadísticas.</p>`,
    ok: "Registrar venta",
    input: { label: "¿En cuánto la vendiste? (COP)", mode: "numeric", money: true, value: pr ? formatThousands(pr.final) : "",
      validate: (v) => (parseMoney(v) ? null : "Escribe el valor de la venta.") },
  });
  if (!val) return;
  busy("Registrando venta…");
  try {
    const saved = await api.recordSale(p, parseMoney(val));
    Object.assign(p, saved);
    products.sort(productSorter);
    renderHome(); loadStats();
    toast("Venta registrada ✓");
  } catch (e) { alertBox("No se pudo registrar", friendlyError(e)); }
  finally { busy(false); }
}

async function removeProduct(p) {
  const ok = await dialog({ title: "¿Eliminar esta joya?", body: `<p><b>${esc(p.name)}</b> (${esc(p.ref)}) se borrará para siempre con sus fotos.</p><p class="muted">Si solo no está disponible, mejor márcala como <b>Agotada</b> u <b>Ocúltala</b>.</p>`, ok: "Eliminar", danger: true });
  if (!ok) return;
  busy("Eliminando…");
  try {
    await api.deleteProduct(p);
    products = products.filter((x) => x.id !== p.id);
    renderHome();
    toast("Joya eliminada");
  } catch (e) { alertBox("No se pudo eliminar", friendlyError(e)); }
  finally { busy(false); }
}

function sharePiece(p) {
  const text = `✨ ${p.name}\n${priceLabel(p, store)}\n${pieceUrl(p)}`;
  if (navigator.share) navigator.share({ title: p.name, text, url: pieceUrl(p) }).catch(() => {});
  else window.open(whatsappLink("", text), "_blank", "noopener");
}

/* =====================================================================
   EDITOR · Agregar / editar joya en 3 pasos
   ===================================================================== */
function emptyData() {
  return { category: "", name: "", material: "Oro 18K", weight: "", size: "", stone: "", description: "",
    price_mode: "fijo", price: "", labor: "", discount: "", availability: "disponible", featured: false, status: "publicado" };
}
function dataFromProduct(p) {
  return {
    category: p.category, name: p.name, material: p.material,
    weight: p.weight_g != null ? String(p.weight_g).replace(".", ",") : "", size: p.size || "", stone: p.stone || "",
    description: p.description || "", price_mode: p.price_mode, price: p.price ? formatThousands(p.price) : "",
    labor: p.labor ? formatThousands(p.labor) : "", discount: p.discount_pct ? String(p.discount_pct) : "",
    availability: p.availability === "agotado" ? "agotado" : p.availability, featured: !!p.featured, status: p.status,
  };
}

async function openEditor(id) {
  if (ed && ((id && ed.id === id) || (!id && !ed.id))) { renderEditor(); return; }
  if (id) {
    const p = products.find((x) => x.id === id);
    if (!p) { toast("Esa joya ya no existe"); location.hash = "#/"; return; }
    ed = { id, product: p, step: 1, hash: `#/editar/${encodeURIComponent(id)}`, dirty: false, saving: false,
      photos: (p.images || []).map((im) => ({ key: im.path, path: im.path, thumb: im.thumb, w: im.w, h: im.h, preview: api.imageUrl(im.thumb || im.path), warnings: [] })),
      removed: [], data: dataFromProduct(p), errors: {} };
    renderEditor();
    return;
  }
  ed = { id: null, step: 1, hash: "#/nueva", dirty: false, saving: false, photos: [], removed: [], data: emptyData(), errors: {} };
  const draft = await drafts.get(DRAFT_KEY).catch(() => null);
  if (draft && (draft.photos?.length || draft.data?.name)) {
    renderEditor();
    const resume = await dialog({ title: "Tienes una joya sin terminar", body: `<p>${draft.data?.name ? `<b>${esc(draft.data.name)}</b> · ` : ""}${draft.photos?.length || 0} foto(s). ¿Quieres continuarla?</p>`, ok: "Continuar", cancel: "Empezar de cero" });
    if (resume && ed && !ed.id) {
      ed.data = Object.assign(emptyData(), draft.data);
      ed.photos = draft.photos.map((ph) => ({ ...ph, key: ph.key, preview: URL.createObjectURL(ph.thumb.blob), source: ph.main.blob, rotate: 0, w: ph.main.w, h: ph.main.h }));
      ed.step = draft.step || 1;
      ed.dirty = true;
    } else {
      drafts.del(DRAFT_KEY).catch(() => {});
    }
  }
  renderEditor();
}

let draftTimer;
function touch() {
  if (!ed) return;
  ed.dirty = true;
  if (ed.id) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (!ed || ed.id) return;
    const photos = ed.photos.filter((p) => p.main).map((p) => ({ key: p.key, main: p.main, thumb: p.thumb, warnings: p.warnings, rotate: p.rotate || 0 }));
    drafts.set(DRAFT_KEY, { data: ed.data, photos, step: ed.step, at: Date.now() }).catch(() => {});
  }, 400);
}

const STEPS = ["Fotos", "Datos", "Precio"];
const WARN_SHORT = { small: "Foto pequeña", blur: "Parece borrosa", dark: "Muy oscura", bright: "Fondo muy claro" };
function renderEditor() {
  const isEdit = !!ed.id;
  setTitle(isEdit ? "Editar joya" : "Nueva joya");
  $("#view").innerHTML = `
    <div class="editor">
      <ol class="steps">${STEPS.map((s, i) => `<li class="${ed.step === i + 1 ? "on" : ""} ${ed.step > i + 1 ? "done" : ""}"><button data-step="${i + 1}" ${!isEdit && i + 1 > ed.step ? "disabled" : ""}><span>${i + 1}</span>${s}</button></li>`).join("")}</ol>
      <div id="stepBody" class="step-body"></div>
    </div>
    <div class="editor-bar" id="editorBar"></div>`;
  $$(".steps [data-step]").forEach((b) => (b.onclick = () => goStep(+b.dataset.step)));
  if (ed.step === 1) renderPhotosStep();
  if (ed.step === 2) renderDataStep();
  if (ed.step === 3) renderPriceStep();
  renderEditorBar();
}

function goStep(n) {
  if (n > ed.step) {
    for (let s = ed.step; s < n; s++) {
      if (!validateStep(s)) { if (s !== ed.step) { ed.step = s; renderEditor(); validateStep(s); } return; }
    }
  }
  ed.step = n;
  touchStep();
  renderEditor();
  window.scrollTo(0, 0);
}
function touchStep() { if (!ed.id && (ed.photos.length || ed.data.name)) touch(); }

function renderEditorBar() {
  const bar = $("#editorBar"), isEdit = !!ed.id;
  const processing = ed.photos.some((p) => p.processing);
  const back = ed.step > 1
    ? `<button class="btn ghost icon-only" id="prevStep" aria-label="Atrás"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>`
    : `<a class="btn ghost" href="#/">Cancelar</a>`;
  if (isEdit) {
    bar.innerHTML = `${back}
      ${ed.step < 3 ? `<button class="btn ghost" id="nextStep">Siguiente</button>` : ""}
      <button class="btn primary grow" id="saveBtn" ${processing ? "disabled" : ""}>Guardar cambios</button>`;
  } else if (ed.step < 3) {
    bar.innerHTML = `${back}
      <button class="btn primary grow" id="nextStep" ${processing ? "disabled" : ""}>${processing ? "Arreglando fotos…" : "Siguiente →"}</button>`;
  } else {
    bar.innerHTML = `${back}
      <button class="btn ghost" id="draftBtn">Solo guardar</button>
      <button class="btn primary grow" id="publishBtn">Publicar</button>`;
  }
  $("#prevStep") && ($("#prevStep").onclick = () => goStep(ed.step - 1));
  $("#nextStep") && ($("#nextStep").onclick = () => goStep(ed.step + 1));
  $("#saveBtn") && ($("#saveBtn").onclick = () => saveEditor(ed.data.status));
  $("#draftBtn") && ($("#draftBtn").onclick = () => saveEditor("borrador"));
  $("#publishBtn") && ($("#publishBtn").onclick = () => saveEditor("publicado"));
}

/* ---------- Paso 1 · Fotos ---------- */
function renderPhotosStep() {
  const full = ed.photos.length >= MAX_PHOTOS;
  const seenTips = localStorage.getItem("aureon-tips-seen") === "1";
  $("#stepBody").innerHTML = `
    <h2 class="step-title">Fotos de la joya</h2>
    <details class="tips" ${seenTips && ed.photos.length ? "" : "open"}>
      <summary>Cómo tomar fotos que vendan</summary>
      <div class="tips-body">
        <img src="../assets/demo-anillo-t.webp" alt="Ejemplo: anillo sobre una mano de exhibición negra">
        <ol>
          <li><b>Fondo negro</b>: terciopelo, cartulina o tu exhibidor oscuro.</li>
          <li><b>Buena luz</b>: junto a una ventana o con lámpara blanca. <b>Sin flash.</b></li>
          <li><b>Celular a 20–30 cm</b>, sin zoom. Toca la joya en la pantalla para enfocar.</li>
          <li><b>La joya en el centro</b>, llenando casi toda la foto. Toma 2 o 3 ángulos.</li>
        </ol>
      </div>
    </details>
    <div class="photo-actions">
      <label class="btn primary big ${full ? "disabled" : ""}">${ICON.cam}<span>Tomar foto</span><input type="file" accept="image/*" capture="environment" id="camInput" hidden ${full ? "disabled" : ""}></label>
      <label class="btn ghost big ${full ? "disabled" : ""}">${ICON.img}<span>Elegir de la galería</span><input type="file" accept="image/*" multiple id="galInput" hidden ${full ? "disabled" : ""}></label>
    </div>
    <p class="hint">${ed.photos.length}/${MAX_PHOTOS} fotos · La primera es la portada. Las fotos se arreglan solas: se enderezan, se mejora la luz y se aligeran.</p>
    <div class="photo-grid" id="photoGrid"></div>
    <div class="warn-tips" id="warnTips"></div>
    <p class="form-error" id="err-photos" ${ed.errors.photos ? "" : "hidden"}>${esc(ed.errors.photos || "")}</p>`;
  $("details.tips").addEventListener("toggle", () => localStorage.setItem("aureon-tips-seen", "1"));
  $("#camInput").onchange = (e) => addPhotos(e.target.files);
  $("#galInput").onchange = (e) => addPhotos(e.target.files);
  renderPhotoGrid();
}

function renderPhotoGrid() {
  const g = $("#photoGrid");
  if (!g) return;
  g.innerHTML = ed.photos.map((ph, i) => `
    <figure class="ptile ${ph.processing ? "processing" : ""} ${ph.warnings?.length ? "warned" : ""}">
      ${ph.processing ? `<div class="spinner"></div><figcaption>Arreglando la foto…</figcaption>` : `
      <img src="${esc(ph.preview)}" alt="Foto ${i + 1}">
      ${i === 0 ? `<span class="cover-badge">Portada</span>` : ""}
      <div class="tile-actions">
        ${i > 0 ? `<button data-cover="${i}" title="Usar como portada">${ICON.star}</button>` : ""}
        <button data-rot="${i}" title="Girar">${ICON.rotate}</button>
        <button data-del="${i}" title="Quitar" class="del">${ICON.x}</button>
      </div>
      ${ph.warnings?.length ? `<figcaption class="warn">${ICON.warn}${esc(WARN_SHORT[ph.warnings[0].code] || "Revisa esta foto")}</figcaption>` : ""}`}
    </figure>`).join("");
  const tips = [...new Map(ed.photos.flatMap((ph) => ph.warnings || []).map((w) => [w.code, w.text])).values()];
  const box = $("#warnTips");
  if (box) box.innerHTML = tips.map((t) => `<p>${ICON.warn}<span>${esc(t)}</span></p>`).join("");
  $$("[data-cover]", g).forEach((b) => (b.onclick = () => { const i = +b.dataset.cover; const [x] = ed.photos.splice(i, 1); ed.photos.unshift(x); touch(); renderPhotosStep(); }));
  $$("[data-del]", g).forEach((b) => (b.onclick = () => { const [x] = ed.photos.splice(+b.dataset.del, 1); if (x.path) ed.removed.push(x); touch(); renderPhotosStep(); renderEditorBar(); }));
  $$("[data-rot]", g).forEach((b) => (b.onclick = () => rotatePhoto(+b.dataset.rot)));
}

async function addPhotos(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const room = MAX_PHOTOS - ed.photos.length;
  if (files.length > room) toast(`Solo caben ${MAX_PHOTOS} fotos. Se agregaron ${room}.`);
  const mine = ed;
  const jobs = files.slice(0, room).map((file) => {
    const item = { key: "new-" + Math.random().toString(36).slice(2), processing: true, source: file, rotate: 0, warnings: [] };
    mine.photos.push(item);
    return item;
  });
  ed.errors.photos = null;
  renderPhotosStep(); renderEditorBar();
  for (const item of jobs) {
    try {
      const r = await processPhoto(item.source);
      Object.assign(item, { processing: false, main: r.main, thumb: r.thumb, preview: r.preview, warnings: r.warnings, w: r.main.w, h: r.main.h });
    } catch (e) {
      mine.photos.splice(mine.photos.indexOf(item), 1);
      alertBox("No se pudo usar esa foto", friendlyError(e));
    }
    if (ed === mine && ed.step === 1) { renderPhotoGrid(); renderEditorBar(); }
  }
  touch();
  if (ed === mine && ed.step === 1) renderPhotosStep();
  const warned = jobs.find((j) => j.warnings && j.warnings.length);
  if (warned) toast("Revisa el aviso de la foto: se puede mejorar.", 3500);
}

async function rotatePhoto(i) {
  const ph = ed.photos[i];
  if (!ph) return;
  const src = ph.source || (ph.main && ph.main.blob);
  ph.processing = true; renderPhotoGrid(); renderEditorBar();
  try {
    let blob = src;
    if (!blob && ph.path) blob = await (await fetch(api.imageUrl(ph.path))).blob();
    const rot = ((ph.rotate || 0) + 90) % 360;
    const r = await processPhoto(blob, { rotate: ph.source ? rot : 90 });
    if (ph.path) { ed.removed.push({ path: ph.path, thumb: ph.thumb }); delete ph.path; }
    Object.assign(ph, { main: r.main, thumb: r.thumb, preview: r.preview, warnings: r.warnings, w: r.main.w, h: r.main.h, rotate: ph.source ? rot : 0 });
    if (!ph.source) ph.source = r.main.blob;
  } catch (e) { alertBox("No se pudo girar", friendlyError(e)); }
  ph.processing = false; touch(); renderPhotoGrid(); renderEditorBar();
}

/* ---------- Paso 2 · Datos ---------- */
function field(name, label, inner, hint = "") {
  const err = ed.errors[name];
  return `<div class="field ${err ? "has-error" : ""}" id="f-${name}"><span class="flabel">${label}</span>${inner}${hint ? `<small class="fhint">${hint}</small>` : ""}<p class="form-error" ${err ? "" : "hidden"}>${esc(err || "")}</p></div>`;
}
function renderDataStep() {
  const d = ed.data;
  const cat = d.category ? categoryInfo(d.category) : null;
  const customMaterial = d.material && !MATERIALS.includes(d.material);
  $("#stepBody").innerHTML = `
    <h2 class="step-title">Datos de la joya</h2>
    ${field("category", "¿Qué es?", `<div class="chips wrap" role="radiogroup">${CATEGORIES.map((c) => `<button type="button" class="chip big ${d.category === c.id ? "on" : ""}" data-cat="${c.id}">${c.id}</button>`).join("")}</div>`)}
    ${field("name", "Nombre", `<input id="in-name" maxlength="80" value="${esc(d.name)}" placeholder="${cat ? `Ej: ${NAME_IDEAS[cat.id][0]}` : "Primero elige qué es"}" autocomplete="off">
      ${cat ? `<div class="chips ideas">${NAME_IDEAS[cat.id].map((n) => `<button type="button" class="chip sm" data-idea="${esc(n)}">${esc(n)}</button>`).join("")}</div>` : ""}`,
      "Un nombre bonito vende más que un código. La referencia se crea sola.")}
    ${field("material", "Material", `<div class="chips wrap">${MATERIALS.map((m) => `<button type="button" class="chip ${d.material === m ? "on" : ""}" data-mat="${esc(m)}">${esc(m)}</button>`).join("")}<button type="button" class="chip ${customMaterial ? "on" : ""}" data-mat="__otro">Otro</button></div>
      ${customMaterial ? `<input id="in-material" maxlength="40" value="${esc(d.material)}" placeholder="Escribe el material">` : ""}`)}
    <div class="two">
      ${field("weight", "Peso (gramos)", `<input id="in-weight" inputmode="decimal" value="${esc(d.weight)}" placeholder="Ej: 3,5">`, "Opcional si el precio es fijo.")}
      ${field("size", cat ? cat.size : "Talla / largo", `<input id="in-size" maxlength="40" value="${esc(d.size)}" placeholder="${cat ? cat.sizeHint : ""}">`, "Opcional")}
    </div>
    ${field("stone", "Piedra", `<input id="in-stone" maxlength="60" value="${esc(d.stone)}" placeholder="Ej: Circón blanco · opcional">`)}
    ${field("description", "Descripción", `<textarea id="in-desc" rows="4" maxlength="700" placeholder="Opcional">${esc(d.description)}</textarea>
      <button type="button" class="link-btn" id="autoDesc">✨ Escribirla por mí</button>`)}`;
  $$("[data-cat]").forEach((b) => (b.onclick = () => { d.category = b.dataset.cat; delete ed.errors.category; touch(); renderDataStep(); }));
  $$("[data-idea]").forEach((b) => (b.onclick = () => { d.name = b.dataset.idea; delete ed.errors.name; touch(); renderDataStep(); $("#in-name").focus(); }));
  $$("[data-mat]").forEach((b) => (b.onclick = () => { d.material = b.dataset.mat === "__otro" ? "" : b.dataset.mat; touch(); renderDataStep(); if (b.dataset.mat === "__otro") setTimeout(() => $("#in-material")?.focus(), 30); }));
  const bind = (id, key) => { const el = $(id); if (el) el.addEventListener("input", () => { d[key] = el.value; delete ed.errors[key]; touch(); }); };
  bind("#in-name", "name"); bind("#in-material", "material"); bind("#in-weight", "weight"); bind("#in-size", "size"); bind("#in-stone", "stone"); bind("#in-desc", "description");
  $("#autoDesc").onclick = () => {
    if (!d.category) { ed.errors.category = "Primero elige qué es."; renderDataStep(); return; }
    d.description = autoDescription(d); touch(); renderDataStep();
  };
}

function autoDescription(d) {
  const c = categoryInfo(d.category);
  const mat = (d.material || "oro 18K").replace(/^./, (x) => x.toLowerCase());
  const w = parseDecimal(d.weight);
  let t = `${c.one} en ${mat}`;
  if (w && w > 0) t += ` de ${num(w)} g`;
  if (d.size) t += d.category === "Anillos" ? `, talla ${d.size}` : c.size.startsWith("Largo") ? `, largo de ${d.size}${/cm/i.test(d.size) ? "" : " cm"}` : `, tamaño ${d.size}`;
  if (d.stone) t += `, con ${d.stone.toLowerCase()}`;
  t += ". ";
  t += /laminado|acero/i.test(d.material) ? "Brillo duradero y excelente acabado." : "Pieza de joyería fina con garantía.";
  t += " Ideal para regalar o para consentirte.";
  return t;
}

/* ---------- Paso 3 · Precio ---------- */
function draftProduct() {
  const d = ed.data;
  return {
    price_mode: d.price_mode, price: parseMoney(d.price), labor: parseMoney(d.labor) || 0,
    weight_g: parseDecimal(d.weight) || null, discount_pct: parseInt(d.discount, 10) || 0,
  };
}
function renderPriceStep() {
  const d = ed.data, isEdit = !!ed.id;
  const gp = store.gold_price_18k;
  $("#stepBody").innerHTML = `
    <h2 class="step-title">Precio y publicación</h2>
    ${field("price_mode", "¿Cómo le pones precio?", `<div class="seg" role="radiogroup">
        <button type="button" class="${d.price_mode === "fijo" ? "on" : ""}" data-mode="fijo"><b>Precio fijo</b><small>Tú escribes el valor</small></button>
        <button type="button" class="${d.price_mode === "gramo" ? "on" : ""}" data-mode="gramo"><b>Por gramo</b><small>Se actualiza solo con el oro</small></button>
        <button type="button" class="${d.price_mode === "consultar" ? "on" : ""}" data-mode="consultar"><b>A consultar</b><small>Te preguntan por WhatsApp</small></button>
      </div>`)}
    <div id="priceFields"></div>
    <div class="two">
      ${field("availability", "Disponibilidad", `<div class="seg small">
          <button type="button" class="${d.availability === "disponible" ? "on" : ""}" data-av="disponible">Disponible</button>
          <button type="button" class="${d.availability === "bajo_pedido" ? "on" : ""}" data-av="bajo_pedido">Bajo pedido</button>
          ${isEdit ? `<button type="button" class="${d.availability === "agotado" ? "on" : ""}" data-av="agotado">Agotada</button>` : ""}
        </div>`)}
      ${field("featured", "Destacar", `<label class="switch"><input type="checkbox" id="in-feat" ${d.featured ? "checked" : ""}><span></span><em>Mostrar primero en el catálogo</em></label>`)}
    </div>
    ${isEdit ? field("status", "Estado", `<div class="seg small">
          <button type="button" class="${d.status === "publicado" ? "on" : ""}" data-status="publicado">En catálogo</button>
          <button type="button" class="${d.status === "oculto" ? "on" : ""}" data-status="oculto">Oculta</button>
          <button type="button" class="${d.status === "borrador" ? "on" : ""}" data-status="borrador">Sin publicar</button>
        </div>`) : ""}
    <h3 class="preview-title">Así la verán tus clientes</h3>
    <div class="preview" id="preview"></div>`;
  $$("[data-mode]").forEach((b) => (b.onclick = () => { d.price_mode = b.dataset.mode; ed.errors = {}; touch(); renderPriceStep(); }));
  $$("[data-av]").forEach((b) => (b.onclick = () => { d.availability = b.dataset.av; touch(); renderPriceStep(); }));
  $$("[data-status]").forEach((b) => (b.onclick = () => { d.status = b.dataset.status; touch(); renderPriceStep(); }));
  $("#in-feat").onchange = (e) => { d.featured = e.target.checked; touch(); renderPreview(); };
  renderPriceFields();
  renderPreview();
  if (d.price_mode === "gramo" && !gp) setTimeout(() => $("#in-gold")?.focus(), 50);
}

function moneyInput(id, value, placeholder) {
  return `<div class="money"><span>$</span><input id="${id}" inputmode="numeric" value="${esc(value)}" placeholder="${placeholder}" autocomplete="off"></div>`;
}
function renderPriceFields() {
  const d = ed.data, box = $("#priceFields");
  const gp = store.gold_price_18k;
  if (d.price_mode === "fijo") {
    box.innerHTML = `<div class="two">
      ${field("price", "Precio de venta (COP)", moneyInput("in-price", d.price, "Ej: 1.250.000"))}
      ${field("discount", "Descuento %", `<input id="in-disc" inputmode="numeric" maxlength="2" value="${esc(d.discount)}" placeholder="0">`, "Opcional")}
    </div>`;
  } else if (d.price_mode === "gramo") {
    box.innerHTML = `
      ${gp ? `<div class="info-line">Tu precio del gramo (oro 18K): <b>${cop(gp)}</b> · <a href="#/precios">cambiar</a></div>`
          : field("gold", "Primero: ¿a cómo vendes el gramo de oro 18K hoy?", moneyInput("in-gold", "", "Ej: 480.000"), "Se guarda para todas tus joyas por gramo. Lo cambias cuando quieras en Precios.")}
      <div class="two">
        ${field("weight", "Peso (gramos)", `<input id="in-weight2" inputmode="decimal" value="${esc(d.weight)}" placeholder="Ej: 3,5">`)}
        ${field("labor", "Hechura / diseño (COP)", moneyInput("in-labor", d.labor, "0"), "Se suma al valor del oro. Opcional.")}
      </div>
      ${field("discount", "Descuento %", `<input id="in-disc" inputmode="numeric" maxlength="2" value="${esc(d.discount)}" placeholder="0">`, "Opcional")}
      <div class="calc" id="calc"></div>`;
  } else {
    box.innerHTML = `<div class="info-line">En el catálogo dirá <b>«Precio a consultar»</b> y el botón de WhatsApp le pedirá el precio a tu asesor.</div>`;
  }
  const money = (id, key) => { const el = $(id); if (el) el.addEventListener("input", () => { el.value = formatThousands(el.value); d[key] = el.value; delete ed.errors[key]; touch(); renderPreview(); renderCalc(); }); };
  money("#in-price", "price"); money("#in-labor", "labor");
  const w2 = $("#in-weight2"); if (w2) w2.addEventListener("input", () => { d.weight = w2.value; delete ed.errors.weight; touch(); renderPreview(); renderCalc(); });
  const disc = $("#in-disc"); if (disc) disc.addEventListener("input", () => { disc.value = disc.value.replace(/\D/g, "").slice(0, 2); d.discount = disc.value; delete ed.errors.discount; touch(); renderPreview(); renderCalc(); });
  const gold = $("#in-gold"); if (gold) gold.addEventListener("input", () => { gold.value = formatThousands(gold.value); ed.pendingGold = parseMoney(gold.value); delete ed.errors.gold; renderPreview(); renderCalc(); });
  renderCalc();
}
function effectiveStore() {
  return ed.pendingGold ? { ...store, gold_price_18k: ed.pendingGold } : store;
}
function renderCalc() {
  const c = $("#calc");
  if (!c) return;
  const dp = draftProduct(), st = effectiveStore();
  if (!dp.weight_g || !st.gold_price_18k) { c.innerHTML = `<small class="muted">Escribe el peso para ver el precio.</small>`; return; }
  const pr = computePrice({ ...dp, price_mode: "gramo" }, st);
  c.innerHTML = `${num(dp.weight_g)} g × ${cop(st.gold_price_18k)}${dp.labor ? ` + hechura ${cop(dp.labor)}` : ""} = <b>${cop(pr.base)}</b>${dp.discount_pct ? ` · con ${dp.discount_pct}% off: <b>${cop(pr.final)}</b>` : ""}`;
}
function renderPreview() {
  const box = $("#preview");
  if (!box) return;
  const d = ed.data, st = effectiveStore();
  const p = { ...draftProduct(), name: cleanName(d.name) || "Nombre de la joya", material: d.material, availability: d.availability };
  const pr = computePrice(p, st);
  const cover = ed.photos.find((x) => !x.processing);
  const meta = [d.material, p.weight_g ? `${num(p.weight_g)} g` : "", d.size ? (d.category === "Anillos" ? `Talla ${d.size}` : d.size) : ""].filter(Boolean).join(" · ");
  const badge = d.availability === "agotado" ? "Agotado" : d.availability === "bajo_pedido" ? "Bajo pedido" : pr && p.discount_pct ? `-${p.discount_pct}%` : d.featured ? "Destacada" : "";
  box.innerHTML = `<div class="pcard">
      <div class="pcard-img">${cover ? `<img src="${esc(cover.preview)}" alt="">` : ""}${badge ? `<span class="pbadge">${esc(badge)}</span>` : ""}</div>
      <div class="pcard-info"><h4>${esc(p.name)}</h4><p>${esc(meta)}</p>
      <strong>${pr ? cop(pr.final) : "Precio a consultar"}${pr && p.discount_pct ? ` <s>${cop(pr.base)}</s>` : ""}</strong></div></div>`;
}

/* ---------- Validación ---------- */
function validateStep(step) {
  const d = ed.data, errs = {};
  if (step === 1) {
    if (ed.photos.some((p) => p.processing)) { toast("Espera a que terminen de arreglarse las fotos."); return false; }
    if (!ed.photos.length) errs.photos = "Agrega al menos una foto de la joya.";
  }
  if (step === 2) {
    if (!d.category) errs.category = "Elige qué tipo de joya es.";
    const n = cleanName(d.name);
    if (n.length < 2) errs.name = "Escribe el nombre de la joya.";
    else if (/^[A-Z0-9\-\/\.\s]+$/.test(n) && /\d/.test(n)) errs.name = "Usa un nombre bonito (ej: «Cadena cubana»), no un código.";
    if (!d.material || d.material.trim().length < 2) errs.material = "Elige o escribe el material.";
    const w = parseDecimal(d.weight);
    if (d.weight && (Number.isNaN(w) || w <= 0 || w >= 5000)) errs.weight = "Escribe el peso en gramos, por ejemplo 3,5.";
  }
  if (step === 3) {
    const dp = draftProduct();
    if (d.price_mode === "fijo" && (!dp.price || dp.price < 1000)) errs.price = "Escribe el precio (mínimo $1.000).";
    if (d.price_mode === "gramo") {
      if (!store.gold_price_18k && !(ed.pendingGold >= 1000)) errs.gold = "Escribe a cómo vendes el gramo.";
      const w = parseDecimal(d.weight);
      if (!w || Number.isNaN(w) || w <= 0) errs.weight = "Para vender por gramo, escribe el peso.";
    }
    if (dp.discount_pct > 90) errs.discount = "El descuento máximo es 90%.";
  }
  ed.errors = errs;
  const keys = Object.keys(errs);
  if (!keys.length) return true;
  renderEditorStepOnly();
  const first = $(`#f-${keys[0]}`) || $(`#err-${keys[0]}`);
  if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  return false;
}
function renderEditorStepOnly() {
  if (ed.step === 1) renderPhotosStep();
  if (ed.step === 2) renderDataStep();
  if (ed.step === 3) renderPriceStep();
}

/* ---------- Guardar ---------- */
async function saveEditor(status) {
  if (ed.saving) return;
  for (const s of [1, 2, 3]) {
    if (!validateStep(s)) { if (ed.step !== s) { ed.step = s; renderEditor(); validateStep(s); } return; }
  }
  if (!navigator.onLine) { alertBox("Sin internet", "Tu joya no se ha perdido: cuando vuelva la señal toca otra vez el botón."); return; }
  const d = ed.data;
  const product = {
    id: ed.id || undefined,
    name: cleanName(d.name), category: d.category, material: cleanName(d.material),
    weight_g: parseDecimal(d.weight) || null, size: d.size.trim() || null, stone: cleanName(d.stone) || null,
    description: d.description.trim() || null, price_mode: d.price_mode,
    price: d.price_mode === "fijo" ? parseMoney(d.price) : null,
    labor: d.price_mode === "gramo" ? parseMoney(d.labor) || 0 : 0,
    discount_pct: d.price_mode === "consultar" ? 0 : parseInt(d.discount, 10) || 0,
    availability: d.availability, featured: !!d.featured, status,
  };
  if (!product.id) delete product.id;
  ed.saving = true;
  const mine = ed;
  try {
    if (d.price_mode === "gramo" && ed.pendingGold && ed.pendingGold !== store.gold_price_18k) {
      busy("Guardando precio del gramo…");
      store = await api.updateStore({ gold_price_18k: ed.pendingGold, gold_price_updated_at: new Date().toISOString() });
    }
    busy("Preparando…");
    const saved = await api.saveProduct(product, mine.photos, mine.removed, (t) => busy(t));
    const i = products.findIndex((p) => p.id === saved.id);
    if (i >= 0) products[i] = saved; else products.unshift(saved);
    products.sort(productSorter);
    if (!mine.id) drafts.del(DRAFT_KEY).catch(() => {});
    mine.dirty = false;
    busy(false);
    ed = null;
    if (mine.id) { toast("Cambios guardados ✓"); location.hash = "#/"; return; }
    location.hash = "#/";
    await successSheet(saved);
  } catch (e) {
    busy(false);
    mine.saving = false;
    alertBox("No se pudo guardar", `${friendlyError(e)} Tu joya sigue aquí, no se perdió nada.`);
  }
}

function successSheet(p) {
  const live = p.status === "publicado";
  sheet(live ? `¡Listo! <b>${esc(p.name)}</b> ya está en tu catálogo` : `Guardada sin publicar: <b>${esc(p.name)}</b>`, [
    ...(live ? [{ icon: ICON.wa, label: "Compartirla por WhatsApp", run: () => sharePiece(p) },
                { icon: ICON.share, label: "Verla en el catálogo", run: () => window.open(pieceUrl(p), "_blank", "noopener") }] : []),
    { icon: ICON.cam, label: "Agregar otra joya", run: () => (location.hash = "#/nueva") },
  ]);
}

/* =====================================================================
   PRECIOS
   ===================================================================== */
function renderPrices() {
  setTitle("Precios");
  const perGram = products.filter((p) => p.price_mode === "gramo");
  const fixed = products.filter((p) => p.price_mode === "fijo" && p.price);
  $("#view").innerHTML = `
    <section class="card">
      <h2>Precio del gramo · oro 18K</h2>
      <p class="muted">Las joyas que vendes <b>por gramo</b> (${perGram.length}) cambian de precio solas cuando actualizas este valor.${store.gold_price_updated_at ? ` Última vez: ${timeAgo(store.gold_price_updated_at)}.` : ""}</p>
      <div class="row">${moneyInput("goldIn", store.gold_price_18k ? formatThousands(store.gold_price_18k) : "", "Ej: 480.000")}<button class="btn primary" id="goldSave">Guardar</button></div>
      <p class="form-error" id="goldErr" hidden></p>
      <div id="goldPreview" class="mini-list"></div>
    </section>
    <section class="card">
      <h2>Subir o bajar precios fijos</h2>
      <p class="muted">Cambia de una vez las ${fixed.length} joyas con <b>precio fijo</b>. Se redondea a $1.000.</p>
      <div class="chips">${[3, 5, 10, -5].map((v) => `<button class="chip" data-pct="${v}">${v > 0 ? "+" : ""}${v}%</button>`).join("")}</div>
      <div class="row"><div class="money"><input id="pctIn" inputmode="decimal" placeholder="Ej: 5 o -5"><span>%</span></div><button class="btn primary" id="pctApply" ${fixed.length ? "" : "disabled"}>Aplicar</button></div>
      <div id="pctPreview" class="mini-list"></div>
    </section>`;
  const goldIn = $("#goldIn");
  const previewGold = () => {
    const v = parseMoney(goldIn.value);
    const st = { ...store, gold_price_18k: v };
    $("#goldPreview").innerHTML = v && perGram.length ? perGram.slice(0, 4).map((p) => `<div><span>${esc(p.name)}</span><span>${esc(priceLabel(p, store))} → <b>${esc(priceLabel(p, st))}</b></span></div>`).join("") : "";
  };
  goldIn.addEventListener("input", () => { goldIn.value = formatThousands(goldIn.value); $("#goldErr").hidden = true; previewGold(); });
  $("#goldSave").onclick = async () => {
    const v = parseMoney(goldIn.value);
    if (!v || v < 1000 || v > 10000000) { $("#goldErr").textContent = "Escribe un valor válido, por ejemplo 480.000."; $("#goldErr").hidden = false; return; }
    busy("Guardando…");
    try {
      store = await api.updateStore({ gold_price_18k: v, gold_price_updated_at: new Date().toISOString() });
      toast(perGram.length ? `Listo: ${perGram.length} ${perGram.length === 1 ? "joya actualizada" : "joyas actualizadas"}` : "Precio del gramo guardado");
      renderPrices();
    } catch (e) { alertBox("No se pudo guardar", friendlyError(e)); }
    finally { busy(false); }
  };
  const pctIn = $("#pctIn");
  const previewPct = () => {
    const v = parseDecimal(pctIn.value);
    $("#pctPreview").innerHTML = v && !Number.isNaN(v) ? fixed.slice(0, 4).map((p) => {
      const np = Math.max(1000, Math.round((p.price * (1 + v / 100)) / 1000) * 1000);
      return `<div><span>${esc(p.name)}</span><span>${cop(p.price)} → <b>${cop(np)}</b></span></div>`;
    }).join("") + (fixed.length > 4 ? `<small class="muted">y ${fixed.length - 4} más…</small>` : "") : "";
  };
  pctIn.addEventListener("input", previewPct);
  $$("[data-pct]").forEach((b) => (b.onclick = () => { pctIn.value = b.dataset.pct; previewPct(); }));
  $("#pctApply").onclick = async () => {
    const v = parseDecimal(pctIn.value);
    if (!v || Number.isNaN(v) || v < -50 || v > 100) { alertBox("Porcentaje no válido", "Escribe un número entre -50 y 100. Por ejemplo 5 para subir 5%."); return; }
    const ok = await dialog({ title: `¿${v > 0 ? "Subir" : "Bajar"} ${Math.abs(v)}% los precios fijos?`, body: `<p>Se cambian ${fixed.length} joyas. Se puede deshacer aplicando el porcentaje contrario.</p>`, ok: "Sí, aplicar" });
    if (!ok) return;
    busy("Actualizando precios…");
    try {
      const n = await api.adjustFixedPrices(v);
      await refreshProducts();
      toast(`Listo: ${n} precios actualizados`);
      renderPrices();
    } catch (e) { alertBox("No se pudo aplicar", friendlyError(e)); }
    finally { busy(false); }
  };
  renderPromotions();
}

function renderPromotions() {
  const active = products.filter((p) => p.discount_pct > 0);
  const catCount = (cat) => products.filter((p) => !cat || p.category === cat).length;
  const box = document.createElement("section");
  box.className = "card";
  box.innerHTML = `
    <h2>Promociones</h2>
    <p class="muted">Pon un % de descuento a varias joyas de una vez (se ve tachado el precio anterior). No cambia el precio base — lo puedes quitar cuando quieras.${active.length ? ` Hoy tienes <b>${active.length}</b> ${active.length === 1 ? "joya" : "joyas"} en promoción.` : ""}</p>
    <div class="row">
      <select id="promoCat"><option value="">Todas las categorías (${catCount()})</option>${CATEGORIES.map((c) => `<option value="${c.id}">${c.id} (${catCount(c.id)})</option>`).join("")}</select>
      <div class="money"><input id="promoPct" inputmode="numeric" placeholder="Ej: 15"><span>%</span></div>
    </div>
    <div class="chips">${[10, 15, 20, 30].map((v) => `<button class="chip" data-promo="${v}">${v}%</button>`).join("")}</div>
    <div class="row"><button class="btn primary" id="promoApply">Aplicar promoción</button><button class="btn" id="promoClear">Quitar promoción</button></div>
    <p class="form-error" id="promoErr" hidden></p>`;
  $("#view").appendChild(box);

  const catSel = $("#promoCat"), pctIn = $("#promoPct");
  $$("[data-promo]").forEach((b) => (b.onclick = () => (pctIn.value = b.dataset.promo)));

  const run = async (pct, label) => {
    const cat = catSel.value || null;
    const affected = catCount(cat);
    if (!affected) { $("#promoErr").textContent = "No tienes joyas en esa categoría."; $("#promoErr").hidden = false; return; }
    const ok = await dialog({
      title: pct > 0 ? `¿Poner ${pct}% off en ${cat || "toda tu colección"}?` : `¿Quitar la promoción de ${cat || "toda tu colección"}?`,
      body: `<p>Afecta ${affected} ${affected === 1 ? "joya" : "joyas"}.</p>`,
      ok: "Sí, aplicar",
    });
    if (!ok) return;
    busy(label);
    try {
      const n = await api.applyPromotion(pct, cat);
      await refreshProducts();
      toast(pct > 0 ? `Listo: ${n} joyas con ${pct}% off` : `Listo: promoción quitada de ${n} joyas`);
      renderPrices();
    } catch (e) { alertBox("No se pudo aplicar", friendlyError(e)); }
    finally { busy(false); }
  };
  $("#promoApply").onclick = () => {
    const v = parseInt(pctIn.value, 10);
    if (!v || v < 1 || v > 90) { $("#promoErr").textContent = "Escribe un % entre 1 y 90."; $("#promoErr").hidden = false; return; }
    run(v, "Aplicando promoción…");
  };
  $("#promoClear").onclick = () => run(0, "Quitando promoción…");
}

/* =====================================================================
   MI JOYERÍA (datos que ven los clientes)
   ===================================================================== */
function renderStore() {
  setTitle("Mi joyería");
  const s = settingsOf(store);
  $("#view").innerHTML = `
    <form id="storeForm" class="card form" novalidate>
      <h2>Datos que ven tus clientes</h2>
      <label class="field"><span class="flabel">Nombre de la joyería</span><input name="name" maxlength="60" value="${esc(store.name)}" required></label>
      <label class="field"><span class="flabel">WhatsApp donde te escriben</span><input name="whatsapp" inputmode="tel" value="${esc(prettyWhatsapp(store.whatsapp))}" placeholder="300 123 4567"><small class="fhint">A este número llegan los pedidos del catálogo.</small></label>
      <label class="field"><span class="flabel">Dirección</span><input name="address" maxlength="120" value="${esc(s.address)}" placeholder="Ej: Calle 52 # 47-28, Of. 411, Edificio La Ceiba"></label>
      <div class="two">
        <label class="field"><span class="flabel">Ciudad</span><input name="city" maxlength="40" value="${esc(s.city)}"></label>
        <label class="field"><span class="flabel">Instagram</span><input name="instagram" maxlength="40" value="${esc(s.instagram)}" placeholder="sin @"></label>
      </div>
      <label class="field"><span class="flabel">Horario</span><input name="hours" maxlength="80" value="${esc(s.hours)}" placeholder="Ej: Lunes a sábado · 9 a. m. – 6 p. m."></label>

      <h3>Sellos de confianza</h3>
      <p class="muted">Frases cortas que dan seguridad. Salen arriba en tu catálogo.</p>
      ${[0, 1, 2].map((i) => `<input class="mb" name="trust${i}" maxlength="40" value="${esc(s.trust[i] || "")}" placeholder="${["Oro 18K garantizado", "Garantía de por vida", "Envíos a todo Colombia"][i]}">`).join("")}

      <h3>Formas de pago que aceptas</h3>
      <div class="toggles">${Object.entries(PAYMENT_LABELS).map(([k, l]) => `<label class="switch"><input type="checkbox" name="pay_${k}" ${s.payments[k] ? "checked" : ""}><span></span><em>${esc(l)}</em></label>`).join("")}</div>
      <label class="field"><span class="flabel">Link de pago (opcional)</span><input name="payment_link" inputmode="url" value="${esc(s.payment_link)}" placeholder="Ej: link de Wompi, Bold o Mercado Pago"></label>

      <details class="adv"><summary>Textos de la portada</summary>
        <label class="field"><span class="flabel">Frase pequeña</span><input name="hero_eyebrow" maxlength="40" value="${esc(s.hero_eyebrow)}"></label>
        <div class="two">
          <label class="field"><span class="flabel">Título</span><input name="hero_title" maxlength="40" value="${esc(s.hero_title)}"></label>
          <label class="field"><span class="flabel">Título (parte dorada)</span><input name="hero_highlight" maxlength="40" value="${esc(s.hero_highlight)}"></label>
        </div>
        <label class="field"><span class="flabel">Texto</span><textarea name="hero_text" rows="3" maxlength="220">${esc(s.hero_text)}</textarea></label>
      </details>
      <p class="form-error" id="storeErr" hidden></p>
      <button class="btn primary big full" type="submit">Guardar cambios</button>
    </form>`;
  $("#storeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), err = $("#storeErr");
    err.hidden = true;
    const name = cleanName(f.get("name"));
    const wa = normalizeWhatsapp(f.get("whatsapp"));
    if (name.length < 2) { err.textContent = "Escribe el nombre de la joyería."; err.hidden = false; return; }
    if (f.get("whatsapp") && !/^57\d{10}$|^\d{11,15}$/.test(wa)) { err.textContent = "El WhatsApp debe tener 10 números, por ejemplo 300 123 4567."; err.hidden = false; return; }
    const link = String(f.get("payment_link") || "").trim();
    if (link && !/^https:\/\/\S+\.\S+/.test(link)) { err.textContent = "El link de pago debe empezar por https://"; err.hidden = false; return; }
    const settings = {
      ...(store.settings || {}),
      address: f.get("address").trim(), city: f.get("city").trim(), hours: f.get("hours").trim(),
      instagram: String(f.get("instagram")).trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, ""),
      trust: [0, 1, 2].map((i) => String(f.get(`trust${i}`)).trim()).filter(Boolean),
      payments: Object.fromEntries(Object.keys(PAYMENT_LABELS).map((k) => [k, f.get(`pay_${k}`) === "on"])),
      payment_link: link,
      hero_eyebrow: f.get("hero_eyebrow").trim(), hero_title: f.get("hero_title").trim(),
      hero_highlight: f.get("hero_highlight").trim(), hero_text: f.get("hero_text").trim(),
    };
    busy("Guardando…");
    try {
      store = await api.updateStore({ name, whatsapp: wa || null, settings });
            toast("Datos guardados ✓");
    } catch (ex) { alertBox("No se pudo guardar", friendlyError(ex)); }
    finally { busy(false); }
  });
}

/* =====================================================================
   ESTADÍSTICAS
   ===================================================================== */
function renderStats() {
  setTitle("Visitas y ventas");
  const s = stats;
  const byId = new Map(products.map((p) => [p.id, p]));
  $("#view").innerHTML = `
    <section class="card">
      <h2>Últimos 30 días</h2>
      ${s ? `<div class="stat-row four">
        <div class="stat"><span>Visitas al catálogo</span><strong>${num(s.visitas)}</strong></div>
        <div class="stat"><span>Joyas vistas</span><strong>${num(s.vistas)}</strong></div>
        <div class="stat"><span>Te escribieron por WhatsApp</span><strong>${num(s.whatsapp)}</strong></div>
        <div class="stat"><span>Ventas este mes</span><strong>${num(s.ventasMes.count)}</strong><small>${cop(s.ventasMes.total)}</small></div>
      </div>` : `<p class="muted">Cargando… <button class="link-btn" id="retryStats">Reintentar</button></p>`}
    </section>
    <section class="card">
      <h2>Las joyas que más miran</h2>
      ${s && s.top.length ? `<div class="top-list">${s.top.map((t, i) => { const p = byId.get(t.product_id); return p ? `<div class="top-item"><span class="rank">${i + 1}</span><img src="${esc(productThumb(p))}" alt=""><span><b>${esc(p.name)}</b><small>${t.count} ${t.count === 1 ? "vista" : "vistas"}</small></span></div>` : ""; }).join("")}</div>` : `<p class="muted">Todavía no hay datos. Comparte tu catálogo para empezar a recibir visitas.</p>`}
    </section>
    <section class="card">
      <h2>Consigue más visitas</h2>
      <p class="muted">Pon este enlace en la biografía de tu Instagram y compártelo en tus estados de WhatsApp.</p>
      <div class="row"><input readonly value="${esc(catalogUrl())}" id="catLink"><button class="btn primary" id="copyLink">Copiar</button></div>
    </section>`;
  $("#retryStats") && ($("#retryStats").onclick = loadStats);
  $("#copyLink").onclick = async () => {
    try { await navigator.clipboard.writeText(catalogUrl()); toast("Enlace copiado ✓"); }
    catch { $("#catLink").select(); toast("Mantén presionado para copiar"); }
  };
}

boot();
