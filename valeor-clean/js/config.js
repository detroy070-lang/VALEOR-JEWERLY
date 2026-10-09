/* =====================================================================
   AUREON · config.js — EL ÚNICO ARCHIVO QUE SE CAMBIA POR CADA JOYERÍA
   ---------------------------------------------------------------------
   1. backend: "demo" funciona sin base de datos (para mostrar a clientes).
               "supabase" usa la base de datos real.
   2. supabaseUrl / supabaseAnonKey: se copian de Supabase → Project
      Settings → API. (La "anon key" es pública; no es un secreto.)
   3. storeSlug: el identificador de la joyería en la base de datos.
   4. brand: cómo se ve el logo. Déjalo vacío y el catálogo muestra un
      espacio marcado ("Aquí va tu logo") en lugar de inventar uno.
   5. support: tu WhatsApp de soporte (el dueño te escribe si algo falla).
   ===================================================================== */
window.AUREON_CONFIG = {
  // ⚠️ PENDIENTE: cambia a "supabase" cuando tengas tu proyecto listo.
  // Mientras tanto queda en "demo" para que el sitio funcione sin base de datos.
  backend: "demo",

  // ⚠️ PENDIENTE — copia esto de tu proyecto Supabase → Project Settings → API:
  supabaseUrl: "",           // ej: "https://xxxxxxxx.supabase.co"
  supabaseAnonKey: "",       // la "anon key" (pública, no es un secreto)
  storeSlug: "valeor",       // identificador de la joyería en la base de datos
  storeWhatsapp: "573005466740", // WhatsApp Business de Valéor: aquí llegan los pedidos del catálogo

  // Video de la mano poniéndose el anillo (reemplaza al diamante del inicio).
  // Déjalo en "" y se sigue viendo el diamante. Ver GUIA-VIDEO.md.
  heroVideo: {
    src: "",            // ej: "assets/hero-mano.mp4"      (computador)
    srcMobile: "",      // ej: "assets/hero-mano-cel.mp4"  (celular, vertical; opcional)
    poster: "",         // ej: "assets/hero-mano.jpg"      (primer cuadro, carga instantánea)
  },

  brand: {
    name: "Valéor",
    tagline: "Haute Joaillerie",
    letter: "V",
    logo: "assets/logo-valeor.svg",
  },

  theme: {
    bg: "#071f10",     // verde botella aterciopelado (estilo cajita Rolex)
    gold: "#c9a961",
    gold2: "#f1d477",
    blue: "#7fbfa0",   // acento verde salvia (reemplaza el azul original)
    ice: "#f2efe4",    // blanco marfil (reemplaza el celeste original)
  },

  support: {
    name: "Soporte Valéor",
    whatsapp: "",       // ⚠️ PENDIENTE: tu número de WhatsApp con indicativo, ej: "573001234567"
  },

  // Solo para el modo demostración (backend:"demo"):
  demo: {
    password: "demo1234",
  },
};
