/* =====================================================================
   AUREON · catalog.js — Catálogo público de la joyería.
   Lee las joyas publicadas de la base de datos y todo lo demás
   (WhatsApp, pagos, dirección) de lo que el dueño llena en su panel.
   ===================================================================== */
import { CONFIG, AVAILABILITY, PAYMENT_LABELS, CATEGORIES, categoryInfo, useStoreCategories, GENDERS, genderOf, bundleOf, settingsOf, esc, cop, num, computePrice, applyTheme } from "./core.js";
import { getApi, friendlyError, productSorter } from "./api.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const VISUAL = { Collares: "necklace", Cadenas: "chain", Anillos: "ring", Aretes: "earrings", Pulseras: "bracelet" };
const savedKey = `aureon-saved-${CONFIG.storeSlug || "demo"}`;

let api, store, S, PRODUCTS = [];
const state = {
  query: "", gender: "todo", categories: new Set(), materials: new Set(), maxPrice: Infinity, priceCeil: 0, sort: "featured", onlyAvailable: false,
  selected: null, imageIndex: 0, showroom: [], showroomIndex: 0,
  saved: new Set((() => { try { return JSON.parse(localStorage.getItem(savedKey) || "[]"); } catch { return []; } })()),
};
const grid = $("#productGrid"), dialog = $("#productDialog");

/* ---------- Modelo de cada joya para mostrar ---------- */
function toView(p) {
  const pr = computePrice(p, store);
  const cat = categoryInfo(p.category);
  const imgs = (p.images || []).map((im) => ({ src: api.imageUrl(im.path), thumb: api.imageUrl(im.thumb || im.path) }));
  const sizeText = p.size ? (cat.sizeKind === "talla" ? `Talla ${p.size}` : cat.sizeKind === "largo" ? `${p.size}${/cm/i.test(p.size) ? "" : " cm"}` : p.size) : "";
  const meta = [p.material, p.weight_g ? `${num(p.weight_g)} g` : "", sizeText].filter(Boolean).join(" · ");
  let badge = "";
  if (p.availability === "agotado") badge = "Agotado";
  else if (p.availability === "bajo_pedido") badge = "Bajo pedido";
  else if (pr && p.discount_pct) badge = `-${p.discount_pct}%`;
  else if (p.featured) badge = "Destacada";
  const isBundle = bundleOf(p).length > 0;
  if (isBundle && p.availability !== "agotado" && p.availability !== "bajo_pedido" && !(pr && p.discount_pct)) badge = p.featured ? "Destacado · Paquete" : "Paquete";
  return {
    isBundle, items: [], sum: 0, mosaic: isBundle && !imgs.length,
    raw: p, id: p.id, ref: p.ref, name: p.name, category: p.category, gender: genderOf(p), material: p.material, meta,
    price: pr ? pr.final : null, basePrice: pr ? pr.base : null, priceText: pr ? cop(pr.final) : "Precio a consultar",
    images: imgs.length ? imgs : [{ src: "", thumb: "" }], visual: VISUAL[p.category] || "ring",
    badge, availability: p.availability, featured: p.featured, created: p.created_at,
    description: p.description || "", sizeText, stone: p.stone,
  };
}

/* Paquetes: une cada paquete con las joyas que incluye (solo las que están a la vista). */
function linkBundles() {
  const byId = new Map(PRODUCTS.map((p) => [p.id, p]));
  for (const p of PRODUCTS) {
    if (!p.isBundle) continue;
    p.items = bundleOf(p.raw).map((id) => byId.get(id)).filter(Boolean);
    p.sum = p.items.reduce((a, x) => a + (x.price || 0), 0);
    p.meta = `Paquete · ${p.items.length} ${p.items.length === 1 ? "pieza" : "piezas"}`;
    if (p.mosaic) p.images = p.items.map((x) => x.images[0]).filter((im) => im && im.src);
    if (!p.images.length) p.images = [{ src: "", thumb: "" }];
  }
}

/* ---------- WhatsApp ---------- */
function wa(text, productId = null) {
  api.track("whatsapp", productId);
  const n = store && store.whatsapp ? store.whatsapp : "";
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}
const pieceLink = (p) => `${location.origin}${location.pathname}#/pieza/${encodeURIComponent(p.ref)}`;

/* ---------- Tarjetas ---------- */
function card(p) {
  const saved = state.saved.has(p.id), out = p.availability === "agotado";
  return `<article class="product-card ${out ? "sold-out" : ""}" data-id="${esc(p.id)}">
    <button class="mini-fav ${saved ? "active" : ""}" aria-label="${saved ? "Quitar de" : "Guardar en"} favoritas" data-fav="${esc(p.id)}">${saved ? "◆" : "◇"}</button>
    <button class="product-open" data-open="${esc(p.id)}" aria-label="Ver ${esc(p.name)}">
      <div class="product-visual ${p.visual} ${p.mosaic ? "mosaic m" + Math.min(4, p.images.length) : ""}">
        ${p.mosaic ? p.images.slice(0, 4).map((im) => `<img class="pv-img" src="${esc(im.thumb)}" alt="" loading="lazy" decoding="async">`).join("")
          : p.images[0].thumb ? `<img class="pv-img" src="${esc(p.images[0].thumb)}" alt="${esc(p.name)}" loading="lazy" decoding="async">` : ""}
        ${p.badge ? `<span class="product-badge ${out ? "out" : ""}">${esc(p.badge)}</span>` : ""}
        <span class="quick-view">Contemplar</span>
      </div>
      <div class="card-info">
        <h3>${esc(p.name)}</h3>
        <p class="card-meta">${esc(p.meta)}</p>
        <span class="card-price ${p.price ? "" : "consult"}">${esc(p.priceText)}${p.price && p.basePrice !== p.price ? ` <s>${cop(p.basePrice)}</s>` : p.isBundle && p.price && p.sum > p.price ? ` <s>${cop(p.sum)}</s>` : ""}</span>
        <small class="card-ref">Ref. ${esc(p.ref)}</small>
      </div>
    </button>
  </article>`;
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  let list = PRODUCTS.filter((p) =>
    (!q || `${p.name} ${p.category} ${p.material} ${p.ref} ${p.stone || ""}`.toLowerCase().includes(q)) &&
    (!state.categories.size || state.categories.has(p.category)) &&
    (state.gender === "todo" || p.gender === state.gender || p.gender === "unisex") &&
    (!state.materials.size || state.materials.has(p.material)) &&
    (!state.onlyAvailable || p.availability !== "agotado") &&
    (state.maxPrice === Infinity || p.price == null || p.price <= state.maxPrice));
  const outLast = (a, b) => (a.availability === "agotado") - (b.availability === "agotado");
  if (state.sort === "priceAsc") list.sort((a, b) => outLast(a, b) || (a.price ?? 9e15) - (b.price ?? 9e15));
  if (state.sort === "priceDesc") list.sort((a, b) => outLast(a, b) || (b.price ?? -1) - (a.price ?? -1));
  if (state.sort === "new") list.sort((a, b) => outLast(a, b) || new Date(b.created) - new Date(a.created));
  return list;
}

function render() {
  const list = filtered();
  grid.innerHTML = list.map(card).join("");
  $("#resultLabel").textContent = `${list.length} ${list.length === 1 ? "pieza" : "piezas"}`;
  $("#emptyState").hidden = !!list.length || !PRODUCTS.length;
  $("#onboardingState").hidden = !!PRODUCTS.length;
  grid.hidden = !list.length;
  const active = state.categories.size + (state.gender !== "todo" ? 1 : 0) + state.materials.size + (state.maxPrice < state.priceCeil ? 1 : 0) + (state.query ? 1 : 0) + (state.onlyAvailable ? 1 : 0);
  $("#activeFilterCount").textContent = active;
  $("#clearFiltersTop").hidden = !active;
  $$("[data-gender]").forEach((b) => { const on = b.dataset.gender === state.gender; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
  $$(".category-pill").forEach((b) => b.classList.toggle("active", b.dataset.category === "Todas" ? !state.categories.size : state.categories.has(b.dataset.category)));
  $$("[data-open]").forEach((b) => (b.onclick = () => openProduct(b.dataset.open)));
  $$("[data-fav]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); toggleSaved(b.dataset.fav); }));
}

function skeleton() {
  grid.innerHTML = Array.from({ length: 8 }, () => `<article class="product-card skeleton"><div class="product-visual"></div><div class="card-info"><i></i><i></i><i></i></div></article>`).join("");
}

/* ---------- Favoritas ---------- */
function toggleSaved(id) {
  state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
  try { localStorage.setItem(savedKey, JSON.stringify([...state.saved])); } catch {}
  render(); renderSaved(); updateSavedCount();
  if (state.selected && state.selected.id === id) updateFavoriteButton();
  toast(state.saved.has(id) ? "Guardada en tus favoritas" : "Quitada de favoritas");
}
function updateSavedCount() { $("#savedCount").textContent = [...state.saved].filter((id) => PRODUCTS.some((p) => p.id === id)).length; }
function renderSaved() {
  const list = PRODUCTS.filter((p) => state.saved.has(p.id));
  $("#savedList").innerHTML = list.length
    ? list.map((p) => `<div class="saved-item"><img src="${esc(p.images[0].thumb)}" alt=""><div><b>${esc(p.name)}</b><small>${esc(p.priceText)} · ${esc(p.ref)}</small></div><button data-remove="${esc(p.id)}" aria-label="Quitar ${esc(p.name)}">×</button></div>`).join("")
    : `<div class="saved-empty">Aún no has guardado joyas.<br>Toca ◇ en las que te gusten.</div>`;
  $$("[data-remove]").forEach((b) => (b.onclick = () => toggleSaved(b.dataset.remove)));
}

/* ---------- Detalle de la joya ---------- */
function openProduct(id, { fromHash = false } = {}) {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) return;
  state.selected = p; state.imageIndex = 0;
  api.track("vista_pieza", p.id);
  resetDeepZoom();
  showImage(0);
  $("#dialogVisual").setAttribute("aria-label", p.name);
  $("#dialogCategory").textContent = `${p.category.toUpperCase()} · REF. ${p.ref}`;
  $("#dialogName").textContent = p.name;
  $("#dialogPrice").innerHTML = p.price
    ? `${cop(p.price)}${p.basePrice !== p.price ? ` <s>${cop(p.basePrice)}</s>` : p.isBundle && p.sum > p.price ? ` <s>${cop(p.sum)}</s>` : ""}`
    : `<span class="consult">Precio a consultar</span>`;
  $("#dialogDescription").textContent = p.description;
  const bx = $("#dialogBundle");
  bx.hidden = !p.isBundle;
  if (p.isBundle) {
    const save = p.price && p.sum > p.price ? p.sum - p.price : 0;
    bx.innerHTML = `<p class="bundle-title">Incluye ${p.items.length} ${p.items.length === 1 ? "pieza" : "piezas"}</p>
      <ul>${p.items.map((x) => `<li><button type="button" data-item="${esc(x.id)}"><img src="${esc(x.images[0].thumb)}" alt=""><span><b>${esc(x.name)}</b><small>${esc(x.meta)}</small></span><em>${esc(x.priceText)}</em></button></li>`).join("")}</ul>
      ${save ? `<p class="bundle-save"><span>Por separado ${cop(p.sum)}</span><b>Ahorras ${cop(save)}</b></p>` : ""}`;
    $$("[data-item]").forEach((b) => (b.onclick = () => openProduct(b.dataset.item)));
  }
  const specs = p.isBundle ? [["Referencia", p.ref], ["Para", GENDERS[p.gender]], ["Disponibilidad", AVAILABILITY[p.availability]]] : [["Referencia", p.ref], ["Material", p.material], ["Peso", p.raw.weight_g ? `${num(p.raw.weight_g)} g` : ""],
    [categoryInfo(p.category).size || "Medida", p.sizeText], ["Piedra", p.stone], ["Para", GENDERS[p.gender]], ["Disponibilidad", AVAILABILITY[p.availability]]];
  specs.splice(0, specs.length, ...specs.filter(([, v]) => v));
  $("#dialogSpecs").innerHTML = specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  const out = p.availability === "agotado";
  $("#buyWhatsapp").innerHTML = out ? "Preguntar por una similar <span>↗</span>" : p.price ? "Pedir por WhatsApp <span>↗</span>" : "Preguntar precio por WhatsApp <span>↗</span>";
  const credit = S.payments.addi || S.payments.sistecredito || S.payments.plan_separe;
  $("#dialogInstallments").hidden = !credit || out;
  $("#dialogTrust").textContent = S.trust.join(" · ");
  const thumbs = p.images.filter((i) => i.thumb);
  $("#galleryThumbs").innerHTML = thumbs.length > 1 ? thumbs.map((im, i) => `<button data-img="${i}" class="${i === 0 ? "active" : ""}" aria-label="Foto ${i + 1}"><img src="${esc(im.thumb)}" alt=""></button>`).join("") : "";
  $$("[data-img]").forEach((b) => (b.onclick = () => showImage(+b.dataset.img)));
  updateFavoriteButton();
  if (!dialog.open) dialog.showModal();
  if (!fromHash) history.replaceState(null, "", `#/pieza/${encodeURIComponent(p.ref)}`);
}
function showImage(i) {
  const p = state.selected;
  state.imageIndex = i;
  resetDeepZoom();
  const v = $("#dialogVisual");
  v.className = `product-visual xl zoomable ${p.visual}`;
  // La foto va como <img> centrada y con los bordes fundidos en la gamuza: se ve la joya completa, sin recortes.
  v.style.backgroundImage = "none";
  v.innerHTML = p.images[i].src ? `<img class="xl-img" src="${esc(p.images[i].src)}" alt="${esc(p.name)}" draggable="false">` : "";
  $$("[data-img]").forEach((b) => b.classList.toggle("active", +b.dataset.img === i));
}
function updateFavoriteButton() {
  const on = state.saved.has(state.selected && state.selected.id);
  $("#dialogFavorite").classList.toggle("active", on);
  $("#dialogFavorite").textContent = on ? "Reservada ✦" : "Reservar ✧";
}
function closeDialog() {
  if (dialog.open) dialog.close();
}
dialog.addEventListener("close", () => {
  if (location.hash.startsWith("#/pieza/")) history.replaceState(null, "", location.pathname + location.search);
});

/* Lupa: computador sigue el mouse; celular toca para ampliar. */
function initDeepZoom() {
  const media = $(".dialog-media"), visual = $("#dialogVisual");
  const setOrigin = (x, y) => {
    const r = media.getBoundingClientRect();
    visual.style.transformOrigin = `${Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100))}% ${Math.min(100, Math.max(0, ((y - r.top) / r.height) * 100))}%`;
  };
  visual.addEventListener("mouseenter", (e) => { media.classList.add("zoom-active"); visual.classList.add("zoomed"); setOrigin(e.clientX, e.clientY); });
  visual.addEventListener("mousemove", (e) => setOrigin(e.clientX, e.clientY));
  visual.addEventListener("mouseleave", () => { media.classList.remove("zoom-active"); visual.classList.remove("zoomed"); });
  visual.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    if (visual.classList.contains("zoomed")) { visual.classList.remove("zoomed"); media.classList.remove("zoom-active"); return; }
    setOrigin(t.clientX, t.clientY); visual.classList.add("zoomed"); media.classList.add("zoom-active");
  }, { passive: true });
  visual.addEventListener("touchmove", (e) => { if (visual.classList.contains("zoomed")) { const t = e.changedTouches[0]; setOrigin(t.clientX, t.clientY); } }, { passive: true });
}
function resetDeepZoom() {
  const v = $("#dialogVisual");
  v.classList.remove("zoomed"); $(".dialog-media").classList.remove("zoom-active"); v.style.transformOrigin = "";
}

/* ---------- Destacadas (sala) ---------- */
function renderShowroom(animate = true) {
  const list = state.showroom, p = list[state.showroomIndex];
  if (!p) return;
  if (animate) { $("#showroomShell").classList.add("switching"); setTimeout(() => $("#showroomShell").classList.remove("switching"), 320); }
  const img = $("#showroomImage");
  img.src = p.images[0].src; img.alt = p.name;
  $("#showroomCategory").textContent = p.category.toUpperCase();
  $("#showroomIndex").textContent = `${String(state.showroomIndex + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
  $("#showroomRef").textContent = `REF. ${p.ref} · ${p.material.toUpperCase()}`;
  $("#showroomName").textContent = p.name;
  $("#showroomDescription").textContent = p.description;
  $("#showroomPrice").innerHTML = `<strong>${esc(p.priceText)}</strong>${p.meta ? `<span>${esc(p.meta)}</span>` : ""}`;
  $("#showroomProgress").innerHTML = list.map((it, i) => `<button class="${i === state.showroomIndex ? "active" : ""}" data-showroom="${i}" aria-label="Ver ${esc(it.name)}"></button>`).join("");
  $$("[data-showroom]").forEach((b) => (b.onclick = () => { state.showroomIndex = +b.dataset.showroom; renderShowroom(); }));
}
function moveShowroom(step) {
  const n = state.showroom.length;
  if (!n) return;
  state.showroomIndex = (state.showroomIndex + step + n) % n;
  renderShowroom();
}

/* ---------- Paneles, filtros, avisos ---------- */
function openPanel(panel) { $("#scrim").hidden = false; panel.classList.add("open"); panel.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; if (panel.id === "filterPanel") $("#openFilters").setAttribute("aria-expanded", "true"); }
function closePanels() { $$(".side-panel").forEach((p) => { p.classList.remove("open"); p.setAttribute("aria-hidden", "true"); }); $("#scrim").hidden = true; document.body.style.overflow = ""; $("#openFilters").setAttribute("aria-expanded", "false"); }
function updateRange() {
  const v = Number($("#maxPrice").value);
  state.maxPrice = !state.priceCeil || v >= state.priceCeil ? Infinity : v;
  $("#maxPriceOutput").textContent = state.maxPrice === Infinity ? "Sin límite" : cop(v);
}
function resetFilters() {
  state.query = ""; state.gender = "todo"; state.categories.clear(); state.materials.clear(); state.sort = "featured"; state.onlyAvailable = false;
  $("#catalogSearch").value = ""; $("#filterSearch").value = ""; $("#sortSelect").value = "featured"; $("#onlyAvailable").checked = false;
  $("#maxPrice").value = $("#maxPrice").max;
  $$("#categoryFilters input,#materialFilters input").forEach((i) => (i.checked = false));
  updateRange(); render();
}
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200); }

/* ---------- Video de la mano (reemplaza al diamante si está configurado) ----------
   Se reproduce una vez al entrar, se queda quieto en el último cuadro y el
   cliente puede arrastrarlo a los lados para ver la joya desde otros ángulos. */
function initHeroVideo() {
  const cfg = (window.AUREON_CONFIG && window.AUREON_CONFIG.heroVideo) || {};
  const stage = $("#diamondPlayground"), v = $("#heroVideo");
  if (!cfg.src || !stage || !v) return false;
  stage.classList.add("has-video");
  v.hidden = false;
  if (cfg.poster) v.poster = cfg.poster;
  const narrow = matchMedia("(max-width: 760px)").matches;
  v.src = (narrow && cfg.srcMobile) || cfg.src;
  const hint = stage.querySelector(".drag-hint");
  if (hint) hint.innerHTML = "<b>DESLIZA PARA VERLA DESDE OTRO ÁNGULO</b>";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ready = false;
  const toEnd = () => { if (v.duration) { v.pause(); v.currentTime = Math.max(0, v.duration - 0.05); } };
  v.addEventListener("loadedmetadata", () => { ready = true; if (reduce) toEnd(); else v.play().catch(toEnd); });
  v.addEventListener("ended", () => { v.pause(); stage.classList.add("video-done"); });
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    if (!ready || (e.pointerType === "mouse" && e.button !== 0)) return;
    v.pause(); stage.classList.add("video-done", "dragging");
    drag = { x: e.clientX, t: v.currentTime, w: stage.clientWidth };
    stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const span = Math.min(v.duration, cfg.scrubSeconds || v.duration);
    const t = drag.t - ((e.clientX - drag.x) / drag.w) * span;
    v.currentTime = Math.max(0, Math.min(v.duration - 0.05, t));
  });
  const end = (e) => { if (!drag) return; drag = null; stage.classList.remove("dragging"); try { stage.releasePointerCapture(e.pointerId); } catch {} };
  stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
  return true;
}

/* ---------- Diamante 3D ---------- */
function initInteractiveDiamond() {
  if (initHeroVideo()) return;
  const stage = $("#diamondPlayground"), diamond = $("#heroDiamond");
  if (!stage || !diamond) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer = null;
  try { renderer = window.createAureonDiamond && window.createAureonDiamond(diamond); } catch (e) { console.warn("3D", e); }
  if (!renderer) { stage.classList.add("webgl-fallback"); return; }
  const m = { angle: 0, velocity: 0.35, dragging: false, lastX: 0, lastT: 0, lastFrame: performance.now(), visible: true };
  new IntersectionObserver(([e]) => (m.visible = e.isIntersecting)).observe(stage);
  const frame = (now) => {
    const dt = Math.min(2, (now - m.lastFrame) / 16.667 || 1); m.lastFrame = now;
    if (m.visible) {
      if (!m.dragging && !reduce) { m.angle += m.velocity * dt; m.velocity = m.velocity * Math.pow(0.955, dt) + 0.012 * dt; }
      renderer.render(m.angle % 36000, reduce ? 0 : m.velocity);
      stage.classList.toggle("fast", Math.abs(m.velocity) > 4);
    }
    requestAnimationFrame(frame);
  };
  const start = (e) => { if (e.target !== diamond || (e.pointerType === "mouse" && e.button !== 0)) return; m.dragging = true; m.lastX = e.clientX; m.lastT = e.timeStamp; m.velocity = 0; stage.classList.add("dragging"); stage.setPointerCapture && stage.setPointerCapture(e.pointerId); };
  const move = (e) => { if (!m.dragging) return; const dt = Math.max(8, e.timeStamp - m.lastT), dx = e.clientX - m.lastX; m.angle += dx * 0.34; m.velocity = Math.max(-5, Math.min(5, (dx / dt) * 16 * 0.34)); m.lastX = e.clientX; m.lastT = e.timeStamp; };
  const end = (e) => { if (!m.dragging) return; m.dragging = false; stage.classList.remove("dragging"); try { stage.releasePointerCapture(e.pointerId); } catch {} };
  stage.addEventListener("pointerdown", start); stage.addEventListener("pointermove", move); stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
  requestAnimationFrame(frame);
}

/* ---------- Datos de la joyería (lo que el dueño llena en su panel) ---------- */
function applyStore() {
  S = settingsOf(store);
  document.title = `${store.name} · Catálogo de joyería`;
  document.querySelector('meta[property="og:title"]').setAttribute("content", `${store.name} · Catálogo`);
  $("#heroEyebrow").textContent = S.hero_eyebrow || `JOYERÍA · ${(S.city || "").toUpperCase()}`;
  $("#heroTitle").textContent = S.hero_title;
  $("#heroHighlight").textContent = S.hero_highlight;
  $("#heroText").textContent = S.hero_text;
  $("#trustRow").innerHTML = S.trust.map((t) => `<span>${esc(t)}</span>`).join("");
  // Pagos
  const pays = Object.entries(PAYMENT_LABELS).filter(([k]) => S.payments[k]);
  $("#payChips").innerHTML = pays.map(([k, l]) => `<span class="pay-chip ${k === "addi" || k === "sistecredito" ? "credit" : ""}">${esc(l)}</span>`).join("");
  const credit = [S.payments.addi && "Addi", S.payments.sistecredito && "Sistecrédito"].filter(Boolean);
  $("#payText").textContent = credit.length
    ? `Cuotas con ${credit.join(" o ")}${S.payments.plan_separe ? " o Plan Separe" : ""}.`
    : S.payments.plan_separe ? "Sepárala con un abono." : "Confirmamos todo por WhatsApp.";
  $("#payAsk").textContent = credit.length || S.payments.plan_separe ? "Consultar cuotas" : "Formas de pago";
  $("#pagos").hidden = !pays.length;
  if (S.payment_link) { $("#payLink").href = S.payment_link; $("#payLink").hidden = false; }
  // Visítanos
  $("#visitName").textContent = store.name;
  const rows = [["Dirección", [S.address, S.city].filter(Boolean).join(", ")], ["Horario", S.hours], ["WhatsApp", store.whatsapp ? `+${store.whatsapp.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3 $4")}` : ""]].filter(([, v]) => v);
  $("#visitList").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
  $("#visitanos").hidden = !rows.length;
  if (S.address) { $("#mapLink").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([S.address, S.city, "Colombia"].filter(Boolean).join(", "))}`; $("#mapLink").hidden = false; }
  if (S.instagram) { $("#igLink").href = `https://instagram.com/${encodeURIComponent(S.instagram)}`; $("#igLink").hidden = false; }
  $("#footerLine").textContent = [S.address && S.city ? S.city : S.city, "Asesoría por WhatsApp"].filter(Boolean).join(" · ");
}

/* ---------- Botones ---------- */
function bindUI() {
  $("#openFilters").onclick = () => openPanel($("#filterPanel"));
  $("#openFiltersAlt").onclick = () => openPanel($("#filterPanel"));
  $("#openClient").onclick = () => { renderSaved(); openPanel($("#clientPanel")); };
  $$("[data-close]").forEach((b) => (b.onclick = closePanels));
  $("#scrim").onclick = closePanels;
  $("#applyFilters").onclick = closePanels;
  $("#resetFilters").onclick = resetFilters; $("#clearFiltersTop").onclick = resetFilters; $("#emptyClear").onclick = resetFilters;
  $("#dialogFavorite").onclick = () => toggleSaved(state.selected.id);
  $("[data-dialog-close]").onclick = closeDialog;
  dialog.onclick = (e) => { if (e.target === dialog) closeDialog(); };
  $("#showroomPrev").onclick = () => moveShowroom(-1);
  $("#showroomNext").onclick = () => moveShowroom(1);
  $("#showroomDetails").onclick = () => state.showroom[state.showroomIndex] && openProduct(state.showroom[state.showroomIndex].id);
  $("#showroomBuy").onclick = () => { const p = state.showroom[state.showroomIndex]; if (p) buy(p); };
  let tx = 0;
  $("#showroomShell").addEventListener("touchstart", (e) => (tx = e.changedTouches[0].clientX), { passive: true });
  $("#showroomShell").addEventListener("touchend", (e) => { const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 55) moveShowroom(d > 0 ? -1 : 1); }, { passive: true });
  $("#buyWhatsapp").onclick = () => buy(state.selected);
  $("#dialogInstallments").onclick = () => {
    const p = state.selected, opts = [S.payments.addi && "Addi", S.payments.sistecredito && "Sistecrédito", S.payments.plan_separe && "Plan Separe"].filter(Boolean);
    wa(`Hola ${store.name}, quiero esta joya en cuotas:\n\n${p.name} (Ref. ${p.ref}) — ${p.priceText}\n${pieceLink(p)}\n\n¿Cómo funciona con ${opts.join(" / ")}?`, p.id);
  };
  $("#dialogShare").onclick = async () => {
    const p = state.selected, url = pieceLink(p);
    if (navigator.share) { try { await navigator.share({ title: p.name, text: `${p.name} · ${p.priceText}`, url }); } catch {} return; }
    try { await navigator.clipboard.writeText(url); toast("Enlace copiado"); } catch { prompt("Copia el enlace:", url); }
  };
  $("#sendSaved").onclick = () => {
    const list = PRODUCTS.filter((p) => state.saved.has(p.id));
    if (!list.length) return toast("Guarda al menos una joya");
    wa(`Hola ${store.name}, me interesan estas joyas:\n\n${list.map((p) => `• ${p.name} (Ref. ${p.ref}) — ${p.priceText}`).join("\n")}\n\n¿Me confirman disponibilidad?`);
  };
  $("#payAsk").onclick = () => wa(`Hola ${store.name}, quiero saber cómo puedo pagar en cuotas o separar una joya.`);
  $$("[data-whatsapp]").forEach((b) => (b.onclick = () => wa(`Hola ${store.name}, quiero asesoría sobre su catálogo de joyas.`)));
  window.addEventListener("scroll", () => $("#topbar").classList.toggle("scrolled", scrollY > 30), { passive: true });
  $("#retryLoad").onclick = load;
  $("#catalogSearch").oninput = (e) => { state.query = e.target.value; $("#filterSearch").value = e.target.value; render(); };
  $("#filterSearch").oninput = (e) => { state.query = e.target.value; $("#catalogSearch").value = e.target.value; render(); };
  $("#maxPrice").oninput = () => { updateRange(); render(); };
  $("#sortSelect").onchange = (e) => { state.sort = e.target.value; render(); };
  $("#onlyAvailable").onchange = (e) => { state.onlyAvailable = e.target.checked; render(); };
  window.addEventListener("hashchange", openFromHash);
  initDeepZoom();
}

function buy(p) {
  const out = p.availability === "agotado";
  const lines = out
    ? `Hola ${store.name}, vi esta joya agotada y quiero algo similar:\n\n${p.name} (Ref. ${p.ref})\n${pieceLink(p)}`
    : p.isBundle
    ? `Hola ${store.name}, quiero este paquete:\n\n${p.name} (Ref. ${p.ref})\n${p.items.map((x) => `• ${x.name} (Ref. ${x.ref})`).join("\n")}\n${p.price ? `Precio del paquete: ${p.priceText}` : "¿Qué precio tiene?"}\n${pieceLink(p)}\n\n¿Está disponible?`
    : `Hola ${store.name}, quiero esta joya:\n\n${p.name}\nRef. ${p.ref}${p.meta ? `\n${p.meta}` : ""}\n${p.price ? `Precio: ${p.priceText}` : "¿Qué precio tiene?"}\n${pieceLink(p)}\n\n¿Está disponible?`;
  wa(lines, p.id);
}

function openFromHash() {
  const m = location.hash.match(/^#\/pieza\/(.+)$/);
  if (!m) return;
  const ref = decodeURIComponent(m[1]).toUpperCase();
  const p = PRODUCTS.find((x) => x.ref === ref);
  if (p) openProduct(p.id, { fromHash: true });
  else toast("Esa joya ya no está en el catálogo");
}

function buildFilters() {
  const used = new Set(PRODUCTS.map((p) => p.category));
  const cats = [...CATEGORIES.map((c) => c.id).filter((id) => used.has(id)), ...[...used].filter((id) => !CATEGORIES.some((c) => c.id === id))];
  const genders = new Set(PRODUCTS.map((p) => p.gender));
  $("#genderSwitch").hidden = !(genders.has("hombre") && (genders.has("mujer") || genders.has("unisex")));
  $$("[data-gender]").forEach((b) => (b.onclick = () => { state.gender = b.dataset.gender; render(); }));
  const mats = [...new Set(PRODUCTS.map((p) => p.material))];
  $("#categoryStrip").innerHTML = ["Todas", ...cats].map((c) => `<button class="category-pill ${c === "Todas" ? "active" : ""}" data-category="${esc(c)}">${esc(c)}</button>`).join("");
  $("#categoryFilters").innerHTML = cats.map((c) => `<label class="check-label"><input type="checkbox" value="${esc(c)}">${esc(c)}</label>`).join("");
  $("#materialFilters").innerHTML = mats.map((c) => `<label class="check-label"><input type="checkbox" value="${esc(c)}">${esc(c)}</label>`).join("");
  $$(".category-pill").forEach((b) => (b.onclick = () => {
    state.categories.clear();
    if (b.dataset.category !== "Todas") state.categories.add(b.dataset.category);
    $$("#categoryFilters input").forEach((i) => (i.checked = state.categories.has(i.value)));
    render();
  }));
  $$("#categoryFilters input").forEach((i) => (i.onchange = () => { state.categories = new Set($$("#categoryFilters input:checked").map((x) => x.value)); render(); }));
  $$("#materialFilters input").forEach((i) => (i.onchange = () => { state.materials = new Set($$("#materialFilters input:checked").map((x) => x.value)); render(); }));
  const prices = PRODUCTS.map((p) => p.price).filter(Boolean);
  const top = prices.length ? Math.max(...prices) : 0;
  const step = top > 5e6 ? 250000 : 50000;
  const ceil = top ? Math.ceil(top / step) * step : 0;   // múltiplo exacto del paso: la barra nunca esconde la joya más cara
  state.priceCeil = ceil;
  $("#priceGroup").hidden = !ceil;
  const r = $("#maxPrice");
  r.min = 0; r.step = step; r.max = ceil || 1000000; r.value = r.max;
  updateRange();
}

async function load() {
  $("#errorState").hidden = true;
  $("#emptyState").hidden = true;
  $("#onboardingState").hidden = true;
  skeleton(); grid.hidden = false;
  try {
    store = await api.getStore();
    useStoreCategories(store);
    applyStore();
    const hiddenPanels = new Set(CATEGORIES.filter((c) => c.hidden).map((c) => c.id));
    const rows = (await api.listPublicProducts()).filter((p) => !hiddenPanels.has(p.category)).sort(productSorter);
    PRODUCTS = rows.map(toView);
    linkBundles();
  } catch (e) {
    grid.innerHTML = ""; grid.hidden = true;
    $("#emptyState").hidden = true;
    $("#onboardingState").hidden = true;
    $("#errorText").textContent = friendlyError(e);
    $("#errorState").hidden = false;
    $("#resultLabel").textContent = "";
    return;
  }
  $("#pieceCount").textContent = PRODUCTS.filter((p) => p.availability !== "agotado").length;
  buildFilters();
  updateSavedCount();
  render();
  if (!PRODUCTS.length) { $("#resultLabel").textContent = "Muy pronto verás aquí nuestras joyas."; }
  state.showroom = PRODUCTS.filter((p) => p.featured && p.availability !== "agotado" && p.images[0].src);
  if (state.showroom.length < 3) state.showroom = PRODUCTS.filter((p) => p.availability !== "agotado" && p.images[0].src).slice(0, 8);
  $("#showroom").hidden = state.showroom.length < 2;
  renderShowroom(false);
  openFromHash();
  try { if (!sessionStorage.getItem("aureon-visit")) { sessionStorage.setItem("aureon-visit", "1"); api.track("visita"); } } catch {}
}

function revealInstantly(target) {
  if (!target) return;
  if (target.classList && target.classList.contains("reveal")) target.classList.add("visible");
  target.querySelectorAll?.(".reveal").forEach((el) => el.classList.add("visible"));
}


/* El botón flotante de WhatsApp se esconde al bajar y vuelve al subir, para no tapar textos. */
(() => { const w = document.querySelector(".wa-float"); if (!w) return; let y = scrollY;
  addEventListener("scroll", () => { const d = scrollY - y; if (Math.abs(d) < 8) return; w.classList.toggle("away", d > 0 && scrollY > 300); y = scrollY; }, { passive: true }); })();

async function init() {
  applyTheme();
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("visible")), { threshold: 0.12 });
  $$(".reveal").forEach((el) => io.observe(el));
  // Los saltos instantáneos (clic en enlaces "#ancla" o carga directa con hash en la URL)
  // no disparan el scroll gradual que activa el fundido de aparición; lo revelamos de una vez
  // para evitar el parpadeo/gap en blanco justo tras el salto.
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    if (id) revealInstantly(document.getElementById(id));
  });
  window.addEventListener("hashchange", () => revealInstantly(document.getElementById(location.hash.slice(1))));
  if (location.hash) revealInstantly(document.getElementById(location.hash.slice(1)));
  try { api = await getApi(); }
  catch (e) { $("#errorText").textContent = friendlyError(e); $("#errorState").hidden = false; $("#resultLabel").textContent = ""; return; }
  bindUI();
  // (el diamante 3D fue reemplazado por el lookbook del yate: js/lookbook.js)
  await load();
}

init();
