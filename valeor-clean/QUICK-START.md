# ⚡ Quick Start — Valéor en 5 minutos

## Paso 1: Prueba Local

```bash
# Abre con un servidor local (o simplemente abre index.html en el navegador)
npx http-server
# Luego ve a http://localhost:8080
```

## Paso 2: Entra al Admin

1. Ve a `http://localhost:8080/admin/`
2. Contraseña: `demo1234`
3. Click "Agregar joya"

## Paso 3: Agrega tu Primera Joya

**Ejemplo:**
- Nombre: "Anillo Solitario Oro 18K"
- Categoría: Anillos
- Precio: 2500000
- Foto: sube una imagen
- Click "Publicar"

## Paso 4: Ve el Catálogo

Ve a `http://localhost:8080` — tu joya aparece automáticamente.

---

## Desplegar a Vercel (Opción Más Recomendada)

### A. Si tienes GitHub:

1. Push este código a tu repo: `git push`
2. Ve a https://vercel.com/new
3. Importa tu repo desde GitHub
4. Click "Deploy"
5. Listo en 30 segundos, tu URL será algo como: `valeor-ecommerce.vercel.app`

### B. Si no tienes GitHub (pero recomiendo que lo hagas):

```bash
npm i -g vercel
vercel
```

---

## ⚙️ Configuración Importante

**Archivo: `js/config.js`**

Cambia SOLO estos valores:

```javascript
storeWhatsapp: "TU_NUMERO",  // Tu WhatsApp Business
support.whatsapp: "TU_NUMERO",  // Para soporte

brand.name: "TU_MARCA",
brand.logo: "ruta/a/tu/logo.svg",
```

Todo lo demás está listo. 🚀

---

## ❓ ¿Problemas?

- **Admin no funciona:** Verifica `config.js` → `backend: "demo"`
- **Fotos no cargan:** Asegúrate de subir JPEG/PNG (máx 5MB)
- **Precios se ven raros:** El formato es COP (ej: 1.250.000 pesos)

Ver `README.md` para más detalles.
