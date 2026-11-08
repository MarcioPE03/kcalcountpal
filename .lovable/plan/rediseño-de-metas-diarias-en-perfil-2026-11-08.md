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
- Se agregan a las metas diarias tres porcentajes opcionales con un decimal (5,0 a 70,0). Se guardan junto con los gramos, que se calculan con el porcentaje exacto, sin redondearlo antes.
- Al guardar se actualizan las metas, Hoy, el detalle del día y Progreso.
- El onboarding y las metas sugeridas también guardan los porcentajes.

## 4. Tests (funciones puras en nutri.ts)
- Gramos desde % y kcal: round(kcal × % ÷ 100 ÷ 4) para P/C y ÷ 9 para G. El porcentaje se usa con su decimal y solo se redondean los gramos finales. 26,7 % con 1.800 kcal da 120 g de proteína.
- Porcentajes desde gramos, normalizados a 100.
- La redistribución siempre suma 100 y respeta 5/70 (incluye casos extremos).
- Cambiar las kcal mantiene los porcentajes.
- Las metas viejas que no cierran con las kcal se normalizan.
- 120 g de proteína con 1.500 kcal da 32,0 %.

## Detalles técnicos
- Migración: `pct_proteinas`, `pct_carbohidratos` y `pct_grasas` numeric(4,1) nullable, con CHECK 5.0–70.0, en `metas_diarias`.
- Nuevas funciones puras: `gramosDesdePct`, `pctDesdeGramos`, `redistribuirPct`, `pctDesdeGramosInput` y `normalizarPct` (mayor residuo).
- Rutas: `perfil.tsx` pasa a ser un layout con `<Outlet />`. El contenido actual va a `perfil.index.tsx` y se crea `perfil.metas.tsx`. Cada ruta tiene su head().
- El aviso de salida usa `useBlocker` de TanStack Router.

## Ajustes incorporados
1. **Porcentajes con un decimal**: los sliders y los botones − / + se mueven de a 1 %. Al tipear gramos se conserva el decimal: 120 g con 1.800 kcal da 26,7 % y vuelve a dar 120 g. La redistribución y el mayor residuo trabajan en décimas, y la suma da exactamente 100,0. En pantalla se ve "32 %" si es entero y "26,7 %" si no.
2. **Sin deriva al arrastrar**: al empezar a mover un slider se guarda una copia de los tres valores, y cada movimiento se calcula desde esa copia. Si llevás uno de 30 a 50 y lo volvés a 30, se restauran exactamente los valores originales.
3. **Pantalla completa**: en /perfil/metas se oculta la barra inferior, con flecha de volver arriba y Guardar fijo con safe-area. La pestaña Perfil sigue marcada en todas las subpantallas de /perfil.
4. **Guardados parciales**: "Guardar ajustes" actualiza solo calorías, gramos y porcentajes. "Otros límites" actualiza solo sus 4 valores. Ninguno reescribe la fila completa. Una única función guarda calorías, gramos y porcentajes juntos, y la usan la pantalla de ajuste, el onboarding y las metas sugeridas.
5. **Regla en la base**: los tres porcentajes son todos nulos o todos con valor; si tienen valor, suman 100,0.
6. **Validaciones**:
   - Kcal entre 800 y 6.000.
   - Un campo vacío o con texto inválido no rompe la pantalla.
   - Los botones − / + primero redondean al múltiplo de 50 más cercano y después suman o restan 50 (1.498 → 1.550 con "+" y 1.450 con "−"). La regla vive en una función pura.
   - Si los gramos tipeados dan menos de 5 % o más de 70 %, se ajustan al límite con un aviso breve.
7. **Metas viejas**: mientras no guardes, la tarjeta resumen de Perfil usa los mismos porcentajes derivados y normalizados que la pantalla de ajuste.
8. **Aviso de salida**: se desactiva apenas el guardado sale bien. Mientras haya cambios sin guardar, también avisa al cerrar o recargar la pestaña.
9. **Tests adicionales**:
   - 120 g con 1.800 kcal conserva 120 g tras guardar y reabrir.
   - Ida y vuelta de un slider sin deriva.
   - Guardar "Otros límites" no toca calorías, gramos ni porcentajes, y viceversa.
   - La base rechaza porcentajes que no suman 100,0.
   - Redondeo de kcal: 1.498 con "+" da 1.550 y con "−" da 1.450.
   - El onboarding guarda los porcentajes.

Técnico: las columnas pasan a `numeric(4,1)` con CHECK 5.0–70.0, más un CHECK de todo-nulo o suma = 100.0. Se suma `beforeunload` al aviso de salida. La lista de cambios pendientes va a roadmap.md al construir.
