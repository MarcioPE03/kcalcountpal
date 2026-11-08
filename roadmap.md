# KcalCountPal v1 roadmap
- [x] Cloud: tablas, RLS, bucket, auth email + Google
- [x] Diseño (tokens, fuentes) y navegación inferior
- [x] Auth + onboarding + perfil/metas
- [x] Hoy (anillo, barras, diario por momento, fecha)
- [x] Agregar: foto IA, texto/voz, manual, recientes, copiar de ayer
- [x] Función de servidor IA (límite diario, Atwater, rango) + transcripción
- [x] Revisión editable y guardado (foto subida al guardar)
- [x] Detalle de comida, detalle del día, progreso semanal
- [x] Tests de reglas

## Rediseño Hoy
- [x] Tarjeta con degradado + fila de macros
- [x] Lista única con chip de momento y título por fecha
- [x] 3 pestañas + botón + solo en Hoy
- [x] Calendario (drawer mobile / popover desktop) con fechas Buenos Aires
- [x] Colores: claro por defecto, oscuro verde-gris, macros saturados

## Código de barras + sin fotos
- [x] Escanear código (BarcodeDetector + ZXing), Open Food Facts, revisión por gramos/porciones
- [x] Categoría por IA en segundo plano con tope propio (100/día)
- [x] Quitar subida y vista de fotos
- [x] Vaciar y borrar el bucket de fotos (función puntual), luego foto_path = NULL

## Mis comidas
- [x] Tabla favoritos, reglas puras y tests
- [x] Pantalla Mis comidas (Recientes, Favoritos, Registro rápido) con selección múltiple
- [x] Corazón en detalle y casilla en revisión; Agregar reordenado; carga manual redirige

## Escáner para productos argentinos
- [x] Mis productos (tabla, prioridad sobre OFF, códigos EAN-13, lista en Perfil)
- [x] Foto de etiqueta con IA (cupo solo si sale bien)
- [x] Datos parciales en ámbar, guardar con datos incompletos
- [x] Lector más sensible, diagnóstico, cámara liberada

## Orden de comidas y entrenamientos
- [x] Lista de Hoy ordenada por momento, nombres en dos líneas
- [x] Menú "Agregar" y pantalla de entrenamientos (Recientes, Favoritos, Nuevo)

## Revisión: editor, grasa visible y corrección IA
- [ ] Editor por ingrediente (revisión y detalle)
- [ ] Grasa visible / piel con lista cerrada y exclusiones
- [ ] Corregir con IA con cupo propio y deshacer
