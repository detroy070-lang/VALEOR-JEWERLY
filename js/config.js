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
  // Base de datos real conectada (Supabase). Para volver al modo demostración: "demo".
  backend: "supabase",

  // Supabase → Project Settings → API Keys. Es la clave PUBLICABLE (segura en la web).
  // Nunca pongas aquí la clave secreta (sb_secret_...).
  // Conexión a Supabase a través de tu propio dominio (/sb), para que no dependa de la red del cliente.
  supabaseUrl: window.location.origin + "/sb",
  supabaseAnonKey: "sb_publishable_LkDbm8sG76dhuE9fFGtXqQ_B7FZKA6i",
  storeSlug: "valeor",       // identificador de la joyería en la base de datos
  storeWhatsapp: "573005466740", // WhatsApp Business: aquí llegan los pedidos del catálogo

  // Precio del gramo de oro 18K en COP (ej: 480000). Las joyas "por gramo"
  // calculan su precio con este valor. En null, el catálogo dice "Precio a consultar".
  precioGramo18k: null,

  brand: {
    name: "Valeor",
    tagline: "Joyería",
    letter: "V",
    logo: "assets/logo-valeor.svg",
  },

  // Materiales de la marca: terciopelo verde (la caja), gamuza negra (la
  // bandeja donde reposan las joyas), oro (los filos) y marfil (las tarjetas).
  theme: {
    bg: "#071f10",     // verde botella aterciopelado (estilo cajita Rolex)
    gold: "#c9a961",
    gold2: "#f1d477",
    blue: "#7fbfa0",   // acento verde salvia
    ice: "#f2efe4",    // blanco marfil
    suede: "#0e0d0c",  // gamuza negra de la vitrina (combina con las fotos de fondo negro)
  },

  support: {
    name: "Soporte Valeor",
    whatsapp: "573005466740",
  },

  // Solo para el modo demostración (backend:"demo"):
  demo: {
    password: "demo1234",
  },
};
