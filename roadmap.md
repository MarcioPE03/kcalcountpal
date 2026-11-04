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
- [ ] Vaciar y borrar el bucket de fotos (función puntual), luego foto_path = NULL
