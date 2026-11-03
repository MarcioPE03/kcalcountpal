# Progreso: pestañas "Peso" y "Estadísticas"

## Cambio de base de datos
- Nueva tabla `pesos`: id, user_id (uuid), fecha (date), peso_kg (numeric > 0), created_at, updated_at. Único por (user_id, fecha): cargar dos veces el mismo día actualiza. RLS: cada usuario ve, crea, edita y borra solo lo suyo. Sin borrado automático.
- `profiles`: nueva columna `peso_meta_kg` (numeric, opcional).
- Migración de datos: si el perfil ya tiene `peso_kg`, se copia como primer registro de `pesos` (fecha de creación del perfil). `profiles.peso_kg` queda marcado como deprecado; el peso actual sale siempre del último registro.
- Ingredientes (jsonb en comidas): nuevo campo `categoria` opcional. No requiere migración; sin categoría cuenta como "Otros".

## Pestaña Peso
- Tarjetas "Peso actual" (último registro, con fecha) y "Peso meta" (editable).
- Botón "Actualizar mi peso": diálogo con fecha (hoy por defecto, hora Buenos Aires) y peso con coma decimal.
- Lista de registros con editar y borrar.
- Gráfico de línea con área degradada (Recharts), rango 1 mes / 3 meses / todo, línea punteada del peso meta, diferencia contra el primer registro del rango (ej. "-3,5 kg" / "+2,0 kg"), sirve para bajar o subir. Estado vacío amable con botón para cargar.
- Onboarding y metas sugeridas: al guardar el peso crean/actualizan el registro de hoy y leen el último peso.

## Pestaña Estadísticas
- Selector Semana / Mes con flechas anterior/siguiente (sin pasar del período actual).
- Resumen: promedio diario de kcal (sobre días registrados) y días registrados.
- Ingesta de calorías: barras por día + línea del límite diario.
- Calorías por comida: dona por Desayuno, Almuerzo, Merienda, Cena, Snack con %.
- Calorías por categoría: dona por las 12 categorías, sumando kcal por ingrediente; comidas sin ingredientes o sin categoría van a "Otros".
- Ingesta nutricional: barras apiladas por día, kcal de carbohidratos (4), proteínas (4), grasas (9) con colores fijos de macros.
- Colores de la app, leyendas con %, números en formato argentino.

## Categorías en la IA y carga
- Lista cerrada de 12 categorías en un solo lugar; la IA las devuelve por ingrediente (esquema JSON estricto + prompt actualizados).
- Selector de categoría en revisión (agregar/editar ingrediente) y en carga manual (categoría de la comida, guardada como un ingrediente único).

## Detalles técnicos
- Agregaciones puras (rango de período, promedio, totales por momento/categoría, kcal por macro, diferencia de peso, filtro de rango) en `src/lib/nutri.ts` con tests: semana lunes–domingo en hora BA, "Otros" por defecto, macros 4/4/9, diferencia negativa y positiva.
- Funciones de datos nuevas en `src/lib/data.ts` (pesos CRUD, comidas por rango, peso meta).
- Tabs de shadcn en `progreso.tsx`, componentes `PesoTab` y `EstadisticasTab`; Recharts ya disponible o se agrega.
