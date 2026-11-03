# KcalCountPal — Plan v1

App web mobile-first en español (Argentina) para registrar comidas y estimar calorías y nutrientes con IA a partir de una foto, un texto o la voz.

## 1. Estructura de pantallas

```text
/auth                 Login / registro (email+contraseña y Google)
/onboarding           Peso, altura, edad, sexo, actividad, objetivo -> sugiere metas (editables)
/ (Hoy)               Selector de fecha, anillo de kcal, 3 barras de macros, diario por momento
/agregar              Elegir: Foto con IA | Describir (texto/voz) | Carga manual | Recientes | Copiar de ayer
/agregar/foto         Cámara/galería -> descripción opcional (texto + micrófono) -> Analizar
/agregar/describir    Descripción por texto/voz -> Analizar
/agregar/revisar      Estimación editable: ingredientes, gramos, totales en vivo, momento del día, Guardar
/agregar/manual       Formulario: nombre, momento, kcal y los 7 nutrientes
/comida/$id           Detalle de una comida: editar / borrar
/dia/$fecha           Detalle nutricional del día: los 8 nutrientes con total y progreso
/progreso             Gráfico semanal kcal vs. límite + promedio de macros
/perfil               Metas (kcal, P/C/G y opcionales fibra/azúcar/sodio), datos, tema claro/oscuro, cerrar sesión
```

- Barra inferior: Hoy, Progreso, **botón central destacado "Agregar"**, Perfil (y un único punto de entrada para agregar; sin "+" flotante en Hoy).
- Agregar usa la **fecha seleccionada en Hoy** (no siempre hoy). El momento del día se preselecciona según la hora local (desayuno <11, almuerzo <15, merienda <19, cena <23, si no snack) y es editable.
- Todas las pantallas salvo /auth requieren sesión; sin metas -> onboarding (salteable; por defecto 2000 kcal, P 120 g, C 220 g, G 65 g).

## 2. Repetir comidas (sin IA)

- **Recientes:** últimas comidas distintas del usuario; un toque las vuelve a registrar en la fecha y momento elegidos (copia de la foto incluida si tenía).
- **Copiar de ayer:** copia todas las comidas del día anterior (o de un momento puntual) a la fecha seleccionada.

## 3. Diseño y formato

- Base verde salvia suave + acento coral; modo oscuro verde muy oscuro. Macros: proteína azul petróleo, carbohidratos ámbar, grasas coral/rosa.
- Tipografía Manrope + Figtree. Tarjetas redondeadas, mucho aire. Anillo y barras animados; el anillo pasa a coral/rojo al superar el límite.
- Formato argentino: coma decimal ("78,5 g"), "kcal", "g", "mg", fechas "mar 3 nov" / "03/11/2026", semana empezando el lunes.
- Estimaciones de IA se muestran con rango: "~520 kcal (450-600)".

## 4. Base de datos (Lovable Cloud)

**profiles** — id (= usuario), nombre, peso_kg, altura_cm, edad, sexo, nivel_actividad, objetivo, onboarding_completo, limite_analisis_diario (default 30), created_at.

**metas_diarias** — user_id (único), calorias, proteinas_g, carbohidratos_g, grasas_g, grasas_saturadas_g, fibra_g, azucares_g, sodio_mg (los 4 últimos opcionales), updated_at.

**comidas** — id, user_id, fecha (date local), momento (desayuno|almuerzo|merienda|cena|snack), nombre, origen (foto|texto|manual|copia), descripcion, foto_path, confianza, kcal_min, kcal_max, ingredientes (jsonb), totales en columnas (calorias, proteinas_g, carbohidratos_g, grasas_g, grasas_saturadas_g, fibra_g, azucares_g, sodio_mg), created_at, updated_at. Índice (user_id, fecha).

**analisis_ia** — id, user_id, created_at, fecha_local, estado (ok|error|no_comida). Sirve para contar el límite diario.

**Storage:** bucket privado `fotos-comidas`, rutas `{user_id}/{uuid}.jpg`, vistas con URLs firmadas.

**Seguridad:** RLS en todas las tablas y en el bucket (cada usuario solo lo suyo). Trigger crea perfil y metas al registrarse. El conteo de `analisis_ia` solo lo inserta el servidor.

## 5. Fechas

- "Hoy" y la fecha de cada comida se calculan con la zona horaria del dispositivo (America/Argentina/Buenos_Aires por defecto), nunca en UTC. Se guarda `fecha` como día local ya calculado en el cliente.
- El límite diario de IA usa la fecha local enviada por el cliente, validada contra la hora del servidor (±1 día).

## 6. Flujo de análisis con IA

```text
Cliente                                   Servidor (función protegida)               Lovable AI
1. Foto -> comprimir (máx 1024px, JPEG ~0.8, <~300 KB) en memoria
2. analizarComida({ imagen_base64?, descripcion?, fecha_local })   [botón deshabilitado mientras corre]
                                          3. Verificar sesión y límite diario (30 por defecto)
                                          4. Prompt nutricionista argentino + imagen + texto -->  modelo con visión
                                          5. JSON con esquema estricto                     <--
                                          6. Validar (zod), sumar ingredientes, chequeo Atwater,
                                             registrar en analisis_ia
7. Revisión editable <------------------- { es_comida, plato, confianza, kcal_min, kcal_max, ingredientes[], totales, nota }
8. Guardar: recién ahí se sube la foto a Storage y se crea la comida
```

- **Prompt:** nutricionista argentino que conoce comidas locales (milanesa, empanadas, asado, facturas, mate, dulce de leche, alfajores, locro, etc.). Lista como ingredientes editables lo no visible (aceite de cocción, manteca, aderezos, azúcar). La descripción del usuario tiene prioridad sobre la foto. Devuelve rango kcal mín/máx según confianza.
- **Validación Atwater:** si las kcal difieren más de ~12 % de 4×P + 4×C + 9×G, se corrigen las kcal desde los macros y se baja la confianza un nivel.
- **Revisión:** cada ingrediente guarda valores por gramo; al cambiar gramos se recalcula al instante (el rango se escala proporcionalmente). Agregar ingrediente manual o borrar.
- **Errores** con mensaje claro y "Reintentar" / "Cargar manualmente": no es comida, foto ilegible, límite diario alcanzado ("Llegaste a 30 análisis hoy"), sin créditos de IA, red.
- **Borrar comida** borra también su foto de Storage (si ninguna otra comida copiada la usa).
- **Voz:** dictado del navegador en es-AR primero; si no está disponible, se graba audio y se transcribe en el servidor con Lovable AI. El texto siempre es editable antes de analizar.

## 7. Metas sugeridas

- Mifflin-St Jeor + actividad + objetivo (−20 % / 0 / +10 %), con piso de 1500 kcal hombres / 1200 kcal mujeres. Proteína ~1,6 g/kg; resto repartido en carbohidratos/grasas.
- Aviso corto: "Son estimaciones, no reemplazan el consejo de un profesional de la salud." Siempre editables.

## 8. Fuera de alcance v1

Base de alimentos externa, código de barras, wearables, funciones sociales.

## Detalles técnicos

- TanStack Start: las "edge functions" son funciones de servidor protegidas (`createServerFn` + middleware de auth); la clave de IA nunca llega al navegador.
- Lovable AI Gateway; modelo en una única constante (`AI_MODEL = "openai/gpt-6-astra"`, Responses API, `json_schema` estricto, streaming consumido en el servidor). Transcripción con el modelo de voz por defecto.
- Lovable Cloud: auth email/contraseña + Google gestionado, migraciones con GRANTs + RLS, bucket privado.
- TanStack Query (cache por fecha, invalidación al guardar/editar/borrar), Recharts, compresión con canvas, `Intl` es-AR para números y fechas.
- Tests: fecha local de una cena a las 22:00 (no pasa al día siguiente por UTC), momento preseleccionado por hora, recálculo de totales al cambiar gramos, corrección Atwater (>12 %), metas sugeridas con piso, formato con coma decimal, límite diario de análisis.
