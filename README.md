# Kcalcountpal

Quiero construir una app web mobile-first llamada "KcalCountPal" para contar calorías y seguir nutrientes con IA. Inspiración visual y de UX: Lifesum y MyFitnessPal, pero más limpia y minimalista. La interfaz debe estar en español (Argentina).

## OBJETIVO
Que el usuario registre lo que come día a día, con calorías y valores nutricionales completos, y vea en tiempo real cuánto lleva respecto a sus metas diarias. La función estrella: sacar o subir una foto de una comida, describirla por voz o texto, y que la IA estime calorías y nutrientes.

## AUTENTICACIÓN Y DATOS
- Login con email/contraseña y Google.
- Base de datos con Supabase. Cada usuario solo ve sus propios datos (RLS).
- Tablas sugeridas: perfiles, metas_diarias, comidas (entradas del diario), y storage para fotos.

## PANTALLAS

1. **Hoy (home)**
   - Selector de fecha arriba para navegar días anteriores.
   - Anillo/gráfico circular principal: calorías consumidas vs. límite diario (calorías restantes en el centro). Cambia de color suavemente si se supera el límite.
   - Tres barras de progreso para proteínas, carbohidratos y grasas: gramos consumidos / gramos objetivo (ej: 78 g / 120 g).
   - Diario agrupado por momento del día: Desayuno, Almuerzo, Merienda, Cena, Snacks. Cada comida muestra nombre, calorías y macros resumidos. Se puede tocar para ver detalle, editar o borrar.
   - Botón flotante "+" para agregar comida.

2. **Agregar comida** (flujo principal)
   - Tres opciones claras: Foto con IA, Describir con texto/voz, Carga manual.
   - **Foto con IA:** el usuario saca una foto o la sube desde la galería. Después aparece un campo para describir la comida con texto o con un botón de micrófono (dictado por voz, que transcribe al campo de texto y permite editar). La descripción es opcional pero se recomienda ("200 g de pollo a la plancha, arroz, cocinado con poco aceite").
   - Se envía foto + descripción a una edge function que usa un modelo de IA con visión.
   - La IA devuelve JSON estructurado con: nombre del plato, lista de ingredientes con cantidad estimada en gramos, y por cada uno y en total: calorías, proteínas, carbohidratos, grasas totales, grasas saturadas, fibra, azúcares, sodio. También un nivel de confianza.
   - **Pantalla de revisión:** mostrar los resultados como estimación editable. El usuario puede ajustar cantidades, borrar o agregar ingredientes, y los valores se recalculan al instante. Luego elige el momento del día y guarda.
   - **Texto/voz sin foto:** misma lógica, solo con la descripción.
   - **Carga manual:** formulario con nombre, calorías y todos los nutrientes.

3. **Detalle nutricional del día**
   - Vista completa con todos los nutrientes: calorías, proteínas, carbohidratos, grasas totales, grasas saturadas, fibra, azúcares, sodio. Cada uno con su total del día y, cuando hay meta, su progreso.

4. **Metas y perfil**
   - Configurar límite diario de calorías y objetivo en gramos de proteínas, carbohidratos y grasas (editable manualmente; ejemplo inicial: proteína 120 g).
   - Opcional: onboarding corto (peso, altura, edad, objetivo) que sugiera metas, siempre editables.

5. **Historial/Progreso** (simple)
   - Gráfico semanal de calorías vs. límite y promedio de macros.

## DISEÑO
- Estilo clean, minimalista, mucho espacio en blanco, tarjetas redondeadas, tipografía moderna y legible.
- Paleta fresca y suave (verdes o tonos naturales como base, con un color de acento), colores distintos y consistentes para cada macro.
- Animaciones suaves en los anillos y barras de progreso.
- Mobile-first, navegación inferior con Hoy, Agregar, Progreso, Perfil.
- Soporte para modo oscuro.

## REQUISITOS TÉCNICOS
- React + Tailwind + componentes shadcn/ui.
- La llamada a la IA debe correr en una edge function (nunca exponer claves en el frontend). Usar Lovable AI para el modelo con visión.
- Validar y manejar errores: si la IA falla o la foto no es comida, mostrar un mensaje claro y permitir reintentar o cargar manualmente.
- Comprimir la foto en el cliente antes de subirla.
- Estados de carga elegantes mientras la IA analiza.

## LO QUE NO HACER EN ESTA V1
No incluir base de datos de alimentos externa, escáner de código de barras, integración con wearables ni funciones sociales. Priorizar que el flujo principal funcione muy bien.

Antes de construir, proponeme el plan con la estructura de pantallas, el esquema de la base de datos y el flujo de la edge function, para que lo revise.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kcalcountpal.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b4ad6288-3973-4336-a5cd-9d8e8a52114f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
