# Mis comidas: re-registrar sin IA

## Qué cambia para el usuario

**Agregar** queda con 5 opciones en este orden: Foto con IA, Describir (texto/voz), Escanear código, Mis comidas, Entrenamiento. Sale "Carga manual" suelta. La tarjeta "Recientes" y "Copiar del día anterior" que hoy están al pie de Agregar se mudan a Mis comidas (no se duplican).

**Mis comidas** (pantalla nueva, 3 pestañas):

1. **Recientes** — reemplaza la lista actual de recientes y la amplía:
   - Comidas distintas (mismo nombre normalizado + mismas kcal = duplicado), de más nueva a más vieja, agrupadas por fecha ("Hoy", "Ayer", "Lunes 2 de noviembre").
   - Buscador por nombre (sin distinguir acentos ni mayúsculas).
   - Cada fila: ícono de origen, nombre, kcal, P/C/G, corazón (favorito) y botón "+".
   - Arriba, los dos botones de "Copiar del día anterior" (solo este momento / todo el día), igual que hoy.
2. **Favoritos** — lista de favoritos con buscador, "+" para seleccionar, menú para renombrar o quitar (con confirmación).
3. **Registro rápido** — la carga manual actual (nombre, kcal, momento, macros, demás nutrientes opcionales, categoría) más la casilla "Guardar como favorito".

**Selección múltiple** (Recientes y Favoritos):
- Al tocar "+" la fila queda marcada y muestra chips de cantidad 0,5 / 1 / 1,5 / 2 y un campo libre (0,1 a 10, coma decimal).
- Aparece un botón fijo abajo "Registrar (N)". Abre una hoja con el momento (preseleccionado por hora, chips editables) y confirma.
- Se guardan N comidas en la fecha elegida en Hoy, con kcal, 8 nutrientes y gramos de ingredientes escalados. No consume IA. Vuelve a Hoy con aviso "N comidas registradas".
- La selección se mantiene al cambiar entre Recientes y Favoritos.

**Corazón de favorito** también en:
- Detalle de una comida (marcar / quitar).
- Pantalla de revisión (IA y código): casilla "Guardar también como favorito".

Un favorito es una copia: si se borra la comida original, el favorito sigue. Un corazón se ve "lleno" en Recientes si existe un favorito con el mismo nombre normalizado y mismas kcal; tocarlo de nuevo lo quita.

**"Cargar manualmente"** desde el escáner y desde errores de IA lleva a Mis comidas › Registro rápido con el nombre precargado si lo hay. La dirección vieja de carga manual redirige ahí.

## Detalles técnicos

- **Migración:** tabla `public.favoritos` (id, user_id uuid, nombre, categoria text default 'Otros', ingredientes jsonb default '[]', calorias + 7 nutrientes numeric default 0, created_at) sin FK a comidas; GRANT a authenticated/service_role; RLS select/insert/update/delete por `auth.uid() = user_id`. Índice por user_id. Origen al registrar desde favorito: `copia` (ya permitido por el CHECK actual).
- **Lógica pura en `nutri.ts`** (tests en `nutri.test.ts`): `claveComida(nombre, kcal)` (normaliza acentos/espacios/mayúsculas, kcal redondeadas), `dedupRecientes`, `agruparPorFecha`, `escalarComida(c, factor)` (kcal, 8 nutrientes, gramos y valores de ingredientes), `validarFactor` (0,1–10), `filasParaRegistrar(items, fecha, momento)`.
- **`data.ts`:** `recientesQuery` pasa a traer ~200 filas y deduplicar con `claveComida`; `favoritosQuery`, `crearFavorito` (desde comida o desde borrador), `renombrarFavorito`, `borrarFavorito`, `registrarVarias` (un solo insert de N filas).
- **Rutas:** nueva `/agregar/mis-comidas` con `?tab=recientes|favoritos|rapido&nombre=&momento=`; `/agregar/manual` redirige a `?tab=rapido`. Formulario manual extraído a un componente reutilizable.
- **Tests:** dedup de recientes; escalado por 0,5/1,5/2 incluyendo gramos; favorito sobrevive al borrado (la función que crea el favorito copia los valores y no guarda id de la comida; test de que `filasParaRegistrar` desde un favorito no depende de la comida original); guardado múltiple usa la fecha elegida (p. ej. 03/11 → todas las filas con "2026-11-03") y el momento elegido.
- **AGENTS.md:** regla "Favorites are independent copies in `favoritos`; never reference `comidas` rows".

## Ajustes incorporados

1. **Categoría:** un favorito creado desde Registro rápido guarda un ingrediente único con su categoría. Si un favorito tiene ingredientes vacíos, `filasParaRegistrar` arma ese ingrediente único con `favoritos.categoria`. Test: favorito manual "Lácteos y huevos" cuenta como lácteos en estadísticas.
2. **Clave del favorito:** columnas `clave` (de `claveComida` al crear, no cambia al renombrar) y `updated_at`; CHECK nutrientes >= 0; índice único (user_id, clave). Corazón lleno si existe esa clave; marcar dos veces no duplica (upsert); quitar borra exactamente ese. Renombrar solo cambia el nombre (obligatorio, no vacío).
3. **Duplicados:** "Registrar" y "Copiar del día anterior" deshabilitados mientras guardan. Selección identificada por `claveComida` (misma comida en Recientes y Favoritos cuenta una vez). La hoja de confirmación lista los ítems con el total de kcal. Máximo 20 ítems. Cada fila seleccionada muestra kcal ya multiplicadas.
4. **Fechas:** Recientes ordenadas y agrupadas por `fecha` y luego `created_at`; "Hoy/Ayer" en hora de Buenos Aires, sin toISOString(). La fecha elegida en Hoy viaja como `?fecha=`; si falta, hoy en Buenos Aires. "Copiar del día anterior" usa el día anterior a la fecha seleccionada, con estado vacío si no hay comidas. Test con una cena a las 22:00.
5. **Botón fijo:** "Registrar (N)" por encima de la barra inferior con safe-area y margen inferior en la lista; oculto en Registro rápido.
6. **Ruta:** `/agregar/mis-comidas` acepta `?codigo=` opcional (sin uso todavía).
7. **Detalles:** el escalado multiplica también el rango de kcal (confianza se conserva) y redondea solo al final; el total sigue siendo la suma de ingredientes. En revisión, la comida se guarda primero; si falla el favorito, aviso no bloqueante. Buscador de Recientes con "Ver más" y la aclaración "Busca entre tus comidas recientes".
