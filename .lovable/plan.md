# Rediseño de metas diarias en Perfil

No se borran datos; las metas siguen guardándose en gramos (fuente para Hoy, barras, estadísticas y onboarding).

## 1. Perfil
- La tarjeta "Metas diarias" pasa a ser la tarjeta resumen "Calorías y macronutrientes": mini anillo de 3 segmentos con los colores fijos de cada macro, el límite de kcal y, por cada macro, % y gramos. El botón "Ajustar" abre /perfil/metas a pantalla completa.
- La tarjeta colapsable "Otros límites (opcional)" incluye grasas saturadas, fibra, azúcares y sodio. Funciona igual que ahora (0 = no usar) y tiene su propio botón de guardar.

## 2. Pantalla "Ajustar calorías y macros" (/perfil/metas)
- Kcal con botones − / + (pasos de 50) y campo editable. Debajo de 1.200 aparece un aviso suave sin rojo: "Son estimaciones, no consejo médico".
- Anillo grande de trazo fino, con segmentos proporcionales a las kcal de cada macro. En el centro dice "100 %" en color neutro; si la suma no da 100, se muestra en ámbar, nunca en rojo.
- Filas Proteínas, Carbohidratos y Grasas: slider de 1 % (rango 5–70 %), botones − / + y "122 g · 30 % · 489 kcal". Los gramos se pueden tocar y escribir.
- Al mover un macro, los otros dos absorben la diferencia en proporción, por mayor residuo y respetando los límites. La suma siempre da 100.
- Al cambiar las kcal se mantienen los porcentajes y se recalculan los gramos.
- Chips: Equilibrada (C50/P20/G30), Alta en proteínas (C40/P35/G25) y Moderada (C40/P40/G20).
- "Guardar ajustes" queda fijo abajo, con safe-area, y deshabilitado mientras guarda. "Restablecer" vuelve a los valores con los que se abrió la pantalla. Hay margen inferior para que el botón no tape el último slider, y se pide confirmación al salir con cambios sin guardar.
- Metas anteriores sin porcentajes: se derivan de los gramos y se normalizan a 100, con el aviso "Ajustamos los porcentajes para que coincidan con tus calorías. Guardá para confirmar". No se guarda nada hasta tocar Guardar.

## 3. Datos
- Se agregan a las metas diarias tres porcentajes opcionales (enteros de 5 a 70). Se guardan junto con los gramos.
- Al guardar se actualizan las metas, Hoy, el detalle del día y Progreso.
- El onboarding y las metas sugeridas también guardan los porcentajes.

## 4. Tests (funciones puras en nutri.ts)
- Gramos desde % y kcal: P/C con ÷4 y G con ÷9, redondeados.
- Porcentajes desde gramos, normalizados a 100.
- La redistribución siempre suma 100 y respeta 5/70 (incluye casos extremos).
- Cambiar las kcal mantiene los porcentajes.
- Las metas viejas que no cierran con las kcal se normalizan.
- 120 g de proteína con 1.500 kcal da 32 %.

## Detalles técnicos
- Migración: `pct_proteinas`, `pct_carbohidratos` y `pct_grasas` int nullable, con CHECK 5–70, en `metas_diarias`.
- Nuevas funciones puras: `gramosDesdePct`, `pctDesdeGramos`, `redistribuirPct`, `pctDesdeGramosInput` y `normalizarPct` (mayor residuo).
- Rutas: `perfil.tsx` pasa a ser un layout con `<Outlet />`. El contenido actual va a `perfil.index.tsx` y se crea `perfil.metas.tsx`. Cada ruta tiene su head().
- El aviso de salida usa `useBlocker` de TanStack Router.
