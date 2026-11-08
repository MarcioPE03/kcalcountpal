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

## 2. Grasa visible separada
- Le explico a la IA qué hacer con los cortes con grasa que se suele dejar en el plato: bife ancho, asado, costillar, bondiola, panceta y chuleta.
- En esos casos, la grasa visible viene como un ingrediente aparte, por ejemplo "Grasa visible del bife ancho (descartable)", con categoría Carnes. La carne magra viene en otra fila, con su grasa intramuscular.
- Solo se separa si la grasa se ve en la foto o la descripción la menciona. Si decís que la sacaste o no la comiste, no se incluye.
- Así podés borrar esa fila con un toque.

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

## Detalles técnicos
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
