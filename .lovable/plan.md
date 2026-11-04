# Escáner para productos argentinos

## 1. Mis productos
- Nueva lista personal de productos, uno por código y usuario, con nombre, marca, valores por 100 g (kcal + 8 nutrientes), porción opcional, categoría y origen (etiqueta / manual / editado).
- Al escanear: **primero Mis productos**, después Open Food Facts.
- Se guarda solo cuando cargás un producto escaneado por foto de etiqueta o a mano.
- Si cambiás valores de un producto de Open Food Facts, aparece la casilla "Guardar mis cambios para próximas veces".

## 2. Foto de etiqueta
- Si el producto no existe o tiene datos incompletos, el botón principal pasa a ser **Fotografiar etiqueta nutricional**, junto a "Cargar manualmente" y "Describir con IA".
- La foto se comprime, se analiza y se descarta (nunca se guarda). Cuenta dentro del cupo de 30 análisis.
- La IA lee kcal o kJ, los macros, saturadas, fibra, azúcares, sodio o sal, si es "por 100 g/ml" o "por porción" y el tamaño de la porción. Ignora los % VD, toma "0" y "no contiene" como 0 y deja vacío lo que no aparece.
- Se pasa a valores por 100 g usando la porción. Si la porción no está en gramos, se trabaja solo por porción. Pasa por los mismos controles de coherencia y va a la revisión editable. Si la foto no es una etiqueta, aparece un mensaje claro.

## 3. Datos parciales
- Se acepta un producto si trae kcal **o** los tres macros. Si faltan las kcal, se calculan con 4/4/9.
- Los campos que faltan se marcan en ámbar con "Faltan datos: completalos antes de guardar", destacando proteínas. No se puede guardar hasta completarlos.
- "No tiene datos" aparece solo si no hay ningún valor. En ese caso se ofrece la foto de etiqueta con el nombre ya cargado.

## 4. Lectura más sensible
- Cámara trasera a 1920×1080 si se puede, con enfoque continuo. Solo lee EAN-13, EAN-8 y UPC-A.
- El lector de respaldo (ZXing) lee unas 10 veces por segundo sobre el recuadro central.
- Recuadro guía en pantalla y un texto chico que dice "Lector: nativo" o "Lector: ZXing".

## 5. Detalles
- Cuando aparece un resultado o un error, la cámara se achica. Así los botones y el campo de código manual quedan visibles sobre la barra inferior.
- En la revisión, el nombre del producto puede ocupar dos líneas.

## Detalles técnicos
- Migración: `productos_propios` (columnas del pedido, `por100` en columnas numéricas nullable para kcal + 8 nutrientes, `origen` con CHECK, UNIQUE(user_id, codigo), trigger `updated_at`), GRANT authenticated/service_role, RLS con `auth.uid() = user_id`. `comidas.origen` sin cambios (sigue "codigo"); la foto de etiqueta guarda la comida con origen "codigo".
- `off.ts` (puro): `parseProducto` acepta kcal o P+C+G; devuelve `faltantes` incluyendo los principales; kcal derivada con 4/4/9. Nuevo `normalizarEtiqueta(lectura)` → por 100 g (o solo por porción), null≠0, kJ/sal. `resolverProducto(propio, off)` con prioridad a lo propio. Las validaciones de coherencia se reutilizan.
- `off.functions.ts`: `buscarProducto` consulta primero `productos_propios` (RLS como usuario) y devuelve `fuente: "propio" | "off"`. Nuevo `guardarProductoPropio` (upsert).
- `ai.functions.ts`: `leerEtiqueta` con `AI_MODEL`, schema JSON estricto con campos nullable y `es_etiqueta`, cupo de 30 análisis compartido.
- `agregar.codigo.tsx`: constraints `{width:{ideal:1920},height:{ideal:1080},focusMode:"continuous"}`, hints de formatos para ZXing, bucle de recorte central cada ~100 ms, overlay guía, etiqueta de motor, colapso de cámara en resultado/error.
- `agregar.revisar.tsx`: resaltado ámbar con token semántico (sin rojo), bloqueo de guardado con faltantes, casilla "Guardar mis cambios", `line-clamp-2` en el nombre.
- Tests (`off.test.ts`): porción → 100 g, null vs 0 en etiqueta, solo kcal, solo macros, prioridad de Mis productos sobre OFF.
- AGENTS.md: regla de prioridad de `productos_propios` y normalización de etiquetas en `off.ts`.
