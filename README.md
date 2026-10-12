# Valeor · Catálogo de joyería

Catálogo público + panel del joyero. HTML, CSS y JavaScript puros: no se instala nada. Se publica tal cual en Vercel.

- Catálogo: `index.html`
- Panel del joyero: `/admin/` (también desde el pie de página: "Acceso joyería")
- Lo único que se cambia por joyería: `js/config.js`
- Base de datos: `supabase/schema.sql`

El catálogo arranca con **las primeras 10 piezas de Valeor** (fotos reales) en sus paneles: Collares, Cadenas, Topitos, Manillas y Dijes. Están en `js/joyas-iniciales.js` y las fotos en `assets/joyas/`. Si se borran todas, los clientes ven "La colección está por llegar" con un botón a WhatsApp.

**Precios:** las piezas iniciales se venden **por gramo**. Mientras no esté el precio del gramo, dicen "Precio a consultar". Para activarlos: en `js/config.js` pon `precioGramo18k: 480000` (el valor real), o con Supabase, en el panel → Precios.

## Lo que puede hacer el joyero desde el panel

| Qué | Dónde |
|---|---|
| Agregar joya (hasta 5 fotos, se arreglan solas) | Joyas → + Agregar joya |
| Precio fijo, por gramo (se actualiza con el oro) o "a consultar" | Paso 3 de la joya |
| Editar todo: fotos, portada, girar, nombre, panel, para quién, precio | Toca la joya → Editar |
| Publicar, ocultar o guardar sin publicar | Toca la joya |
| Marcar agotada / disponible otra vez | Toca la joya |
| Destacar (sale primero y en "Destacadas") | Toca la joya |
| Registrar una venta (queda agotada y suma en estadísticas) | Toca la joya → Marcar como vendida |
| Eliminar (si está en un paquete, se quita del paquete) | Toca la joya → Eliminar |
| Paquetes: varias joyas a un precio, con el ahorro tachado | Joyas → + Crear paquete |
| Promociones: % de descuento a un panel o a todo | Precios → Promociones |
| Subir o bajar todos los precios fijos de una vez | Precios |
| Precio del gramo de oro 18K | Precios |
| Paneles: crear, renombrar, ordenar, ocultar, eliminar | Paneles (o "Tus paneles" en Joyas) |
| Dirección, horario, Instagram, WhatsApp, pagos, sellos de confianza, textos de portada | Mi joyería |
| Visitas, joyas más vistas, clics a WhatsApp, ventas del mes | Estadísticas |

Paneles por defecto: Collares, Anillos, Topitos, Aretes, Manillas. Cada joya se marca Mujer, Hombre o Unisex, y el catálogo filtra "Para ella / Para él".

Probado de punta a punta: 70 de 70 pruebas automáticas OK (panel y catálogo, computador y celular).

## Cómo tomar las fotos

Fondo negro (terciopelo, cartulina o el exhibidor), guantes negros, luz de ventana o lámpara blanca, sin flash. Celular a 20–30 cm, sin zoom, la joya en el centro. 2 o 3 ángulos por pieza. Las fotos de fondo negro se funden con la gamuza del catálogo.

---

# Pasos para publicar

## Paso 1 · Subir esta versión a GitHub (5 min)

1. Descomprime el zip en tu computador.
2. Entra a github.com/detroy070-lang/VALEOR-JEWERLY.
3. **Add file → Upload files**.
4. Abre la carpeta descomprimida, selecciona **todo lo que hay adentro** (no la carpeta) y arrástralo.
5. Abajo, **Commit changes**.
6. Vercel publica solo en ~1 minuto. Abre valeorjewerly.vercel.app y verifica.

Los archivos viejos que ya no existen en esta versión (QUICK-START.md, GUIA-VIDEO.md, fotos demo-*.webp) se pueden borrar desde GitHub; no afectan si se quedan.

## Paso 2 · Base de datos real con Supabase (15 min)

Sin este paso el sitio está en **modo demostración**: lo que suba el joyero solo lo ve él en su propio navegador. Para que lo vean sus clientes:

1. Entra a **supabase.com** → Start your project → crea una cuenta.
2. **New project**: nombre `valeor`, una contraseña de base de datos (guárdala), región **South America (São Paulo)**. Espera ~2 minutos.
3. Menú izquierdo → **SQL Editor** → **New query** → abre `supabase/schema.sql`, copia todo, pégalo → **Run**. Debe decir "Success".
4. Menú izquierdo → **Authentication → Users → Add user → Create new user**: correo y contraseña del joyero, marca "Auto Confirm User". Copia el **User UID** que aparece.
5. Vuelve a **SQL Editor → New query**. Copia el bloque `insert into public.stores …` que está al final de `schema.sql` (quítale los `--` del inicio de cada línea), reemplaza `PEGA-AQUI-EL-USER-UID` por el UID copiado → **Run**.
6. **SQL Editor → New query** → pega `supabase/joyas-iniciales.sql` → **Run**. Carga las 10 piezas iniciales (las fotos ya están en el sitio).
7. **Project Settings → API** (o "Data API"): copia **Project URL** y la clave **anon public**.
8. En GitHub abre `js/config.js` → lápiz (Edit) y cambia:
   ```js
   backend: "supabase",
   supabaseUrl: "https://xxxxxxxx.supabase.co",
   supabaseAnonKey: "eyJ...",
   ```
   → **Commit changes**. Vercel publica solo.
9. Prueba: entra a `/admin/` con el correo y contraseña del joyero, sube una joya y ábrela desde otro celular.

## Paso 3 · Dominio propio (opcional)

1. Compra el dominio (ej. `valeor.co`) en GoDaddy, Namecheap o similar.
2. Vercel → proyecto → **Settings → Domains → Add** → escribe el dominio.
3. Vercel te muestra 1 o 2 registros DNS: cópialos en el panel del proveedor del dominio. En minutos u horas queda activo, con candado (https) gratis.

## Paso 4 · Antes de entregarle al joyero

- [ ] Supabase conectado (Paso 2) y probado desde dos celulares.
- [ ] En **Mi joyería**: nombre, WhatsApp, dirección, horario, Instagram, formas de pago reales.
- [ ] **Sellos de confianza**: dejar solo lo que de verdad ofrece (por defecto dicen "Oro 18K · Estuche incluido · Envío asegurado").
- [ ] Precio del gramo de oro (si va a vender por gramo).
- [ ] Revisar los paneles: los que no use, ocultarlos o eliminarlos.
- [ ] Subir las primeras joyas con fotos reales.
- [ ] Copiar el enlace del catálogo (Estadísticas → Copiar) y ponerlo en la biografía de Instagram y en el perfil de WhatsApp Business.

## Pendiente (siguiente fase)

- Respuesta automática con IA en WhatsApp Business.
- La portada usa la foto de la modelo de Valeor (camándula) y acercamientos a los pulsos trébol y los topos balín (`assets/lb-*.webp`). Para cambiarlas, reemplaza esos archivos con el mismo nombre.
