# Metas distintas para días de entrenamiento

No se borra ningún dato. "Sumar calorías quemadas" queda en desuso, pero no se elimina.

## 1. Modo de entrenamiento (Perfil › Entrenamientos)
Un selector de tres opciones reemplaza el interruptor. Cada opción tiene una línea que la explica:
- **Meta fija**: las calorías quemadas se ven, pero no cambian el límite.
- **Sumar calorías quemadas**: funciona como ahora.
- **Metas por tipo de día**: "Tus metas de entrenamiento ya contemplan el gasto, por eso las calorías quemadas no se suman."

Solo en el último modo aparece el campo "Contar como día de entrenamiento desde X kcal quemadas (0 = cualquier entrenamiento)", con un valor de 0 a 2.000.

## 2. Metas de entrenamiento
- Se guardan aparte: kcal (800 a 6.000), gramos y porcentajes con un decimal.
- Hay que completarlas todas o dejarlas todas vacías. Los porcentajes tienen que sumar 100,0.
- Los límites opcionales (saturadas, fibra, azúcares y sodio) son los mismos para los dos tipos de día.
- Si el modo es "por tipo de día" y todavía no cargaste las metas de entrenamiento, se usan las de descanso. Además aparece el aviso "Configurá tus metas de entrenamiento", con un enlace.

## 3. Reglas de cálculo
- **Día de entrenamiento**: el modo es "por tipo de día", ese día hay al menos un entrenamiento y las kcal quemadas alcanzan el umbral.
- **Restantes**: solo se suman las quemadas en el modo "Sumar". En los otros dos, restantes = meta del día − consumidas.

## 4. Pantalla de ajuste de metas
- Tiene las pestañas **Descanso** y **Entrenamiento**. La segunda aparece solo en el modo "por tipo de día". Los controles son los mismos que ahora.
- Cada pestaña conserva su propio borrador.
- **Guardar**: guarda solo la pestaña que cambiaste. No toca la otra ni los límites opcionales.
- **Aviso suave**: aparece si las kcal de entrenamiento quedan por debajo de las de descanso. No impide guardar.
- **Primera vez**: al activar el modo, la pestaña Entrenamiento se llena con una copia de tus metas de descanso, sin guardar, y te lleva a configurarla.
- **Se mantiene**: la pregunta "¿Salir sin guardar?" y la barra de abajo oculta.

## 5. Perfil
- La tarjeta de resumen suma un selector Descanso/Entreno, solo en el modo "por tipo de día".
- "Ajustar" abre la pestaña que estés viendo.

## 6. Hoy y detalle del día
- El anillo, las restantes y las barras usan las metas que corresponden a la fecha elegida.
- Aparece una etiqueta discreta "Día de entrenamiento", sin colores de alerta.
- El anillo y las barras esperan a que estén cargadas las comidas, las metas y los entrenamientos del día. Así no saltan de un número a otro.
- Agregar o borrar un entrenamiento recalcula las metas del día.

## 7. Estadísticas
- La línea del límite en "Ingesta de calorías" pasa a ser escalonada: cada día muestra la meta de su tipo.
- Los días se cuentan con la hora de Buenos Aires.

## Detalles técnicos
- **Migración solo aditiva**:
  - `profiles.modo_entrenamiento`: texto con default `'sumar_quemadas'` y CHECK de los tres valores. Se completa desde `sumar_quemadas` (true → `'sumar_quemadas'`, false → `'fija'`).
  - `profiles.umbral_entreno_kcal`: int, default 0, CHECK de 0 a 2000.
  - `sumar_quemadas` queda con un COMMENT DEPRECATED.
  - Columnas `*_entreno` en `metas_diarias`, con CHECK de "todas o ninguna", rangos y suma = 100,0.
  - Hay que revisar `protect_limite` para confirmar que no bloquea las columnas nuevas.
- **Lógica pura en `nutri.ts`**:
  - `metasParaDia({ metas, modo, umbral, quemadasDelDia, hayEntrenamiento })` devuelve `{ metasEfectivas, esDiaEntreno }`.
  - `balanceDia` recibe `modo` en lugar del booleano.
  - Los gramos salen de `filaMacros`, con el sufijo de la pestaña.
- **Guardado en `data.ts`**: `guardarMetasMacros(kcal, pct, tipo: 'descanso' | 'entreno')` actualiza solo las columnas de ese tipo.
- **Estadísticas**: una consulta liviana trae `entrenamientos(fecha, calorias_quemadas)` del período y suma por fecha.
- **Tests**:
  - `metasParaDia` en los tres modos, con umbral.
  - `balanceDia` en los tres modos.
  - Uso de las metas de descanso cuando faltan las de entrenamiento.
  - Paso de `sumar_quemadas` a modo.
  - Guardar una pestaña devuelve solo sus columnas.
  - 128/191/47 g con 1.700 kcal da 30,1/45,0/24,9 % y conserva esos gramos al reabrir.
  - Una caminata de 100 kcal con umbral 150 no cuenta como día de entrenamiento.
  - Un entrenamiento a las 22:00 cuenta para el día correcto.
  - Verificación en la base: el CHECK rechaza porcentajes que no suman 100,0 y columnas parciales.
