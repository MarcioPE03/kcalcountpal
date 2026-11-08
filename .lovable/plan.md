# Editor por ingrediente, grasa visible y "Corregir con IA"

Esto aplica a la pantalla de revisión y al detalle de una comida guardada. No se borra ninguna comida.

## 1. Editor por ingrediente
- Al tocar un ingrediente se abre un panel desde abajo (en la computadora, un diálogo). Ahí podés editar:
  - el nombre completo, que puede ocupar varias líneas
  - los gramos
  - la categoría
  - los 8 valores de esa porción: kcal, proteínas, carbohidratos, grasas, saturadas, fibra, azúcares y sodio
- Si cambiás un valor, se recalcula cuánto aporta cada gramo. Si después cambiás los gramos, todos los valores se escalan en proporción.
- Hay botones Guardar, Cancelar y "Eliminar ingrediente". Eliminar pide confirmación.
- El total de la comida siempre es la suma de los ingredientes y se actualiza al instante.
- Lo que editás a mano nunca se corrige solo. Si las kcal no cierran con 4×P + 4×C + 9×G, aparece un aviso suave en ámbar y nada más.
- En una comida guardada se usa el mismo panel. "Guardar cambios" actualiza la comida y conserva su origen, su fecha y su momento.

## 2. Grasa visible o piel separada (lista cerrada)
- La IA separa una fila aparte solo en estos casos:
  - **Cortes vacunos o de cerdo con grasa visible:** bife ancho, asado, costillar, vacío, bondiola, panceta y chuleta. La fila se llama, por ejemplo, "Grasa visible del bife ancho (descartable)" y va en Carnes.
  - **Pollo con piel:** pata muslo, muslo, alitas y pollo entero al horno. La fila se llama "Piel del pollo" y va en Carnes.
- Nunca separa grasa en:
  - lácteos, verduras, frutas, pastas, arroz ni panificados
  - salsas, ensaladas, guisos ni milanesas
  - cortes magros: pechuga sin piel, lomo, peceto, nalga y cuadril
  - preparaciones mixtas donde la grasa no se distingue
- Solo separa la fila si la grasa o la piel se ve en la foto o la descripción la menciona. Si decís que la sacaste o no la comiste, no la incluye. Ante la duda, no separa.
- La carne magra no incluye la grasa ni la piel que quedó en la fila aparte, así no se cuenta dos veces.
- La fila separada aparece resaltada con "¿La comiste? Si la dejaste, eliminala".

## 3. Corregir con IA (texto o voz)
- Al final de la revisión y del detalle de la comida aparece la tarjeta "¿Querés corregir o aclarar algo?". Tiene un campo de texto de hasta 500 caracteres, el micrófono (el mismo dictado que ya usás) y el botón "Corregir".
- La IA recibe:
  - la lista actual de ingredientes, con tus ediciones manuales
  - tu aclaración
  - la foto, solo si todavía está en la pantalla de revisión. Las comidas guardadas no tienen foto, así que ahí usa solo la lista y el texto.
- La IA cambia solo lo que pide tu aclaración. Las demás filas quedan idénticas, incluidas las que editaste a mano. Si la aclaración es ambigua, no cambia nada y te hace una pregunta breve.
- Antes de aplicar ves una vista previa: "Antes X kcal → Después Y kcal" y la lista de cambios (por ejemplo, "Quité 40 g de grasa visible del bife: −360 kcal"). Abajo están los botones Aplicar y Descartar.
- Después de aplicar aparece "Deshacer". Podés encadenar varias correcciones, y cada "Deshacer" vuelve un paso atrás.
- En la revisión no se guarda nada hasta confirmar la comida. En una comida guardada hace falta tocar "Guardar cambios".
- Cupo propio: 50 correcciones por día, aparte de los 30 análisis. Una corrección fallida no consume cupo.
- El botón queda desactivado mientras la IA trabaja. Si algo falla, ves un mensaje claro con la opción de reintentar.

## Ajustes aprobados
- **Cada ingrediente tiene una identidad fija:** la app la asigna antes de mandar la lista, también al abrir comidas viejas. La IA dice, fila por fila, si la deja igual, la modifica, la agrega o la elimina.
  - Solo las filas "sin cambios" conservan sus valores exactos. En las modificadas se usan los valores nuevos, con la corrección de kcal solo en esas filas.
- **La vista previa compara las listas reales**, no el texto de la IA, que queda solo como explicación.
  - Muestra "Antes → Después" y las filas que se agregan, cambian o se eliminan. Una fila que la IA no devuelve aparece como "se elimina".
  - No se puede aplicar una corrección que deje la comida sin ingredientes.
  - Si el total cambia más del 50 %, aparece un aviso visible.
- **Filas editadas a mano:** la IA solo las toca si tu aclaración las nombra de forma explícita. En ese caso, la vista previa las marca como "editada a mano, se modificará".
- **Comidas viejas o de Registro rápido:** si les falta información, se completa al abrirlas. Si no tienen gramos, podés editar los valores directamente, sin escalar.
  - El escalado nunca divide por cero.
- **Editor sin cambios inesperados:**
  - Solo se recalcula lo que modificaste.
  - Guardar sin tocar nada no altera ningún valor.
  - Los números se guardan con precisión completa y se redondean solo al mostrarlos.
- **Rango y confianza:**
  - Al editar o corregir, el rango de kcal se ajusta en proporción al nuevo total.
  - Si editaste el total a mano, el rango se quita.
  - La confianza se conserva.
- **Límites:**
  - Además de las 50 correcciones, hay un tope técnico de 150 intentos por día que incluye los que fallan.
  - Corre una sola corrección por vez para cada persona.
  - El cupo se verifica antes de llamar a la IA.
  - Entran y salen hasta unos 25 ingredientes, siempre con valores no negativos.
- **Detalles:**
  - Lo que dictás queda escrito en el campo para que lo revises. No se envía solo.
  - Si salís de una comida guardada con cambios sin guardar, te pide confirmación.
  - Al guardar se actualizan Hoy, el detalle del día, Recientes y Estadísticas. No cambian la fecha, la hora de carga ni el origen.
- **Grasa o piel:**
  - Las reglas no distinguen acentos ni mayúsculas, y las exclusiones siempre ganan: "milanesa de pollo" no separa piel.
  - Se valida contra el nombre del plato y las otras filas, nunca contra la propia fila de grasa.
  - Las marcas de grasa y de edición manual se conservan en las filas que la corrección no toca.
- **Grasa dentro de la carne:** si en una comida guardada decís "saqué las tiras de grasa" y la grasa estaba incluida en la fila de carne, la IA modifica esa fila con menos gramos y menos grasa.

## 4. Tests
- Editar un valor recalcula el aporte por gramo, y cambiar después los gramos escala bien.
- Una edición manual no se corrige con la validación de kcal.
- El total es la suma de los ingredientes.
- Una corrección deja intactas las filas que no se mencionan.
- Una categoría inválida pasa a "Otros".
- Las correcciones no consumen el cupo de análisis, y una fallida no cuenta.
- Deshacer vuelve a la versión anterior.
- Grasa o piel con respuestas simuladas de la IA:
  - yogur, ensalada, pechuga a la plancha, milanesa y fideos no muestran fila de grasa
  - bife ancho con grasa visible y muslo de pollo al horno sí la muestran
  - si la IA devuelve una fila de grasa para un plato excluido, la app la une a la carne y no la muestra aparte
- Además lo pruebo a mano con fotos reales.
- Una fila modificada usa los valores nuevos.
- Una fila omitida aparece como eliminada.
- No se puede dejar la comida vacía.
- Una fila editada a mano no cambia salvo mención explícita.
- Una comida vieja sin la información completa se puede editar.
- Guardar el editor sin cambios no altera ningún valor.
- Con 0 gramos no se divide por cero.
- El rango de kcal se ajusta después de una corrección.
- "Milanesa de pollo" no genera fila de piel.
- La fila de grasa no se usa para validarse a sí misma.
- La marca de grasa se mantiene después de una corrección.

## Detalles técnicos
- Grasa o piel:
  - La IA marca la fila con `descartable: true`.
  - Una regla pura en `analisis.ts` (`filtrarDescartables`) solo acepta esa marca si el nombre del plato o de otra fila coincide con la lista cerrada y no con las exclusiones. Si no coincide, la fila vuelve a sumarse a su carne o se descarta la marca.
  - La revisión muestra el aviso en ámbar sobre las filas con `descartable`.
- `nutri.ts` (puro):
  - `editarValoresIngrediente(ing, valores)` recalcula `por_gramo` a partir de los valores y los gramos actuales.
  - `escalarIngrediente`, que ya existe, cubre el cambio de gramos.
  - Se agrega `editado_manual: true` en el ingrediente, que viaja dentro del JSON de `ingredientes`, así que no hace falta migración.
  - `avisoAtwater(ing)` solo informa, nunca modifica valores.
- Componente `IngredienteSheet`: Drawer en mobile y Dialog en escritorio. Se usa dentro de `IngredientesEditor` en `agregar.revisar.tsx` y `comida.$id.tsx`.
- `src/lib/correccion.ts` (puro, con tests):
  - `aplicarCorreccion(antes, respuestaIA)` valida con zod, convierte las categorías inválidas en "Otros" y aplica los topes de coherencia del análisis.
  - La IA devuelve cada fila con su `id` y una `accion`: `sin_cambios`, `modificada`, `nueva` o `eliminada`. Los cambios nunca se detectan comparando contenido.
  - Solo las filas `sin_cambios` conservan los valores exactos y sus marcas (`editado_manual`, `descartable`). Las `modificada` y `nueva` usan los valores de la IA, validados y con corrección Atwater solo en esas filas.
  - Un id desconocido se toma como `nueva`, y una fila omitida se toma como eliminada.
  - `diffCorreccion(antes, despues)` arma la vista previa con totales, filas agregadas, modificadas y eliminadas, y avisos (más de 50 % de cambio, filas editadas a mano que se modifican, comida vacía).
  - `escalarRango(min, max, totalAntes, totalDespues)` ajusta el rango de kcal.
  - Recalcula los totales como suma.
  - `historial` maneja una pila en memoria para "Deshacer".
- `ai.functions.ts`: `corregirComida` con `requireSupabaseAuth` y el modelo de `ai-model.ts`, por el mismo camino de llamada que el análisis actual. La entrada se valida con zod: ingredientes (con tope de cantidad), aclaración de 1 a 500 caracteres y foto opcional con el mismo tope de tamaño. La salida es un JSON estricto con `ingredientes`, `cambios[]` y `pregunta|null`. El prompt es de nutricionista argentino: la aclaración del usuario manda y las filas no mencionadas no se tocan.
- `limits.ts`: `LIMITE_CORRECCIONES_DEFECTO = 50` y `ESTADO_CORRECCION = "correccion"`. `contarCupos` devuelve `correcciones` y las excluye de `analisis`.
  - Las correcciones exitosas se registran con estado `correccion`. Los intentos fallidos se registran con estado `correccion_fallida`, que cuenta solo para el tope técnico de 150 (`LIMITE_INTENTOS_CORRECCION`).
  - "Una corrección por vez" se controla con una fila `correccion_en_curso` de menos de 2 minutos, que se borra o se reemplaza al terminar. Además, el botón queda bloqueado en la app.
- `normalizarIngredientes(json)` (puro): asigna ids estables, calcula `por_gramo` cuando falta y tolera gramos en 0. Lo usan `leerIngredientes` y el editor.
- El prompt de `analizarComida` suma la regla de grasa visible con ejemplos argentinos.
- `useDictado` y `transcribirAudio` se reutilizan para la voz.
