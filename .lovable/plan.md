# Hoy más limpio + entrenamientos

No se borra ninguna comida, peso ni estadística.

## 1. Anillo más limpio
- Sin tarjeta ni degradado: el anillo va directo sobre el fondo de la pantalla, en claro y en oscuro. Las 3 columnas de macros quedan debajo, igual que ahora.
- Trazo de 11 px en el verde de la app y un track gris suave.
- Si te pasás del límite, no se usa rojo ni coral en ningún lado. El anillo queda completo en verde y el centro muestra el número con "kcal de más" en color neutro.
- Las barras de macros se llenan en su color al llegar o pasar el 100 %, también en el detalle del día. Ya no se marca el exceso en coral.

## 2. Consumidas / Quemadas / Restantes
- La fila queda así: "Consumidas" a la izquierda, el anillo con las kcal restantes en el centro y "Quemadas" a la derecha. El anillo mide unos 176 px para que todo entre en pantallas de 360 px.
- Restantes = límite − consumidas + quemadas. Las quemadas solo se suman si el interruptor está activado.
- El anillo se llena según consumidas ÷ (límite + quemadas), con un tope del 100 %.
- Al tocar "Quemadas" se abre un panel con los entrenamientos del día elegido y un botón "Agregar entrenamiento". En el celular aparece desde abajo.

## 3. Entrenamientos
- Cada entrenamiento guarda: fecha, nombre, kcal quemadas (de 1 a 5000) y duración opcional. Cada persona ve y maneja solo los suyos, y nada se borra solo.
- Para agregar o editar se abre un diálogo con:
  - nombre, con chips de sugerencia: Pesas, Caminata, Correr, Bicicleta, Fútbol, Otro
  - kcal quemadas
  - duración en minutos, opcional
- El diálogo usa la fecha elegida en Hoy, con la hora de Buenos Aires. Antes de borrar pide confirmación.
- En Agregar hay una nueva opción "Entrenamiento" que abre ese mismo diálogo.
- En Hoy, debajo de las comidas, aparece una fila compacta por entrenamiento (llama, nombre, kcal) solo si hay alguno. Al tocar la fila se edita.
- El detalle del día también muestra los entrenamientos.
- En Perfil hay un interruptor nuevo, "Sumar calorías quemadas a mi límite", activado por defecto.
- Las estadísticas no cambian.

## 4. Tests
- Restantes con y sin entrenamientos, y con el interruptor apagado.
- El progreso del anillo no pasa del 100 %.
- Aparece "kcal de más" al pasarse.
- Se rechazan kcal quemadas de 0, 5001 o un valor vacío, y se acepta un valor de 1 a 5000.

## Detalles técnicos
- Migración: tabla `entrenamientos` (id, user_id, fecha date, nombre text, calorias_quemadas numeric con CHECK 1–5000, duracion_min int null con CHECK > 0, created_at, updated_at), con GRANT a authenticated/service_role, RLS de las 4 operaciones por `auth.uid() = user_id` e índice (user_id, fecha). Además `profiles.sumar_quemadas boolean not null default true`.
- `nutri.ts` (puro): `balanceDia({ consumidas, limite, quemadas, sumarQuemadas })` devuelve `{ restante, excedido, progreso }` y `validarQuemadas(kcal)`. Los tests van en `nutri.test.ts`.
- `data.ts`: `entrenamientosDiaQuery(fecha)`, `guardarEntrenamiento`, `actualizarEntrenamiento`, `borrarEntrenamiento`.
- Componentes: `CalorieRing` se simplifica (sin hero ni over-color); se agregan `EntrenamientoDialog`, `EntrenamientosSheet` (Drawer/Popover según `useIsMobile`) y `WorkoutRow`. `MacroBar`/`MacroColumna` sin `bg-over`.
- Agregar → "Entrenamiento": la opción abre el diálogo dentro de `agregar.index` y al guardar vuelve a Hoy.
- Actualizo la memoria del diseño de Hoy: se quitan el degradado y el coral de exceso.
