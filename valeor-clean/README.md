# Valéor E-Commerce — Sistema de Catálogo de Joyas

**Versión:** Fase 1 - Catálogo Vacío  
**Última actualización:** Octubre 9, 2026  
**Estado:** Listo para producción

---

## 📋 ¿Qué es esto?

Sistema de catálogo digital para joyerías con:
- ✅ Catálogo público (filtros, búsqueda, favoritos)
- ✅ Panel admin (agregar joyas, editar, fotos, precios)
- ✅ Integración WhatsApp Business
- ✅ Visualización 3D de diamantes
- ✅ Sistema de financiamiento
- ✅ Modo demo (sin base de datos) y Supabase (con base de datos)

---

## 🚀 Empezar en 5 minutos

### 1. Descargar y Configurar

```bash
# Clonar el repositorio
git clone https://github.com/detroy070-lang/VALEOR-JEWERLY.git
cd VALEOR-JEWERLY

# No necesita npm install — es HTML/CSS/JavaScript puro
```

### 2. Modo Demo (sin base de datos)

Abre `index.html` en el navegador. El catálogo está vacío y listo para que agregues tus joyas.

**Login al admin:**
- URL: `/admin/` (abre `admin/index.html`)
- Contraseña: `demo1234` (ver `js/config.js`)

### 3. Agregar tus Joyas (Admin Panel)

1. Entra al admin: `admin/index.html`
2. Ingresa contraseña
3. Click en "Agregar joya"
4. Completa:
   - Nombre (ej: "Anillo de Oro 18K")
   - Categoría (Anillos, Collares, Aretes, etc.)
   - Precio (en COP)
   - Foto (sube tu imagen)
   - Disponibilidad
5. **Publicar** para que aparezca en el catálogo

---

## ⚙️ Configuración Importante

**Archivo: `js/config.js`** — aquí cambia TODO por cada joyería.

```javascript
window.AUREON_CONFIG = {
  backend: "demo",  // "demo" = sin base de datos, "supabase" = con BD
  
  storeWhatsapp: "573005466740",  // Tu número WhatsApp Business
  
  brand: {
    name: "Valéor",
    letter: "V",
    logo: "assets/logo-valeor.svg",
  },
  
  theme: {
    bg: "#071f10",    // Color fondo
    gold: "#c9a961",  // Color oro
  },
  
  support: {
    whatsapp: "573005466740",  // WhatsApp de soporte
  },
};
```

---

## 📱 Desplegar en Vercel (Gratis)

### Opción A: Vercel CLI

```bash
npm i -g vercel
vercel
```

### Opción B: GitHub + Vercel Automático

1. Push este código a GitHub
2. Ve a https://vercel.com/new
3. Importa este repo
4. Click "Deploy"
5. ¡Listo! Tu catálogo estará en `tuproyecto.vercel.app`

---

## 🔐 Seguridad Antes de Producción

- [ ] Cambiar contraseña admin en `js/config.js` (no dejes `demo1234`)
- [ ] Cambiar números WhatsApp en `config.js`
- [ ] Revisar colores y logo en `theme` y `assets/`
- [ ] Cambiar `storeSlug` (identificador único)

---

## 📁 Estructura de Carpetas

```
VALEOR-JEWERLY/
├── index.html          # Catálogo público
├── admin/
│   └── index.html      # Panel admin (login + CRUD)
├── js/
│   ├── config.js       # ⚠️ ÚNICO ARCHIVO QUE CAMBIAS POR CADA JOYERÍA
│   ├── core.js         # Utilidades (categorías, formatos, etc.)
│   ├── catalog.js      # Catálogo público
│   ├── admin.js        # Panel admin
│   ├── api.js          # Conexión a Supabase o demo
│   └── ...
├── css/
│   └── styles.css      # Estilos (tema oscuro/claro automático)
├── assets/
│   └── logo-valeor.svg # Tu logo
└── README.md           # Tú estás aquí
```

---

## 🎥 Agregar Video de Presentación (Opcional)

Ver `GUIA-VIDEO.md` para cómo agregar un video de demostración de la joya.

---

## 🔗 WhatsApp Integrado

Cuando un cliente presiona "Comprar por WhatsApp", se abre un chat con:

```
Hola, me interesa [JOYA]. ¿Está disponible?
```

**Número que recibe:** El que definas en `config.js` → `storeWhatsapp`

---

## 📊 Datos Locales (IndexedDB)

Las joyas se guardan en el navegador del cliente. **No se pierden** si cierras y vuelves a abrir.

**Para sincronizar entre dispositivos:** Usa Supabase (cambia `backend: "supabase"` en `config.js`).

---

## 🐛 Troubleshooting

### "El admin no me deja entrar"
- Verifica que `config.js` tenga `backend: "demo"`
- Contraseña por defecto: `demo1234`

### "No me sale el logo"
- Asegúrate que `assets/logo-valeor.svg` exista
- O pon una URL externa en `brand.logo`

### "Las joyas no se guardan"
- Revisa que IndexedDB esté habilitado en el navegador
- Abre la consola: F12 → Application → IndexedDB

---

## 📞 Soporte

- **WhatsApp:** El número en `config.js` → `support.whatsapp`
- **Docs:** Ver `GUIA-VIDEO.md` y comentarios en `config.js`

---

**¡Listo! Ahora sube tus joyas al catálogo.** 🌟
