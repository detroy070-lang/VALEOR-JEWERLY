/* =====================================================================
   VALEOR · lookbook.js — Cuadro de la modelo (inicio del catálogo).
   El scroll NO mueve la animación: bajar lleva directo al catálogo.
   Al tocar una joya (miniaturas, puntos dorados sobre la foto, o
   deslizando el cuadro en el celular) la cámara va a esa pieza.
   Entre dos joyas el cambio es directo, sin volver a la escena completa.
   ===================================================================== */
const sec = document.getElementById("inicio");
const frame = document.getElementById("lbFrame");
const canvas = document.getElementById("lbCanvas");
if (sec && frame && canvas) {
  const AR = 928 / 1020;                               // proporción de la foto de la modelo
  const closes = [...sec.querySelectorAll(".lb-close")];
  const chapters = [...sec.querySelectorAll(".lb-chapter")];
  const steps = [...sec.querySelectorAll(".lb-steps button")];
  const spots = [...sec.querySelectorAll(".lb-spot")];
  const plaqueT = document.getElementById("lbPlaqueTitle"), plaqueS = document.getElementById("lbPlaqueSub");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Encuadre de cada vista sobre la foto principal: [foco x, foco y, zoom]
  const CAM = [[0.54, 0.50, 1.0], [0.556, 0.68, 2.2], [0.30, 0.32, 1.7], [0.78, 0.30, 1.7]];
  const PLAQUE = [["Valeor", "Colección · Oro 18K"], ["Camándula balín", "50 cm · Oro 18K"], ["Pulsos trébol", "Oro 18K"], ["Topos balín", "7 mm · Oro 18K"]];

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lin = (a, b, t) => a + (b - a) * t;

  // Estado visible ahora mismo (se interpola desde aquí, aunque haya una animación a medias)
  const st = { cam: CAM[0].slice(), op: [0, 0, 0] };
  let view = 0, anim = null, W = 0, H = 0, cw = 0, ch = 0;

  function render() {
    const [fx, fy, s] = st.cam;
    const tx = clamp(W / 2 - fx * cw * s, W - cw * s, 0);
    const ty = clamp(H / 2 - fy * ch * s, H - ch * s, 0);
    canvas.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
    closes.forEach((img, k) => {
      const o = st.op[k];
      img.style.opacity = o.toFixed(3);
      img.style.transform = `scale(${(1.06 - 0.06 * o).toFixed(4)})`;   // se asienta suave al aparecer
    });
    // Puntos dorados sobre cada joya (solo en la escena completa)
    spots.forEach((b, k) => {
      const [px, py] = CAM[k + 1];
      b.style.left = (tx + px * cw * s).toFixed(1) + "px";
      b.style.top = (ty + py * ch * s).toFixed(1) + "px";
    });
  }

  function measure() {
    W = frame.clientWidth; H = frame.clientHeight;
    cw = Math.max(W, H * AR); ch = cw / AR;
    canvas.style.width = cw + "px"; canvas.style.height = ch + "px";
    render();
  }

  function setChrome(k) {
    chapters.forEach((el, i) => el.classList.toggle("is-on", i === k));
    steps.forEach((b) => { const on = +b.dataset.go === k; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    sec.classList.toggle("lb-at-scene", k === 0);
    if (plaqueT) { plaqueT.textContent = PLAQUE[k][0]; plaqueS.textContent = PLAQUE[k][1]; }
  }

  function goTo(k) {
    if (k === view && !anim) return;
    const from = { cam: st.cam.slice(), op: st.op.slice() };
    const target = { cam: CAM[k].slice(), op: [0, 1, 2].map((i) => (i === k - 1 ? 1 : 0)) };
    const showing = Math.max(...from.op);
    // Tiempos (ms) de cada parte según el tipo de cambio
    let camT, opIn, opOut, dur;
    if (k === 0) {                         // joya → escena completa: se va el detalle y la cámara se aleja
      opOut = [0, 650]; opIn = [0, 1]; camT = [180, 1200]; dur = 1200;
    } else if (showing > 0.9) {            // joya → otra joya: cambio directo, sin pasar por la escena
      st.cam = from.cam = CAM[k].slice();  // la foto de fondo está tapada: se reubica sin que se note
      opIn = [0, 800]; opOut = [800, 801]; camT = [0, 1]; dur = 820;   // la nueva entra encima; la anterior se quita al final
    } else {                               // escena → joya: la cámara se acerca y aparece el detalle
      camT = [0, 850]; opIn = [480, 1150]; opOut = [0, 400]; dur = 1150;
    }
    if (reduce) dur = 1;
    closes.forEach((img, i) => (img.style.zIndex = i === k - 1 ? 2 : 1));
    view = k; setChrome(k);
    const t0 = performance.now();
    const part = (t, [a, b]) => (reduce ? 1 : ease(clamp((t - a) / (b - a))));
    const id = Symbol(); anim = id;
    const step = (now) => {
      if (anim !== id) return;
      const t = now - t0;
      const c = part(t, camT);
      st.cam = [lin(from.cam[0], target.cam[0], c), lin(from.cam[1], target.cam[1], c), Math.exp(lin(Math.log(from.cam[2]), Math.log(target.cam[2]), c))];
      st.op = from.op.map((o, i) => (target.op[i] > o ? lin(o, 1, part(t, opIn)) : lin(o, target.op[i], part(t, opOut))));
      render();
      if (t < dur) requestAnimationFrame(step); else anim = null;
    };
    requestAnimationFrame(step);
  }

  // Miniaturas: clic/toque, y en computador también al pasar el mouse (con una pequeña pausa)
  const hover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  steps.forEach((b) => {
    b.addEventListener("click", () => goTo(+b.dataset.go));
    if (hover) {
      let t; b.addEventListener("mouseenter", () => { t = setTimeout(() => goTo(+b.dataset.go), 220); });
      b.addEventListener("mouseleave", () => clearTimeout(t));
    }
  });
  spots.forEach((b) => b.addEventListener("click", () => goTo(+b.dataset.go)));

  // Celular: deslizar el cuadro a los lados pasa a la joya siguiente / anterior
  let sx = 0, sy = 0;
  frame.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  frame.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) goTo((view + (dx < 0 ? 1 : 3)) % 4);
  }, { passive: true });

  // Flechas del teclado cuando el foco está en el cuadro o las miniaturas
  sec.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goTo((view + 1) % 4);
    if (e.key === "ArrowLeft") goTo((view + 3) % 4);
  });

  // "Ver aretes / collares / pulseras": filtra la colección por esa categoría y baja.
  sec.querySelectorAll("[data-shop]").forEach((b) => b.addEventListener("click", () => {
    const cat = b.dataset.shop.toLowerCase();
    const pill = [...document.querySelectorAll(".category-pill")].find((x) => (x.dataset.category || "").toLowerCase() === cat);
    if (pill) pill.click();
    const target = document.getElementById("catalogo");
    target.querySelectorAll(".reveal").forEach((el) => el.classList.add("visible"));
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  // En el inicio ya hay botón de Asesoría (WhatsApp): el botón flotante aparece al bajar
  const waf = document.querySelector(".wa-float");
  if (waf) new IntersectionObserver(([e]) => waf.classList.toggle("lb-hide", e.intersectionRatio > 0.45), { threshold: [0, 0.45, 1] }).observe(sec);

  addEventListener("resize", measure);
  new ResizeObserver(measure).observe(frame);
  setChrome(0);
  measure();
}
