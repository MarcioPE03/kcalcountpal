# KcalCountPal — Plan v1

App web mobile-first en español (Argentina) para registrar comidas y estimar calorías y nutrientes con IA a partir de una foto, un texto o la voz.

## 1. Estructura de pantallas

```text
/auth                 Login / registro (email+contraseña y Google)
/onboarding           Peso, altura, edad, sexo, actividad, objetivo -> sugiere metas (editables)
/ (Hoy)               Selector de fecha, anillo de kcal, 3 barras de macros, diario por momento, botón "+"
/agregar              Elegir: Foto con IA | Describir (texto/voz) | Carga manual
/agregar/foto         Cámara/galería -> descripción opcional (texto + micrófono) -> Analizar
/agregar/describir    Descripción por texto/voz -> Analizar
/agregar/revisar      Estimación editable: ingredientes, gramos, totales en vivo, momento del día, Guardar
/agregar/manual       Formulario: nombre, momento, kcal y los 7 nutrientes
/comida/$id           Detalle de una comida: editar / borrar
/dia/$fecha           Detalle nutricional del día: los 8 nutrientes con total y progreso
/progreso             Gráfico semanal kcal vs. límite + promedio de macros
/perfil               Metas (kcal, P/C/G y opcionales fibra/azúcar/sodio), datos, tema claro/oscuro, cerrar sesión
```

Navegación inferior fija: Hoy, Agregar, Progreso, Perfil. Todas las pantallas salvo /auth requieren sesión; si el usuario no tiene metas lo mandamos al onboarding (salteable, con metas por defecto: 2000 kcal, proteína 120 g, carbohidratos 220 g, grasas 65 g).

## 2. Diseño

- Base verde salvia suave + acento coral; fondo cálido casi blanco; modo oscuro verde muy oscuro.
- Colores fijos por macro: proteína azul petróleo, carbohidratos ámbar, grasas coral/rosa.
- Tipografía: Manrope (títulos) + Figtree (texto). Tarjetas muy redondeadas, mucho aire.
- Anillo SVG animado; pasa suavemente a coral/rojo al superar el límite ("+150 kcal de más").
- Barras animadas; skeletons y una animación de "analizando tu plato" con mensajes rotativos durante la IA.

## 3. Base de datos (Lovable Cloud)

**profiles** — id (= usuario), nombre, peso_kg, altura_cm, edad, sexo, nivel_actividad, objetivo (bajar/mantener/subir), onboarding_completo, created_at.

**metas_diarias** — user_id (único), calorias, proteinas_g, carbohidratos_g, grasas_g, grasas_saturadas_g, fibra_g, azucares_g, sodio_mg (estos 4 opcionales), updated_at.

**comidas** (entradas del diario) — id, user_id, fecha (date), momento (desayuno|almuerzo|merienda|cena|snack), nombre, origen (foto|texto|manual), descripcion, foto_path, confianza (baja|media|alta), ingredientes (jsonb: lista con nombre, gramos y los 8 valores por ingrediente), totales en columnas: calorias, proteinas_g, carbohidratos_g, grasas_g, grasas_saturadas_g, fibra_g, azucares_g, sodio_mg, created_at, updated_at. Índice por (user_id, fecha).

**Storage:** bucket privado `fotos-comidas`, rutas `{user_id}/{uuid}.jpg`; se ven con URLs firmadas.

**Seguridad:** RLS en las tres tablas y en el bucket: cada usuario solo lee/escribe filas con su propio id y archivos en su propia carpeta. Un trigger crea perfil y metas por defecto al registrarse.

## 4. Flujo de análisis con IA

```text
Cliente                                   Servidor (función protegida)               Lovable AI
1. Foto -> comprimir (máx 1024px, JPEG ~0.8, <~300 KB)
2. Subir a fotos-comidas/{uid}/...
3. Llamar analizarComida({ foto_path?, descripcion? })
                                          4. Verificar sesión y que la foto sea del usuario
                                          5. Generar URL firmada / leer imagen
                                          6. Prompt nutricionista (es-AR) + imagen + texto  -->  modelo con visión
                                          7. Respuesta JSON con esquema estricto        <--
                                          8. Validar (zod), recalcular totales como suma
                                             de ingredientes, redondear
9. Pantalla de revisión <---------------- { es_comida, plato, confianza, ingredientes[], totales, nota }
```

- Esquema de salida: es_comida, motivo_rechazo, nombre_plato, confianza, ingredientes [{nombre, gramos, calorias, proteinas, carbohidratos, grasas, grasas_saturadas, fibra, azucares, sodio_mg}], totales.
- En la revisión cada ingrediente guarda sus valores "por gramo"; al cambiar gramos se recalcula al instante. Agregar ingrediente = fila manual (nombre, gramos, valores) o reanalizar solo ese texto con IA.
- Errores con mensaje claro y botones "Reintentar" y "Cargar manualmente": no es comida, foto ilegible, sin créditos de IA, límite de uso, error de red. Nada se guarda hasta que el usuario confirma.
- Voz: dictado del navegador en es-AR que escribe en el campo (editable); si el navegador no lo soporta, se graba el audio y se transcribe en el servidor con Lovable AI.

## 5. Fuera de alcance v1

Base de alimentos externa, código de barras, wearables, funciones sociales.

## Detalles técnicos

- El proyecto usa TanStack Start: las "edge functions" se implementan como funciones de servidor protegidas (`createServerFn` + middleware de auth), equivalentes en seguridad; la clave de IA nunca llega al navegador.
- Lovable AI Gateway con el modelo por defecto con visión (`openai/gpt-6-astra`, Responses API, salida `json_schema` estricta, streaming consumido en el servidor).
- Lovable Cloud: auth email/contraseña + Google gestionado, migraciones con GRANTs + RLS, bucket privado.
- Datos con TanStack Query (cache por fecha; invalidación al guardar/editar/borrar). Gráficos con Recharts. Compresión con canvas en el cliente.
- Tests de las reglas: recálculo de totales al cambiar gramos, cálculo de metas sugeridas (Mifflin-St Jeor + actividad + objetivo) y calorías restantes/excedidas.
