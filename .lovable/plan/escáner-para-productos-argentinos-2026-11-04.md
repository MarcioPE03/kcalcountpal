# Escáner para productos argentinos

## 1. Mis productos
- Nueva lista personal de productos, uno por código y usuario. Guarda nombre, marca, valores base (kcal y 8 nutrientes), porción opcional, categoría, origen (etiqueta, manual o editado) y **base**: "por 100 g" o "por porción".
- Los valores son **siempre por 100 g**, sin importar cuánto comiste. Solo usamos "por porción" cuando no se conoce el peso de la porción.
- **Códigos:** todo código se pasa a 13 dígitos completando con ceros a la izquierda antes de buscar o guardar. Así un UPC-A de 12 dígitos y su versión con un 0 adelante son el mismo producto.
- Al escanear se busca **primero en Mis productos** y después en Open Food Facts.
- Se guarda **solo al confirmar la comida**, nunca al leer la etiqueta. Pasa al cargar por foto de etiqueta o a mano desde el escáner, y al tildar "Guardar mis cambios para próximas veces" después de editar un producto de Open Food Facts. Si falla ese guardado, verás un aviso, pero la comida se guarda igual.
- En la revisión, un producto propio muestra "De tus productos" con dos acciones: **Corregir valores** y **Eliminar este producto**.
- En Perfil hay una lista simple de **Mis productos**: buscar, editar y borrar con confirmación.

## 2. Cargar manualmente desde el escáner
- Si venís del escáner, el formulario pregunta si los valores son **por 100 g** o **por porción**. Si son por porción, también pide cuántos gramos pesa. Antes de guardar, todo se pasa a 100 g. Ejemplo: 1 porción de 40 g con 200 kcal se guarda como 500 kcal por 100 g.
- **Porciones:** los ml se toman como gramos, y la pantalla lo aclara. Si la porción viene en unidades sin peso ("1 unidad"), se pide el peso en g. Si no lo sabés, el producto queda como "por porción" y la cantidad solo se elige en porciones.

## 3. Foto de etiqueta
- Si el producto no existe o tiene datos incompletos, el botón principal es **Fotografiar etiqueta nutricional**, junto a "Cargar manualmente" y "Describir con IA".
- La foto se comprime, se analiza y se descarta. En la revisión ves una miniatura que solo existe mientras usás la pantalla.
- **Lectura de etiquetas argentinas:**
  - Reconoce "Valor energético", "Hidratos de carbono" o "Carbohidratos", "Grasas totales", "Grasas saturadas", "Fibra alimentaria" y "Sodio" en mg.
  - Toma azúcares totales, no los añadidos. Prefiere kcal antes que kJ.
  - Lee "0", "no contiene" y "No aporta cantidades significativas de…" como 0. Si un dato no aparece, lo deja vacío (no como 0).
  - Ignora los octógonos de advertencia y los % VD.
  - Si hay una columna por 100 g y otra por porción, usa la de 100 g e indica cuál usó.
  - En productos en polvo toma los valores "tal como se vende". Si solo hay valores "preparado", te avisa.
- Pasa por los mismos controles de coherencia que Open Food Facts. Si la foto no es una etiqueta, ves un mensaje claro.
- Una lectura exitosa cuenta dentro del cupo de 30 análisis. Si la foto no es una etiqueta o la lectura falla, no se descuenta.

## 4. Datos faltantes
- Un producto se acepta si trae kcal o los tres macros. Si faltan las kcal, se calculan con 4/4/9.
- **Solo se bloquea el guardado si no hay forma de saber las kcal.**
- Si faltan proteínas, carbohidratos o grasas, se marcan en ámbar con un aviso destacado y aparece el botón **Guardar con datos incompletos**.
- Si faltan nutrientes secundarios, cuentan como 0. Ves un aviso, pero no bloquean.
- "No tiene datos" aparece solo si no hay ningún valor. En ese caso se ofrece la foto de etiqueta con el nombre ya cargado.

## 5. Lectura más sensible y diagnóstico
- Cámara trasera a 1920×1080 si se puede, con enfoque continuo. Solo lee EAN-13, EAN-8 y UPC-A.
- El lector de respaldo (ZXing) lee unas 10 veces por segundo sobre el recuadro central.
- En pantalla hay un recuadro guía y el texto "Lector: nativo" o "Lector: ZXing". Los resultados y errores muestran el código leído, por ejemplo "Código 7790…".
- Cuando aparece un resultado o un error, la cámara se **apaga** (no solo se oculta), y también al salir de la pantalla. Así los botones y el campo de código manual quedan visibles. "Escanear otro" la vuelve a prender.
- En la revisión, el nombre del producto puede ocupar dos líneas.

## Detalles técnicos
- Migración `productos_propios`: user_id, codigo (EAN-13), nombre, marca, 9 nutrientes numéricos nullable, porcion_g, categoria, origen CHECK ('etiqueta','manual','editado'), base CHECK ('100g','porcion'), created_at/updated_at (trigger). Además: CHECK de valores >= 0 y CHECK de kcal <= 900 cuando base='100g'. UNIQUE(user_id, codigo). GRANT a authenticated y service_role. RLS con `auth.uid() = user_id` para select/insert/update/delete.
- `off.ts` (puro):
  - `normalizarCodigo` pasa el código a EAN-13.
  - `parseProducto` acepta kcal o P+C+G.
  - `faltantes` separa los principales de los secundarios.
  - `puedeGuardar` exige kcal presentes o derivables.
  - `aPor100(valores, porcion_g)` pasa los valores a 100 g.
  - `normalizarEtiqueta(lectura)` respeta null≠0, usa la columna de 100 g si existe, convierte kJ y sal, toma ml como g y usa base 'porcion' sin gramos.
  - `resolverProducto(propio, off)` da prioridad a Mis productos.
  - Se reusan los controles de coherencia.
- `off.functions.ts`: `buscarProducto` normaliza el código, consulta `productos_propios` como el usuario y devuelve `fuente`. Se agregan `guardarProductoPropio` (upsert, se llama al confirmar la comida), `borrarProductoPropio` y `listarProductosPropios`.
- `ai.functions.ts` `leerEtiqueta`: zod para la entrada, data URL de imagen limitada a ~1,5 MB, `AI_MODEL` con JSON schema estricto (campos nullable, `es_etiqueta`, `columna_usada`, `solo_preparado`, unidad de porción). El prompt usa el contexto argentino de arriba. La salida pasa por `normalizarEtiqueta` y los topes de coherencia. Las filas de `analisis_ia` con estado distinto de 'ok' (no etiqueta o error) se excluyen del conteo en `contarCupos`.
- `agregar.codigo.tsx`: constraints de video, hints de formatos, bucle ZXing de ~100 ms sobre el recorte central, recuadro guía, motor y código en pantalla, `stop()` de todas las pistas al colapsar o desmontar, y reactivación con "Escanear otro".
- `agregar.manual.tsx` / Registro rápido con `?codigo=`: selector de base (100 g o porción con gramos) y normalización.
- `agregar.revisar.tsx`: resaltado ámbar con token semántico, "Guardar con datos incompletos", casilla "Guardar mis cambios", bloque "De tus productos" con sus acciones, miniatura de la etiqueta y `line-clamp-2`.
- `perfil.tsx`: sección "Mis productos" con buscador, edición y borrado con confirmación.
- Tests (`off.test.ts`, `limits` en `nutri.test.ts`):
  - Porción a 100 g, incluido el caso de 40 g y 200 kcal que da 500.
  - null vs 0 y "no aporta" = 0.
  - La columna de 100 g tiene prioridad.
  - Producto con solo kcal y con solo macros.
  - ml tomado como g y base 'porcion'.
  - UPC-A y la versión 0+12 dan el mismo producto.
  - Prioridad de Mis productos sobre Open Food Facts.
  - Guardado incompleto permitido solo con kcal.
  - Una lectura fallida no consume el cupo.
- AGENTS.md: los códigos se normalizan a EAN-13, `productos_propios` guarda valores base y tiene prioridad sobre OFF, y la normalización de etiquetas vive en `off.ts`.
