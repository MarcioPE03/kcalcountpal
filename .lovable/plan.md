# Rediseño de "Hoy" y navegación

Sin cambios en la base de datos ni en las comidas guardadas.

## 1. Tarjeta principal
- Anillo de kcal arriba, más grueso, con trazo en degradado (verde menta → lima → ámbar) y el número de kcal restantes grande. Si te pasás, se pone coral como hasta ahora.
- Debajo, una sola fila de 3 columnas: **Proteínas / Carbos / Grasas**. Cada una muestra el nombre, una barra fina con su color y "53/122 g".
- Se mantiene el link "Ver todos los nutrientes".
- La tarjeta tiene un fondo con degradado suave (menta, lima y un toque de ámbar), adaptado también al modo oscuro.

## 2. Lista única "Comidas de hoy"
- Saco las 5 tarjetas por momento. Queda una sola lista ordenada por hora de carga.
- Cada fila muestra el ícono de origen, el nombre, P/C/G, las kcal y un chip chico con el momento (Desayuno, Almuerzo, Merienda, Cena, Snack).
- Si no hay comidas, aparece un mensaje amable con un botón para agregar.
- Al agregar una comida, el momento se sigue preseleccionando según la hora y se puede cambiar con chips. Eso ya funciona así; solo reviso que esté igual en todos los caminos (foto, texto y manual).

## 3. Navegación y botón "+"
- La barra inferior queda con 3 pestañas: Hoy, Progreso y Perfil.
- Un botón "+" circular flota abajo a la derecha, por encima de la barra, con sombra suave. Lleva a Agregar y usa la fecha que tengas seleccionada.
- Agrego más espacio abajo para que el botón no tape la última comida.

## 4. Calendario
- Al tocar la fecha del encabezado se abre un calendario en español.
- "Hoy" aparece resaltado y los días con comidas tienen un puntito.
- Los días futuros quedan deshabilitados.
- Las flechas de día anterior y siguiente siguen funcionando.

## 5. Colores y temas
- El modo claro pasa a ser el predeterminado, con un fondo cálido casi blanco. En Perfil se mantiene el selector Claro/Oscuro/Sistema.
- El modo oscuro deja de ser casi negro: el fondo pasa a verde-gris (~#1B2823) y las tarjetas a ~#24342E.
- Los colores de los macros (azul petróleo, ámbar y coral/rosa) se vuelven más saturados y se usan iguales en toda la app.
- Reviso el contraste del texto en los dos modos con capturas de pantalla.

## Detalles técnicos
- `styles.css`: nuevos tokens (`--gradient-hero`, `--ring-from/via/to`, macros más saturados, paleta oscura nueva) y `theme-color` por modo.
- `tema.ts`: si no hay nada guardado, usa "claro" en lugar de "sistema". Para evitar el parpadeo, un script inline en `__root` aplica la clase antes de pintar.
- `CalorieRing`: `<linearGradient>` en el SVG y trazo de 20 px. Nuevo componente `MacroColumna` compacto.
- `MealRow`: suma un chip con el momento. La lista se ordena por `created_at`.
- `BottomNav`: 3 pestañas más un FAB `fixed` en `bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4`, que pasa `fecha` al ir a `/agregar`.
- Calendario: shadcn `Calendar` dentro de un `Popover`, `locale es` de date-fns, `disabled={{ after: hoy }}` y modifier `conComidas`. Una nueva consulta liviana trae las fechas con comidas del mes visible (`select fecha` agrupado).
- Agrego tests en `nutri.test.ts` para el orden cronológico y para el tema por defecto, si la lógica queda en una función pura.
