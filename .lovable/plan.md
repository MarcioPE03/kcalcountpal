# Hoy más limpio + entrenamientos

No se borra ninguna comida, peso ni estadística.

## 1. Anillo y fondo
- Arriba de Hoy no hay tarjeta. Hay un degradado vertical de borde a borde, que va de verde menta a verde profundo con un toque de ámbar. Llega hasta la barra de estado del celular y se funde con el fondo en unos 50 px, sin corte. En modo oscuro el degradado es más profundo.
- Sobre el degradado van, en blanco, la fecha con sus flechas, el anillo y los números Consumidas y Quemadas.
- Las 3 columnas de macros van en una tarjeta sólida que se monta sobre el borde de abajo del degradado. Es blanca en claro y oscura en oscuro.
- El anillo es fino (11 px), blanco, con un fondo blanco semitransparente. Nunca cambia de color. Si te pasás, queda completo y el centro dice "kcal de más", sin cambiar de estilo.
- El color de la barra superior del celular se ajusta al modo. Reviso el contraste del texto blanco con capturas en claro y en oscuro.
- Saco el degradado de tarjeta anterior por completo.

## 2. Sin rojo de exceso en ningún lado
- Saco el coral o rojo de exceso de toda la app: anillo, barras de macros, detalle del día, calendario y estadísticas. Las barras llegan al 100 % en su color.
- Solo el botón de borrar mantiene el color de peligro.

## 3. Consumidas / Quemadas / Restantes
- La fila queda así: "Consumidas" a la izquierda, el anillo con las kcal restantes en el centro y "Quemadas" a la derecha. El anillo mide unos 176 px para que todo entre en pantallas de 360 px.
- Restantes = límite − consumidas + quemadas. Las quemadas solo se suman si el interruptor está activado.
- Con el interruptor activado, el anillo se llena según consumidas ÷ (límite + quemadas). Apagado, se llena según consumidas ÷ límite. Siempre tiene un tope del 100 %, y si el límite es 0 no da error.
- Al tocar "Quemadas" se abre un panel con los entrenamientos del día elegido y un botón "Agregar entrenamiento". En el celular aparece desde abajo.

## 4. Entrenamientos
- Cada entrenamiento guarda: fecha, nombre, kcal quemadas (de 1 a 5000) y duración opcional. Cada persona ve y maneja solo los suyos, y nada se borra solo.
- Para agregar o editar se abre un diálogo con:
  - nombre, con chips de sugerencia: Pesas, Caminata, Correr, Bicicleta, Fútbol, Otro
  - kcal quemadas
  - duración en minutos, opcional
- El diálogo usa la fecha elegida en Hoy, con la hora de Buenos Aires. Antes de borrar pide confirmación.
- En Agregar hay una nueva opción "Entrenamiento" que abre ese mismo diálogo.
- En Hoy, debajo de las comidas, aparece una fila compacta por entrenamiento (llama, nombre, kcal) solo si hay alguno. Al tocar la fila se edita.
- El detalle del día también muestra los entrenamientos.
- En Perfil hay un interruptor nuevo, "Sumar calorías quemadas a mi límite", activado por defecto. Debajo dice, en letra chica: "Si tu límite ya incluye tu actividad física, desactivalo para no contar dos veces."
- Las estadísticas no cambian.

## 5. Tests
- Restantes con y sin entrenamientos, y con el interruptor apagado.
- Progreso del anillo con el interruptor prendido y apagado, con tope del 100 % y con límite 0.
- Aparece "kcal de más" al pasarse.
- Se rechazan kcal quemadas de 0, 5001 o un valor vacío, y se acepta un valor de 1 a 5000.

## Detalles técnicos
- Migración: tabla `entrenamientos` (id, user_id, fecha date, nombre text, calorias_quemadas numeric con CHECK 1–5000, duracion_min int null con CHECK > 0, created_at, updated_at), con GRANT a authenticated/service_role, RLS de las 4 operaciones por `auth.uid() = user_id` e índice (user_id, fecha). Además `profiles.sumar_quemadas boolean not null default true`.
- `nutri.ts` (puro): `balanceDia({ consumidas, limite, quemadas, sumarQuemadas })` devuelve `{ restante, excedido, progreso }` y `validarQuemadas(kcal)`. Los tests van en `nutri.test.ts`.
- `data.ts`: `entrenamientosDiaQuery(fecha)`, `guardarEntrenamiento`, `actualizarEntrenamiento`, `borrarEntrenamiento`.
- `styles.css`: tokens de degradado superior para claro y oscuro. Se eliminan los tokens hero viejos y las utilidades `over` de exceso. `tema.ts` actualiza `meta theme-color` y el padding usa `safe-area-inset-top`.
- Componentes: `CalorieRing` se simplifica (blanco, sin color de exceso); se agregan `EntrenamientoDialog`, `EntrenamientosSheet` (Drawer/Popover) y `WorkoutRow`. `MacroBar`/`MacroColumna` sin color de exceso.
- Actualizo la memoria del diseño de Hoy y de la regla "sin rojo de exceso".
