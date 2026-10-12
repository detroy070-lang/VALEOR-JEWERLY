-- =====================================================================
-- VALEOR · Primeras joyas del catálogo (para la base de datos real)
-- Córrelo UNA vez en Supabase → SQL Editor, DESPUÉS de schema.sql y de
-- haber creado la joyería (slug 'valeor'). Las fotos ya están en el sitio
-- (assets/joyas/), no hay que subirlas.
-- =====================================================================
update public.stores set settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{categories}', '[{"id":"Collares"},{"id":"Cadenas"},{"id":"Anillos"},{"id":"Topitos"},{"id":"Aretes"},{"id":"Manillas"},{"id":"Dijes"}]'::jsonb)
 where slug = 'valeor';

insert into public.products (store_id, ref, name, category, gender, material, weight_g, size, stone, description, price_mode, featured, images)
select s.id, v.ref, v.name, v.category, v.gender, v.material, v.weight_g, v.size, v.stone, v.description, 'gramo', v.featured, v.images::jsonb
from public.stores s, (values
  ('CO-001', 'Camándula balín', 'Collares', 'mujer', 'Oro 18K', 5.2::numeric, '50', null, 'Balines diamantados de 3 y 4 mm, medalla de la Virgen Milagrosa y cruz. Peso aproximado: 5,10 a 5,30 g.', true, '[{"path":"assets/joyas/camandula-50cm.webp","thumb":"assets/joyas/camandula-50cm-t.webp","w":928,"h":1152}]'),
  ('CA-001', 'Lazo italiano delgado', 'Cadenas', 'unisex', 'Oro 18K italiano', 2.67::numeric, '45', null, 'Tejido lazo hecho en Italia, brillo continuo en cada giro. Peso según la pieza: 2,63 a 2,74 g.', false, '[{"path":"assets/joyas/lazo-italiano-45cm.webp","thumb":"assets/joyas/lazo-italiano-45cm-t.webp","w":928,"h":1152}]'),
  ('CA-002', 'Lazo italiano grueso', 'Cadenas', 'unisex', 'Oro 18K italiano', 4.06::numeric, '45', null, 'El mismo tejido lazo italiano, con más presencia. Peso según la pieza: 4,01 a 4,08 g.', true, '[{"path":"assets/joyas/lazo-italiano-45cm.webp","thumb":"assets/joyas/lazo-italiano-45cm-t.webp","w":928,"h":1152}]'),
  ('CA-003', 'Fígaro italiana', 'Cadenas', 'unisex', 'Oro 18K italiano', 1.45::numeric, '45', null, 'Eslabón fígaro clásico hecho en Italia: tres pequeños y uno largo. 1,45 g.', false, '[{"path":"assets/joyas/figaro-italiana-45cm.webp","thumb":"assets/joyas/figaro-italiana-45cm-t.webp","w":928,"h":1152}]'),
  ('CA-004', 'China italiana', 'Cadenas', 'unisex', 'Oro 18K italiano', 1.86::numeric, '40', null, 'Tejido chino compacto con broche de langosta. Peso según la pieza: 1,83 a 1,88 g.', false, '[{"path":"assets/joyas/china-italiana-40cm.webp","thumb":"assets/joyas/china-italiana-40cm-t.webp","w":928,"h":1152}]'),
  ('TO-001', 'Topos balín 7 mm', 'Topitos', 'unisex', 'Oro 18K', 0.83::numeric, '7 mm', null, 'Balín diamantado en espiral que brilla con cada movimiento. Peso aproximado: 0,80 a 0,85 g.', false, '[{"path":"assets/joyas/topos-balin-7mm.webp","thumb":"assets/joyas/topos-balin-7mm-t.webp","w":928,"h":1152}]'),
  ('MA-001', 'Pulso trébol circones', 'Manillas', 'mujer', 'Oro 18K', 6.82::numeric, '15', 'Circones', 'Tréboles cubiertos de circones, uno tras otro, sobre toda la muñeca. 6,82 g.', true, '[{"path":"assets/joyas/pulsos-trebol.webp","thumb":"assets/joyas/pulsos-trebol-t.webp","w":928,"h":1152}]'),
  ('MA-002', 'Pulso trébol nácar', 'Manillas', 'mujer', 'Oro 18K', 4.05::numeric, '18', 'Nácar', 'Tréboles de nácar con borde de balines sobre una cadena fina. 4,05 g.', false, '[{"path":"assets/joyas/pulsos-trebol.webp","thumb":"assets/joyas/pulsos-trebol-t.webp","w":928,"h":1152}]'),
  ('MA-003', 'Pulso trébol diamantado', 'Manillas', 'mujer', 'Oro 18K', 5.6::numeric, '19', null, 'Tréboles de oro diamantado sobre cadena de balines. Peso según la pieza: 5,53 a 5,67 g.', false, '[{"path":"assets/joyas/pulsos-trebol.webp","thumb":"assets/joyas/pulsos-trebol-t.webp","w":928,"h":1152}]'),
  ('DI-001', 'Dije de corazón', 'Dijes', 'mujer', 'Oro 18K', 0.38::numeric, null, null, 'Corazón diamantado con borde de balines y argolla labrada. Peso aproximado: 0,37 a 0,40 g.', false, '[{"path":"assets/joyas/dijes-corazon.webp","thumb":"assets/joyas/dijes-corazon-t.webp","w":928,"h":1152}]')
) as v(ref, name, category, gender, material, weight_g, size, stone, description, featured, images)
where s.slug = 'valeor'
on conflict (store_id, ref) do nothing;
