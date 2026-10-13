/* =====================================================================
   AUREON · api.js — capa de datos.
   Dos motores con la MISMA forma:
     • supabase → base de datos real (lo que usa el cliente de verdad)
     • demo     → todo en este navegador (para mostrar el sistema a
                  prospectos sin tocar datos reales)
   ===================================================================== */
import { CONFIG, idb, uuid, computePrice, categoriesOf } from "./core.js";
import { JOYAS_INICIALES, PANELES_INICIALES } from "./joyas-iniciales.js";

const BUCKET = "joyas";
const assetBase = () => (location.pathname.includes("/admin") ? "../assets/" : "assets/");
const SUPABASE_CDN = "./vendor/supabase.js";   // librería de Supabase servida desde el propio sitio (no depende de CDN externos)

const PRODUCT_FIELDS = [
  "name", "category", "gender", "material", "weight_g", "size", "stone", "description",
  "price_mode", "price", "labor", "discount_pct", "availability", "status", "featured", "images", "bundle",
];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

/* ---------- Mensajes de error en español claro ---------- */
export function friendlyError(err) {
  const raw = String((err && (err.message || err.error_description || err.error)) || err || "");
  const m = raw.toLowerCase();
  if (!navigator.onLine || m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed") || m.includes("network request failed"))
    return "Sin conexión a internet. Revisa tu señal y vuelve a intentar.";
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Tu cuenta aún no está activada. Escríbele a soporte.";
  if (m.includes("jwt expired") || m.includes("invalid jwt") || m.includes("refresh token")) return "Tu sesión se venció. Vuelve a entrar.";
  if (m.includes("row-level security") || m.includes("permission denied") || m.includes("no autorizado")) return "No tienes permiso para hacer esto. Vuelve a entrar o escribe a soporte.";
  if (m.includes("products_ref_unique")) return "Ya existe una joya con esa referencia.";
  if (m.includes("products_price_ok")) return "Falta el precio (o el peso, si es precio por gramo).";
  if (m.includes("products_name_check")) return "El nombre debe tener entre 2 y 80 letras.";
  if (m.includes("payload too large") || m.includes("exceeded the maximum allowed size") || m.includes("413")) return "La foto es muy pesada. Intenta con otra.";
  if (m.includes("mime type") || m.includes("invalid_mime_type")) return "Ese tipo de archivo no es una foto válida.";
  if (m.includes("check constraint")) return "Hay un dato que no es válido. Revisa el formulario.";
  if (m.includes("porcentaje")) return raw;
  return raw && raw.length < 140 ? raw : "Algo salió mal. Intenta de nuevo en un momento.";
}

async function withRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      const m = String(e && e.message || e).toLowerCase();
      const network = m.includes("fetch") || m.includes("network") || m.includes("timeout") || m.includes("load failed");
      if (!network || i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

const throwIf = ({ data, error, count }) => {
  if (error) throw error;
  return count !== undefined && count !== null ? { data, count } : data;
};

const sinceISO = (days) => new Date(Date.now() - days * 864e5).toISOString();
const monthStartISO = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); };

function tallyTop(rows, n = 5) {
  const counts = new Map();
  rows.forEach((r) => r.product_id && counts.set(r.product_id, (counts.get(r.product_id) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([product_id, count]) => ({ product_id, count }));
}

/* =====================================================================
   Motor 1 · Supabase
   ===================================================================== */
async function createSupabaseApi() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) throw new Error("Falta configurar la conexión a la base de datos (config.js).");
  const { createClient } = await import(SUPABASE_CDN);
  const sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: `aureon-${CONFIG.storeSlug}` },
  });
  let store = null;

  const publicUrl = (path) => sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  async function uploadImage(path, blob) {
    await withRetry(async () => {
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type || "image/jpeg", cacheControl: "31536000", upsert: false,
      });
      if (error) throw error;
    });
  }
  async function removeImages(paths) {
    const list = paths.filter(Boolean);
    if (!list.length) return;
    try { await sb.storage.from(BUCKET).remove(list); } catch (e) { console.warn("No se pudieron borrar fotos viejas", e); }
  }

  return {
    mode: "supabase",
    imageUrl: (path) => (!path ? "" : path.startsWith("assets/") ? assetBase() + path.slice(7) : /^(https?:|data:|blob:|\.\.\/assets\/)/.test(path) ? path : publicUrl(path)),

    async getStore() {
      store = throwIf(await withRetry(() => sb.from("stores").select("*").eq("slug", CONFIG.storeSlug).maybeSingle()));
      if (!store) throw new Error("No encontramos esta joyería. Revisa la configuración.");
      if (!store.whatsapp && CONFIG.storeWhatsapp) store.whatsapp = CONFIG.storeWhatsapp;
      return store;
    },
    async listPublicProducts() {
      if (!store) await this.getStore();
      return throwIf(await withRetry(() =>
        sb.from("products").select("*").eq("store_id", store.id).eq("status", "publicado")
          .order("featured", { ascending: false }).order("created_at", { ascending: false })));
    },
    track(type, productId = null) {
      if (!store) return;
      sb.from("events").insert({ store_id: store.id, product_id: productId, type }).then(() => {}, () => {});
    },

    /* ----- sesión ----- */
    async currentUser() {
      const { data } = await sb.auth.getSession();
      return (data && data.session && data.session.user) || null;
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      return data.user;
    },
    async signOut() { await sb.auth.signOut(); store = null; },
    onAuthChange(cb) { sb.auth.onAuthStateChange((event, session) => cb(event, session && session.user)); },

    /* ----- dueño ----- */
    async getMyStore() {
      const user = await this.currentUser();
      if (!user) throw new Error("Tu sesión se venció. Vuelve a entrar.");
      const s = throwIf(await withRetry(() => sb.from("stores").select("*").eq("slug", CONFIG.storeSlug).maybeSingle()));
      if (!s || s.owner_id !== user.id) throw new Error("Este usuario no es el dueño de esta joyería. Escribe a soporte.");
      if (!s.whatsapp && CONFIG.storeWhatsapp) s.whatsapp = CONFIG.storeWhatsapp;
      store = s;
      return s;
    },
    async listMyProducts() {
      return throwIf(await withRetry(() =>
        sb.from("products").select("*").eq("store_id", store.id)
          .order("featured", { ascending: false }).order("created_at", { ascending: false })));
    },

    /**
     * Guarda una joya nueva o editada.
     * photos: lista ordenada; cada una es {path,thumb,w,h} (ya subida) o {main:{blob,w,h}, thumb:{blob}} (nueva).
     * removed: fotos ya subidas que la persona quitó.
     */
    async saveProduct(product, photos, removed = [], onProgress = () => {}) {
      const isNew = !product.id;
      const id = product.id || uuid();
      const uploaded = [];
      const images = [];
      const fresh = photos.filter((p) => p.main);
      let done = 0;
      try {
        for (const ph of photos) {
          if (!ph.main) { images.push({ path: ph.path, thumb: ph.thumb, w: ph.w, h: ph.h }); continue; }
          onProgress(`Subiendo foto ${++done} de ${fresh.length}…`);
          const key = uuid().slice(0, 8);
          const ext = (ph.main.blob.type || "").includes("webp") ? "webp" : "jpg";
          const path = `${store.id}/${id}/${key}.${ext}`;
          const thumb = `${store.id}/${id}/${key}_t.${ext}`;
          await uploadImage(path, ph.main.blob); uploaded.push(path);
          await uploadImage(thumb, ph.thumb.blob); uploaded.push(thumb);
          images.push({ path, thumb, w: ph.main.w, h: ph.main.h });
        }
        onProgress("Guardando la joya…");
        const row = pick({ ...product, images }, PRODUCT_FIELDS);
        if (isNew) {
          const panel = categoriesOf(store).find((c) => c.id === row.category);
          const prefix = (panel && panel.prefix) || "OT";
          const refs = throwIf(await withRetry(() => sb.from("products").select("ref").eq("store_id", store.id).like("ref", `${prefix}-%`)));
          const n = Math.max(0, ...(refs || []).map((r) => parseInt(String(r.ref).split("-")[1], 10) || 0)) + 1;
          row.ref = `${prefix}-${String(n).padStart(3, "0")}`;
        }
        const saved = isNew
          ? throwIf(await withRetry(() => sb.from("products").insert({ ...row, id, store_id: store.id }).select().single()))
          : throwIf(await withRetry(() => sb.from("products").update(row).eq("id", id).select().single()));
        removeImages(removed.flatMap((r) => [r.path, r.thumb]));
        return saved;
      } catch (e) {
        removeImages(uploaded);
        throw e;
      }
    },
    async updateProduct(id, patch) {
      return throwIf(await withRetry(() => sb.from("products").update(pick(patch, [...PRODUCT_FIELDS, "sold_at"])).eq("id", id).select().single()));
    },
    async deleteProduct(p) {
      throwIf(await withRetry(() => sb.from("products").delete().eq("id", p.id)));
      removeImages((p.images || []).flatMap((i) => [i.path, i.thumb]));
    },
    async updateStore(patch) {
      store = throwIf(await withRetry(() =>
        sb.from("stores").update(pick(patch, ["name", "whatsapp", "gold_price_18k", "gold_price_updated_at", "settings"])).eq("id", store.id).select().single()));
      return store;
    },
    async adjustFixedPrices(pct) {
      return throwIf(await sb.rpc("adjust_fixed_prices", { p_store: store.id, p_pct: pct }));
    },
    async applyPromotion(pct, category) {
      let q = sb.from("products").update({ discount_pct: pct }).eq("store_id", store.id);
      if (category) q = q.eq("category", category);
      const rows = throwIf(await withRetry(() => q.select("id")));
      return rows.length;
    },
    async recordSale(p, amount) {
      throwIf(await withRetry(() => sb.from("sales").insert({ store_id: store.id, product_id: p.id, product_name: p.name, amount })));
      return this.updateProduct(p.id, { availability: "agotado", sold_at: new Date().toISOString() });
    },
    async stats(days = 30) {
      const since = sinceISO(days);
      const count = async (type) =>
        (throwIf(await sb.from("events").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("type", type).gte("created_at", since)).count) || 0;
      const [visitas, vistas, whatsapp] = await Promise.all([count("visita"), count("vista_pieza"), count("whatsapp")]);
      const views = throwIf(await sb.from("events").select("product_id").eq("store_id", store.id).eq("type", "vista_pieza").gte("created_at", since).limit(5000));
      const sales = throwIf(await sb.from("sales").select("amount").eq("store_id", store.id).gte("created_at", monthStartISO()));
      return {
        visitas, vistas, whatsapp,
        top: tallyTop(views || []),
        ventasMes: { count: sales.length, total: sales.reduce((a, s) => a + (s.amount || 0), 0) },
      };
    },
  };
}

/* =====================================================================
   Motor 2 · Demo (todo queda en este navegador)
   ===================================================================== */
const DEMO_KEY = "aureon-demo-v5";

function demoSeed() {
  const now = Date.now(), gold = Number(CONFIG.precioGramo18k) || null;
  return {
    store: {
      id: "demo-store", slug: "demo", name: "Valeor", whatsapp: (CONFIG.storeWhatsapp || ""), gold_price_18k: gold,
      gold_price_updated_at: gold ? new Date(now).toISOString() : null, active: true,
      settings: {
        address: "", city: "Medellín", hours: "",
        categories: PANELES_INICIALES.map((id) => ({ id })),
        instagram: "", trust: ["Oro 18K", "Estuche incluido", "Envío asegurado"],
        hero_eyebrow: "Medellín", hero_title: "Cada pieza,", hero_highlight: "una herencia.",
        hero_text: "Oro 18K. Asesoría privada por WhatsApp.",
        payments: { addi: false, sistecredito: false, plan_separe: true, transferencia: true, tarjeta: false, efectivo: true },
      },
    },
    products: JOYAS_INICIALES.map((j, i) => ({
      id: `inicial-${j.ref}`, store_id: "demo-store", price_mode: "gramo", price: null, labor: 0, discount_pct: 0,
      availability: "disponible", status: "publicado", sold_at: null, bundle: [],
      created_at: new Date(now - i * 6e4).toISOString(), updated_at: new Date(now).toISOString(), ...j,
    })),
    events: [], sales: [],
  };
}

async function createDemoApi() {
  const blobs = idb("aureon-demo-img", "img");
  const urlCache = new Map();
  let db;
  const load = () => {
    try { db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { db = null; }
    if (!db || !db.store) { db = demoSeed(); save(); }
  };
  const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) { console.warn("Demo: sin espacio", e); } };
  const nextRef = (category) => {
    const panel = categoriesOf(db.store).find((c) => c.id === category);
    const prefix = (panel && panel.prefix) || "OT";
    const n = Math.max(0, ...db.products.filter((p) => p.ref.startsWith(prefix + "-")).map((p) => parseInt(p.ref.slice(3), 10) || 0)) + 1;
    return `${prefix}-${String(n).padStart(3, "0")}`;
  };
  async function hydrate(list) {
    for (const p of list) for (const im of p.images || []) for (const k of [im.path, im.thumb]) {
      if (k && k.startsWith("demo-upload/") && !urlCache.has(k)) {
        const b = await blobs.get(k);
        if (b) urlCache.set(k, URL.createObjectURL(b));
      }
    }
    return list;
  }
  const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  const user = () => { try { return JSON.parse(sessionStorage.getItem("aureon-demo-user")); } catch { return null; } };
  const listeners = [];
  load();

  return {
    mode: "demo",
    imageUrl(path) {
      if (!path) return "";
      if (path.startsWith("assets/")) return assetBase() + path.slice(7);
      return urlCache.get(path) || (path.startsWith("demo-upload/") ? "" : path);
    },
    async getStore() { load(); return db.store; },
    async listPublicProducts() {
      load(); await delay();
      return hydrate(db.products.filter((p) => p.status === "publicado").sort(sorter));
    },
    track(type, productId = null) {
      load(); db.events.push({ type, product_id: productId, created_at: new Date().toISOString() }); db.events = db.events.slice(-3000); save();
    },
    async currentUser() { return user(); },
    async signIn(email, password) {
      await delay(300);
      if (!email || !email.includes("@")) throw new Error("Escribe un correo válido.");
      if (password !== ((CONFIG.demo && CONFIG.demo.password) || "demo1234")) throw new Error("Invalid login credentials");
      const u = { id: "demo-user", email };
      sessionStorage.setItem("aureon-demo-user", JSON.stringify(u));
      listeners.forEach((cb) => cb("SIGNED_IN", u));
      return u;
    },
    async signOut() { sessionStorage.removeItem("aureon-demo-user"); listeners.forEach((cb) => cb("SIGNED_OUT", null)); },
    onAuthChange(cb) { listeners.push(cb); },
    async getMyStore() { if (!user()) throw new Error("Tu sesión se venció. Vuelve a entrar."); load(); return db.store; },
    async listMyProducts() { load(); await delay(); return hydrate([...db.products].sort(sorter)); },
    async saveProduct(product, photos, removed = [], onProgress = () => {}) {
      load();
      const isNew = !product.id;
      const id = product.id || uuid();
      const images = [];
      let done = 0;
      const fresh = photos.filter((p) => p.main).length;
      for (const ph of photos) {
        if (!ph.main) { images.push({ path: ph.path, thumb: ph.thumb, w: ph.w, h: ph.h }); continue; }
        onProgress(`Subiendo foto ${++done} de ${fresh}…`);
        await delay(250);
        const key = `demo-upload/${id}/${uuid().slice(0, 8)}`;
        await blobs.set(key, ph.main.blob); await blobs.set(key + "_t", ph.thumb.blob);
        images.push({ path: key, thumb: key + "_t", w: ph.main.w, h: ph.main.h });
      }
      onProgress("Guardando la joya…");
      await delay(200);
      const row = pick({ ...product, images }, PRODUCT_FIELDS);
      validateDemo(row);
      let saved;
      if (isNew) {
        saved = { id, store_id: db.store.id, ref: nextRef(row.category), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sold_at: null, labor: 0, discount_pct: 0, featured: false, ...row };
        db.products.push(saved);
      } else {
        const i = db.products.findIndex((p) => p.id === id);
        saved = db.products[i] = { ...db.products[i], ...row, updated_at: new Date().toISOString() };
      }
      save();
      for (const r of removed) { blobs.del(r.path).catch(() => {}); blobs.del(r.thumb).catch(() => {}); }
      return (await hydrate([saved]))[0];
    },
    async updateProduct(id, patch) {
      load();
      const i = db.products.findIndex((p) => p.id === id);
      if (i < 0) throw new Error("La joya ya no existe.");
      db.products[i] = { ...db.products[i], ...pick(patch, [...PRODUCT_FIELDS, "sold_at"]), updated_at: new Date().toISOString() };
      validateDemo(db.products[i]);
      save();
      return db.products[i];
    },
    async deleteProduct(p) { load(); db.products = db.products.filter((x) => x.id !== p.id); save(); },
    async updateStore(patch) {
      load(); db.store = { ...db.store, ...pick(patch, ["name", "whatsapp", "gold_price_18k", "gold_price_updated_at", "settings"]) }; save(); return db.store;
    },
    async adjustFixedPrices(pct) {
      if (!pct || pct < -50 || pct > 100) throw new Error("El porcentaje debe estar entre -50% y 100%");
      load(); let n = 0;
      db.products.forEach((p) => { if (p.price_mode === "fijo" && p.price) { p.price = Math.max(1000, Math.round((p.price * (1 + pct / 100)) / 1000) * 1000); n++; } });
      save(); return n;
    },
    async applyPromotion(pct, category) {
      load(); let n = 0;
      db.products.forEach((p) => { if (!category || p.category === category) { p.discount_pct = pct; n++; } });
      save(); return n;
    },
    async recordSale(p, amount) {
      load(); db.sales.push({ product_id: p.id, product_name: p.name, amount, created_at: new Date().toISOString() }); save();
      return this.updateProduct(p.id, { availability: "agotado", sold_at: new Date().toISOString() });
    },
    async stats(days = 30) {
      load();
      const since = Date.now() - days * 864e5, ms = new Date(monthStartISO()).getTime();
      const ev = db.events.filter((e) => new Date(e.created_at).getTime() >= since);
      const sales = db.sales.filter((s) => new Date(s.created_at).getTime() >= ms);
      return {
        visitas: ev.filter((e) => e.type === "visita").length,
        vistas: ev.filter((e) => e.type === "vista_pieza").length,
        whatsapp: ev.filter((e) => e.type === "whatsapp").length,
        top: tallyTop(ev.filter((e) => e.type === "vista_pieza")),
        ventasMes: { count: sales.length, total: sales.reduce((a, s) => a + s.amount, 0) },
      };
    },
    resetDemo() { localStorage.removeItem(DEMO_KEY); load(); },
  };
}

function validateDemo(p) {
  if (!p.name || p.name.trim().length < 2) throw new Error("products_name_check");
  if (p.price_mode === "fijo" && !p.price) throw new Error("products_price_ok");
  if (p.price_mode === "gramo" && !p.weight_g) throw new Error("products_price_ok");
}

const AVAIL_ORDER = { disponible: 0, bajo_pedido: 1, agotado: 2 };
function sorter(a, b) {
  return (AVAIL_ORDER[a.availability] - AVAIL_ORDER[b.availability]) ||
    (b.featured - a.featured) ||
    (new Date(b.created_at) - new Date(a.created_at));
}
export { sorter as productSorter };

let apiPromise;
export function getApi() {
  return (apiPromise ||= CONFIG.backend === "supabase" ? createSupabaseApi() : createDemoApi());
}
export { computePrice };
