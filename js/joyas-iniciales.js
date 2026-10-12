/* =====================================================================
   VALEOR · joyas-iniciales.js — primeras piezas del catálogo.
   Precio "por gramo": se calcula solo con el precio del gramo de oro 18K
   (config.js → precioGramo18k, o Precios en el panel). Mientras no haya
   precio del gramo, el catálogo dice "Precio a consultar".
   Los pesos con rango se guardan con el valor medio; el rango va en la
   descripción.
   ===================================================================== */
const img = (n) => [{ path: `assets/joyas/${n}.webp`, thumb: `assets/joyas/${n}-t.webp`, w: 928, h: 1152 }];

export const PANELES_INICIALES = ["Collares", "Cadenas", "Anillos", "Topitos", "Aretes", "Manillas", "Dijes"];

export const JOYAS_INICIALES = [
  { ref: "CO-001", name: "Camándula balín", category: "Collares", gender: "mujer", material: "Oro 18K", weight_g: 5.2, size: "50", stone: null, featured: true, images: img("camandula-50cm"),
    description: "Balines diamantados de 3 y 4 mm, medalla de la Virgen Milagrosa y cruz. Peso aproximado: 5,10 a 5,30 g." },
  { ref: "CA-001", name: "Lazo italiano delgado", category: "Cadenas", gender: "unisex", material: "Oro 18K italiano", weight_g: 2.67, size: "45", stone: null, featured: false, images: img("lazo-italiano-45cm"),
    description: "Tejido lazo hecho en Italia, brillo continuo en cada giro. Peso según la pieza: 2,63 a 2,74 g." },
  { ref: "CA-002", name: "Lazo italiano grueso", category: "Cadenas", gender: "unisex", material: "Oro 18K italiano", weight_g: 4.06, size: "45", stone: null, featured: true, images: img("lazo-italiano-45cm"),
    description: "El mismo tejido lazo italiano, con más presencia. Peso según la pieza: 4,01 a 4,08 g." },
  { ref: "CA-003", name: "Fígaro italiana", category: "Cadenas", gender: "unisex", material: "Oro 18K italiano", weight_g: 1.45, size: "45", stone: null, featured: false, images: img("figaro-italiana-45cm"),
    description: "Eslabón fígaro clásico hecho en Italia: tres pequeños y uno largo. 1,45 g." },
  { ref: "CA-004", name: "China italiana", category: "Cadenas", gender: "unisex", material: "Oro 18K italiano", weight_g: 1.86, size: "40", stone: null, featured: false, images: img("china-italiana-40cm"),
    description: "Tejido chino compacto con broche de langosta. Peso según la pieza: 1,83 a 1,88 g." },
  { ref: "TO-001", name: "Topos balín 7 mm", category: "Topitos", gender: "unisex", material: "Oro 18K", weight_g: 0.83, size: "7 mm", stone: null, featured: false, images: img("topos-balin-7mm"),
    description: "Balín diamantado en espiral que brilla con cada movimiento. Peso aproximado: 0,80 a 0,85 g." },
  { ref: "MA-001", name: "Pulso trébol circones", category: "Manillas", gender: "mujer", material: "Oro 18K", weight_g: 6.82, size: "15", stone: "Circones", featured: true, images: img("pulsos-trebol"),
    description: "Tréboles cubiertos de circones, uno tras otro, sobre toda la muñeca. 6,82 g." },
  { ref: "MA-002", name: "Pulso trébol nácar", category: "Manillas", gender: "mujer", material: "Oro 18K", weight_g: 4.05, size: "18", stone: "Nácar", featured: false, images: img("pulsos-trebol"),
    description: "Tréboles de nácar con borde de balines sobre una cadena fina. 4,05 g." },
  { ref: "MA-003", name: "Pulso trébol diamantado", category: "Manillas", gender: "mujer", material: "Oro 18K", weight_g: 5.6, size: "19", stone: null, featured: false, images: img("pulsos-trebol"),
    description: "Tréboles de oro diamantado sobre cadena de balines. Peso según la pieza: 5,53 a 5,67 g." },
  { ref: "DI-001", name: "Dije de corazón", category: "Dijes", gender: "mujer", material: "Oro 18K", weight_g: 0.38, size: null, stone: null, featured: false, images: img("dijes-corazon"),
    description: "Corazón diamantado con borde de balines y argolla labrada. Peso aproximado: 0,37 a 0,40 g." },
];
