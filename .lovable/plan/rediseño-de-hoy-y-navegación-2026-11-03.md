# Rediseño de "Hoy" y navegación

Sin cambios en la base de datos ni en las comidas guardadas.

## 1. Tarjeta principal
- **Zona del anillo:** degradado vivo (menta, lima, ámbar). El anillo es más grueso, con trazo de progreso casi blanco sobre un track semitransparente. Las kcal restantes se ven grandes y con buen contraste; si te pasás, se marcan en coral.
- **Zona de macros:** en la misma tarjeta, sobre una superficie sólida (blanca en claro, tarjeta oscura en oscuro). Una fila de 3 columnas: **Proteínas / Carbos / Grasas**, cada una con su nombre, una barra fina de color y "53/122 g".
- Se mantiene el link "Ver todos los nutrientes".

## 2. Lista única de comidas
- Saco las 5 tarjetas por momento. Queda una sola lista ordenada por hora.
- El título dice "Comidas de hoy" si estás viendo hoy. Si no, muestra la fecha, por ejemplo "Lunes 2 de noviembre".
- Cada fila muestra el nombre, P/C/G, las kcal y un chip chico con el momento.
- Si no hay comidas, aparece un mensaje amable con un botón para agregar.
- Al agregar una comida, el momento se sigue preseleccionando según la hora y se puede cambiar con chips.

## 3. Navegación y botón "+"
- La barra inferior queda con 3 pestañas: Hoy, Progreso y Perfil.
- El botón "+" circular flota abajo a la derecha, con sombra suave, **solo en la pantalla Hoy**. No aparece en Agregar ni en sus pantallas.
- El botón usa la fecha que tengas seleccionada, y dejo espacio abajo para que no tape la última comida.

## 4. Calendario
- Al tocar la fecha se abre un calendario en español. En el celular aparece como panel desde abajo y en la compu como ventanita flotante.
- "Hoy" aparece resaltado y los días con comidas tienen un puntito.
- Los días futuros quedan deshabilitados.
- Las flechas de día anterior y siguiente siguen funcionando.

## 5. Fechas
- "Hoy" y la fecha elegida se calculan con la hora de Buenos Aires, nunca con la conversión que corre el día.
- Agrego un test: elegir el día 3 en el calendario da 3, y no 2 ni 4.

## 6. Colores y temas
- El modo claro pasa a ser el predeterminado, con un fondo cálido casi blanco. En Perfil sigue el selector Claro/Oscuro/Sistema.
- El modo oscuro usa fondos verde-gris (~#1B2823) y tarjetas ~#24342E.
- Los colores de los macros son más saturados y se usan iguales en toda la app.
- Reviso el contraste en los dos modos con capturas.

## Detalles técnicos
- `nutri.ts`: `fechaLocal()` usa `Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })`. Nueva función pura `fechaDeCalendario(d: Date)` que arma `yyyy-mm-dd` con `getFullYear/getMonth/getDate`. Los tests cubren el día 3 y el título de la lista. Actualizo en `AGENTS.md` la regla de fechas para que diga Buenos Aires.
- `styles.css`: tokens `--gradient-hero`, `--ring-progress`, `--ring-track`, macros más saturados y paleta oscura nueva.
- `tema.ts`: si no hay nada guardado, usa "claro". Un script inline en `__root` evita el parpadeo.
- `CalorieRing`: variante "hero" con stroke de 20 px. Nuevo componente `MacroColumna`. `MealRow` suma el chip de momento.
- `BottomNav` queda con 3 pestañas. El FAB se renderiza solo en `_authenticated/index.tsx` y pasa `fecha` en search.
- Calendario: shadcn `Calendar` dentro de `Drawer` (`useIsMobile`) o `Popover`, con `locale es`, `disabled={{ after }}` y modifier `conComidas`. Una consulta liviana trae las fechas con comidas del mes visible.
