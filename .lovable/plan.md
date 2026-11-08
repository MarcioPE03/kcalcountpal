# Orden de comidas, menú Agregar y pantalla de entrenamientos

No se borra ninguna comida, entrenamiento, peso ni favorito.

## 1. Orden de las comidas
- En Hoy y en el detalle del día, la lista sigue siendo una sola, con el chip del momento.
- Orden: Desayuno, Almuerzo, Merienda, Cena, Snack. Dentro de cada momento, se ordena por hora de carga, de la más vieja a la más nueva. Los momentos desconocidos o vacíos van al final.
- Si cambiás el momento de una comida, la lista se reordena al instante.
- El nombre de cada comida puede ocupar hasta dos líneas en vez de cortarse.

## 2. Menú Agregar
- El título pasa a ser "Agregar", con el subtítulo "¿Qué querés registrar?".
- "Entrenamiento" ya no abre un diálogo: lleva a su propia pantalla.

## 3. Pantalla de entrenamientos (/agregar/entrenamiento)
- Usa la fecha que viene del enlace. Si no viene ninguna, usa hoy en hora de Buenos Aires.
- Tiene 3 pestañas: Recientes, Favoritos y Nuevo.
- **Recientes:** entrenamientos sin repetir (mismo nombre y mismas kcal cuentan como uno), del más nuevo al más viejo. Van agrupados por fecha (Hoy, Ayer, …), con buscador y "Ver más". Cada fila muestra llama, nombre, kcal, duración, corazón y botón "+".
- **Favoritos:** cada favorito es una copia independiente, así que sigue estando aunque borres el entrenamiento original. Tiene un menú para renombrar (el nombre es obligatorio) o quitar (pide confirmación).
- **Nuevo:** el formulario actual en pantalla completa: nombre con chips de sugerencia, kcal de 1 a 5000 y duración opcional. Suma una casilla "Guardar como favorito" y el botón Guardar.
- **Selección múltiple** en Recientes y Favoritos, igual que en Mis comidas:
  - El "+" marca la fila. El mismo entrenamiento no se cuenta dos veces aunque aparezca en las dos pestañas.
  - Los chips ×0,5, ×1, ×1,5 y ×2 multiplican las kcal y la duración, y se ven las kcal ya multiplicadas.
  - El botón fijo "Registrar (N)" acepta hasta 10 entrenamientos y se bloquea mientras guarda, para no guardar dos veces.
  - Al registrar, se guardan los entrenamientos en la fecha elegida, sin IA, y volvés a Hoy con un aviso.
- En Hoy, el botón "Agregar entrenamiento" del panel de "Quemadas" lleva a esta pantalla con la fecha elegida.
- Al tocar un entrenamiento ya cargado, se sigue editando en el diálogo actual, que ahora también tiene el corazón de favorito.

## Ajustes aprobados
- **Escalado seguro:** al multiplicar, las kcal y la duración se redondean al número entero. Si un resultado queda fuera de rango (kcal menor a 1 o mayor a 5000, o duración menor a 1), esa fila muestra un aviso. "Registrar" queda desactivado hasta que quites la fila o cambies el multiplicador. Ningún valor se recorta sin avisarte.
- **Botón fijo:** "Registrar (N)" no aparece en la pestaña Nuevo. Ahí solo está su botón Guardar.
- **Fecha:** si la fecha del enlace está mal escrita o es futura, se usa hoy en hora de Buenos Aires. La opción "Entrenamiento" del menú Agregar también pasa la fecha elegida en Hoy.
- **Recientes:** se traen unos 200 entrenamientos, se quitan los repetidos y "Ver más" pagina sobre esa lista, así no reaparecen repetidos entre páginas.
- **Cuándo es el mismo entrenamiento:** coinciden el nombre, las kcal y la duración. Con la misma duración vacía también cuenta como igual. Con distinta duración son dos entradas.
- **Corazón al editar:** crea o actualiza un favorito con los valores actuales, sin duplicarlo. Aparece lleno si ya existe un favorito igual.
- **Si falla el favorito:** en Nuevo y al editar, el entrenamiento se guarda primero. Si después falla el favorito, ves un aviso y no se bloquea nada.
- **Limpieza:** saco de Agregar el diálogo y el código viejo de "Entrenamiento".

## 4. Tests
- 3000 kcal con ×2: rechazado. 45 min con ×1,5: 68 min. 1 kcal con ×0,5: rechazado.
- Fecha mal escrita o futura: se usa hoy.
- Mismo nombre y mismas kcal con distinta duración: son dos entradas distintas.
- Orden por momento: una merienda cargada a las 20:00 y un desayuno cargado después muestran primero el desayuno.
- Momentos desconocidos al final.
- Recientes sin repetidos.
- Multiplicador aplicado a kcal y duración.
- El favorito sigue estando después de borrar el original.
- Al registrar varios, todos quedan en la fecha elegida.
- Solo se aceptan kcal de 1 a 5000, y el máximo es de 10 seleccionados.

## Detalles técnicos
- `nutri.ts`: `ordenarComidas(comidas)` es una función pura que ordena por índice en `MOMENTOS` (los desconocidos al final) y después por `created_at`. Se usa en Hoy y en `dia.$fecha`. `MealRow` usa `line-clamp-2`.
- Migración `favoritos_entrenamientos` (id, user_id, nombre, calorias_quemadas numeric con CHECK 1–5000, duracion_min int null con CHECK > 0, clave, created_at, updated_at). Lleva índice único (user_id, clave), GRANT a authenticated/service_role, RLS de las 4 operaciones por `auth.uid() = user_id` y trigger de updated_at. No tiene FK a `entrenamientos`.
- `mis-comidas.ts` se generaliza: `claveComida`, `coincideBusqueda`, `agruparPorFecha`, `etiquetaFecha`, `FACTORES_RAPIDOS` y `validarFactor` se reutilizan tal cual. Se agregan funciones puras para entrenamientos (`dedupRecientesEntrenamientos`, `escalarEntrenamiento`, `filasEntrenamientoParaRegistrar` con `MAX_SELECCION_ENT = 10`, `favoritoEntrenamientoDesde`), con tests en `mis-comidas.test.ts`. La selección por clave y el botón fijo se extraen a componentes compartidos con Mis comidas.
- `data.ts`: `entrenamientosRecientesQuery` (paginado), `favoritosEntrenamientosQuery`, upsert/renombrar/quitar favorito y guardado múltiple de entrenamientos.
- Nueva ruta `agregar.entrenamiento.tsx` con `validateSearch` de `fecha` opcional y fallback a `fechaLocal()`. `EntrenamientosSheet` navega a esa ruta. `EntrenamientoDialog` queda solo para editar y suma el corazón.
- `AGENTS.md`: los favoritos de entrenamientos son copias independientes en `favoritos_entrenamientos` con clave por usuario.
