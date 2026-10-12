/* =====================================================================
   AUREON · photo.js — arreglo automático de fotos, 100 % en el celular.
   • Endereza la foto (orientación del celular).
   • Mejora la luz con cuidado (sin cambiar el color del oro).
   • Reduce el peso: foto grande de máx. 1600 px + miniatura cuadrada.
   • Revisa si está borrosa, oscura o muy pequeña y lo avisa.
   ===================================================================== */

const MAX_SIDE = 1600;
const THUMB = 640;

async function decode(file) {
  if (file.type && /heic|heif/i.test(file.type) && !/safari/i.test(navigator.userAgent)) {
    throw new Error("Esta foto está en formato HEIC (iPhone). Tómala con el botón «Tomar foto» o cámbiala a JPG.");
  }
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error("No pudimos abrir esa foto. Intenta con otra o tómala de nuevo.");
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }
}

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

let webpOk = null;
async function toBlob(canvas, quality) {
  const attempt = (type) => new Promise((res) => canvas.toBlob(res, type, quality));
  if (webpOk !== false) {
    const b = await attempt("image/webp");
    if (b && b.type === "image/webp") { webpOk = true; return b; }
    webpOk = false; // Safari viejo devuelve PNG: usamos JPG
  }
  const j = await attempt("image/jpeg");
  if (!j) throw new Error("No pudimos procesar la foto. Intenta de nuevo.");
  return j;
}

/** Estira suavemente los niveles de luz (mismo factor para R, G y B: no cambia el tono). */
function autoLight(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  const step = Math.max(1, Math.floor((w * h) / 250000));
  let total = 0;
  for (let i = 0; i < d.length; i += 4 * step) {
    hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++;
    total++;
  }
  const pct = (p) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * p) return v; } return 255; };
  const lo = pct(0.005), hi = pct(0.998);
  if (hi - lo < 40) return false;                   // foto plana: no tocar
  if (hi >= 205) return false;                      // ya tiene buenos brillos: no tocar
  const off = Math.min(lo, 10);
  const gain = Math.min(235 / Math.max(1, hi - off), 1.3); // nunca más de +30 %
  if (gain < 1.04) return false;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = (v - off) * gain;
  for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
  ctx.putImageData(img, 0, 0);
  return true;
}

/** Revisa nitidez y luz en una copia pequeña. */
function analyze(source, sw, sh) {
  const W = 512, H = Math.max(1, Math.round((sh / sw) * W));
  const c = canvasOf(W, H), ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const g = new Float32Array(W * H);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  // Nitidez: varianza del Laplaciano en la mejor zona (la joya), no en todo el fondo.
  const T = 4, tw = Math.floor(W / T), th = Math.floor(H / T);
  let best = 0;
  for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
    let s = 0, s2 = 0, n = 0;
    for (let y = Math.max(1, ty * th); y < Math.min(H - 1, (ty + 1) * th); y++) {
      for (let x = Math.max(1, tx * tw); x < Math.min(W - 1, (tx + 1) * tw); x++) {
        const k = y * W + x;
        const lap = g[k - W] + g[k + W] + g[k - 1] + g[k + 1] - 4 * g[k];
        s += lap; s2 += lap * lap; n++;
      }
    }
    if (n) best = Math.max(best, s2 / n - (s / n) ** 2);
  }
  const sorted = Array.from(g).sort((a, b) => a - b);
  const p98 = sorted[Math.floor(sorted.length * 0.98)];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return { sharpness: best, highlights: p98, mean };
}

/**
 * Procesa un archivo de foto.
 * Devuelve { main:{blob,w,h}, thumb:{blob,w,h}, preview, warnings[] }
 */
export async function processPhoto(file, { rotate = 0 } = {}) {
  if (!file || !/^image\//.test(file.type || "image/")) throw new Error("Ese archivo no es una foto.");
  if (file.size > 40 * 1024 * 1024) throw new Error("La foto es demasiado pesada (más de 40 MB).");
  const src = await decode(file);
  let sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  if (!sw || !sh) throw new Error("No pudimos leer esa foto.");

  // 1. Foto grande (con giro opcional)
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  let w = Math.round(sw * scale), h = Math.round(sh * scale);
  const turned = rotate % 180 !== 0;
  const main = canvasOf(turned ? h : w, turned ? w : h);
  const mctx = main.getContext("2d", { willReadFrequently: true });
  mctx.imageSmoothingQuality = "high";
  mctx.translate(main.width / 2, main.height / 2);
  mctx.rotate((rotate * Math.PI) / 180);
  mctx.drawImage(src, -w / 2, -h / 2, w, h);
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  if (src.close) src.close();
  [w, h] = [main.width, main.height];

  const q = analyze(main, w, h);
  const lightened = autoLight(mctx, w, h);

  // 2. Miniatura cuadrada centrada
  const s = Math.min(w, h);
  const th = canvasOf(THUMB, THUMB);
  const tctx = th.getContext("2d");
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(main, (w - s) / 2, (h - s) / 2, s, s, 0, 0, THUMB, THUMB);

  const [mainBlob, thumbBlob] = await Promise.all([toBlob(main, 0.86), toBlob(th, 0.84)]);

  const warnings = [];
  if (Math.min(sw, sh) < 600) warnings.push({ code: "small", text: "Foto muy pequeña: acércate más o usa la cámara del celular." });
  if (q.sharpness < 200) warnings.push({ code: "blur", text: "Parece borrosa: apoya el celular y toca la pantalla sobre la joya para enfocar." });
  if (q.highlights < 110) warnings.push({ code: "dark", text: "Está muy oscura: busca más luz (ventana o lámpara blanca), sin flash." });
  if (q.mean > 150) warnings.push({ code: "bright", text: "Fondo muy claro: con fondo negro u oscuro tu joya se ve más elegante." });

  return {
    main: { blob: mainBlob, w, h },
    thumb: { blob: thumbBlob, w: THUMB, h: THUMB },
    preview: URL.createObjectURL(thumbBlob),
    warnings,
    lightened,
    quality: q,
  };
}
