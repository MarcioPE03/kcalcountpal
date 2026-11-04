# Escáner de código de barras + no guardar fotos

## 1. Escanear código

**Agregar comida** suma una cuarta opción: "Escanear código" (ícono de código de barras).

```text
Escanear (cámara trasera) -> código válido -> Open Food Facts -> Revisión editable -> Guardar
```

- **Cámara:** pide permiso al abrir. Detecta con `BarcodeDetector` del navegador (Chrome Android) y, si no existe, con ZXing de respaldo. Formatos EAN-13, EAN-8 y UPC-A. Enfoque continuo y botón de linterna cuando el navegador lo soporta. Campo para tipear el código a mano.
- **Una sola lectura:** se valida el dígito verificador antes de consultar; tras la primera detección válida el escaneo se detiene (una consulta, una vibración). Código tipeado con dígito incorrecto: "Código inválido, revisá que esté bien escrito", sin consultar.
- **Permiso denegado / sin cámara:** mensaje claro con cómo habilitarlo, "Reintentar" y la opción de tipear el código.
- **Open Food Facts:** consulta por código pidiendo solo los campos necesarios. Nombre: `product_name_es`, si no `product_name`, mostrado como "Marca · Producto". Valores por 100 g.
- **Ausente vs. cero:** un 0 es válido (gaseosa cero, agua, edulcorante). Solo se rechaza si faltan (no vienen) kcal o alguno de los macros principales. Nutrientes secundarios faltantes cuentan como 0, con aviso.
- **Unidades:** sin kcal pero con kJ -> kcal = kJ ÷ 4,184. Sodio: sodio_mg = sodio_g × 1000; si solo hay sal, sodio_mg = sal_g × 400.
- **Coherencia:** inválido si P + C + G supera ~105 g por 100 g o si las kcal superan ~900 por 100 g. Aviso "Datos de etiqueta inconsistentes, revisá los valores" (editable, sin rechazar) solo si la diferencia con 4×P + 4×C + 9×G es mayor a 25 % **y** mayor a ~20 kcal por 100 g (evita falsas alarmas en gaseosas cero y bebidas con alcohol).
- **Producto no encontrado o sin datos:** mensaje claro con **Cargar manualmente** y **Describir con IA** (con el nombre precargado si lo hay).
- **Revisión:** la misma pantalla editable. Selector de cantidad en **gramos** o **porciones** (si OFF trae una porción razonable; porciones mayores a ~1.000 g se ignoran y queda solo gramos; por defecto 100 g). Porciones con fracciones (0,5) mostrando los gramos equivalentes. Porción en ml se toma como gramos, aclarado en pantalla. Recalcula kcal y los 8 nutrientes al instante. Sin rango ni badge de confianza.
- **Categoría:** la IA clasifica el nombre en una de las 12 categorías, en segundo plano. Nunca pisa una categoría que el usuario ya eligió a mano. Si falla o se alcanzó el tope, queda "Otros" y se guarda igual. Tope propio de 100 clasificaciones por usuario por día (configurable), **que no consume** el cupo de 30 análisis de foto/texto.
- **Guardado:** origen "código" con su ícono; cuenta igual en estadísticas, recientes y "copiar de ayer".

## 2. No guardar fotos

- La foto se comprime en el celular, se manda solo para el análisis y se descarta. La miniatura de la revisión vive solo en memoria.
- Se elimina la subida, las URLs firmadas y la foto en el detalle; borrar o copiar una comida ya no toca fotos.
- **No se borra ninguna comida, peso ni estadística.** Cada comida conserva su origen e ícono.

## 3. Orden de los cambios en la base de datos

```text
Paso A (esquema)   -> CHECK de origen con todos los valores existentes + "codigo"; foto marcada como retirada; tope de clasificaciones
Paso B (limpieza)  -> vaciar y eliminar el bucket con la API de Storage; solo si salió bien, foto_path = NULL
```

- Antes del paso A se consultan los valores reales de origen en la tabla (incluido "copia") y el CHECK los incluye todos.
- El paso B es independiente: si falla, el escáner sigue funcionando y se informa.
- **Función de limpieza:** exige sesión iniciada y solo la puede ejecutar tu usuario (verificado en el servidor por id). Idempotente: si el bucket ya no existe, termina sin error. El `UPDATE foto_path = NULL` corre solo si el borrado de archivos terminó bien. Se elimina del código al terminar.

## Detalles técnicos

- Migración A: `DROP CONSTRAINT` + nuevo CHECK de `comidas.origen` (valores reales + `'codigo'`); `COMMENT ON COLUMN comidas.foto_path IS 'DEPRECATED'`; `profiles.limite_categorias_diario int default 100` (protegido por el trigger `protect_limite`). Las clasificaciones se registran en `analisis_ia` con `estado='categoria'`, y el conteo del cupo de 30 pasa a excluir explícitamente esas filas.
- Paso B: función de servidor puntual con `requireSupabaseAuth` + chequeo de `userId` del dueño; luego carga `supabaseAdmin`, lista y borra en lotes los objetos de `fotos-comidas`, elimina el bucket (si no existe, ok), y recién entonces `UPDATE comidas SET foto_path = NULL`. La ejecuto una vez desde tu sesión y la borro. Las policies del bucket se retiran en una migración posterior.
- Nuevo `src/lib/off.ts` (puro): validación EAN-13/EAN-8/UPC-A, parseo OFF (ausente vs. 0, kJ->kcal, sodio/sal), coherencia (105 g, 900 kcal, 25 % y 20 kcal), porción en g/ml con tope 1.000 g, cálculo por gramos/porciones.
- `src/lib/limits.ts` / `nutri.ts`: regla pura de conteo del cupo que excluye `estado='categoria'`.
- Consulta OFF en función de servidor (`/api/v2/product/{code}?fields=...`, User-Agent propio, timeout). Clasificación en `ai.functions.ts` con el modelo de `ai-model.ts`, JSON estricto, fallback "Otros", tope diario.
- Ruta `/agregar/codigo`; `@zxing/browser` importado dinámicamente solo si falta `BarcodeDetector`; cámara y linterna liberadas al salir.
- `stores.ts`: origen `"foto" | "texto" | "codigo"`, sin blob; datos de producto para el selector. `data.ts`: quitar `subirFoto`, `urlFoto` y lógica de foto. `meal.tsx`: ícono `codigo`.
- Tests: kJ->kcal, sodio_g y sal_g, gaseosa cero (válida, sin aviso), cerveza (sin aviso), producto realmente inconsistente (aviso), P+C+G > 105 (inválido), dígito verificador, porción absurda ignorada, fracción de porción, clasificaciones que no consumen el cupo de análisis.
- AGENTS.md: regla de fotos -> "las fotos nunca se guardan". Memoria: código de barras con Open Food Facts deja de estar fuera de alcance; tope 100 clasificaciones/día.
