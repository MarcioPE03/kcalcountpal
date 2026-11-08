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
  - Corre la corrección Atwater solo sobre filas nuevas o modificadas. Una fila se considera sin cambios si coincide su id o su contenido, y conserva los valores exactos que tenía.
  - Recalcula los totales como suma.
  - `historial` maneja una pila en memoria para "Deshacer".
- `ai.functions.ts`: `corregirComida` con `requireSupabaseAuth` y el modelo de `ai-model.ts`, por el mismo camino de llamada que el análisis actual. La entrada se valida con zod: ingredientes (con tope de cantidad), aclaración de 1 a 500 caracteres y foto opcional con el mismo tope de tamaño. La salida es un JSON estricto con `ingredientes`, `cambios[]` y `pregunta|null`. El prompt es de nutricionista argentino: la aclaración del usuario manda y las filas no mencionadas no se tocan.
- `limits.ts`: `LIMITE_CORRECCIONES_DEFECTO = 50` y `ESTADO_CORRECCION = "correccion"`. `contarCupos` devuelve `correcciones` y las excluye de `analisis`. Las correcciones se registran en `analisis_ia` solo cuando salen bien.
- El prompt de `analizarComida` suma la regla de grasa visible con ejemplos argentinos.
- `useDictado` y `transcribirAudio` se reutilizan para la voz.
