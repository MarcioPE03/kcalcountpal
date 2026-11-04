# Escáner de código de barras + no guardar fotos

## 1. Escanear código

**Agregar comida** suma una cuarta opción: "Escanear código" (ícono de código de barras).

Flujo:
```text
Escanear (cámara trasera) -> código detectado -> Open Food Facts -> Revisión editable -> Guardar
```

- **Cámara:** pide permiso al abrir. Detecta con `BarcodeDetector` del navegador (Chrome Android) y, si no existe, con ZXing de respaldo. Formatos EAN-13, EAN-8, UPC-A, UPC-E. Vibración corta al detectar. También campo para tipear el código a mano.
- **Permiso denegado / sin cámara:** mensaje claro con cómo habilitarlo, botón "Reintentar" y la opción de tipear el código.
- **Open Food Facts:** se consulta por código y se leen los valores por 100 g (kcal, proteínas, carbohidratos, grasas, saturadas, fibra, azúcares, sodio; si solo trae sal, sodio = sal ÷ 2,5) y el tamaño de porción si existe.
- **Producto no encontrado o sin kcal/macros:** mensaje "No encontramos este producto" / "Faltan datos nutricionales" con botones **Cargar manualmente** y **Describir con IA** (este último llega con el nombre del producto precargado si lo hay). Nutrientes secundarios faltantes cuentan como 0 y se avisa.
- **Revisión:** la misma pantalla de revisión editable de hoy. Arriba, un selector de cantidad: **gramos** o **porciones** (si OFF trae porción; si no, solo gramos, por defecto 100 g). Al cambiar, se recalculan kcal y los 8 nutrientes al instante. Sin rango de kcal ni badge de confianza (son datos de etiqueta).
- **Categoría:** no se usa la de Open Food Facts. Una llamada corta a la IA clasifica el nombre del producto en una de las 12 categorías cerradas. Corre en segundo plano: si falla o tarda, queda "Otros" y se puede guardar igual (también editable a mano). No consume el cupo de 30 análisis diarios.
- **Guardado:** origen "código" con su propio ícono en el diario; cuenta igual en estadísticas, recientes y "copiar de ayer".

## 2. No guardar fotos

- La foto se comprime en el celular, se manda solo para el análisis y se descarta. La miniatura se ve en la revisión (en memoria) pero no se sube nunca.
- Se elimina la subida a Storage, las URLs firmadas y la foto en el detalle de la comida; al borrar o copiar una comida ya no se toca ninguna foto.
- **Limpieza en la base de datos:** se vacía la referencia a la foto en todas las comidas (la columna queda marcada como retirada, no se borra), se borran las fotos guardadas, sus permisos y el bucket.
- **No se borra ninguna comida, peso ni estadística.** Cada comida conserva su origen e ícono (foto, texto, manual, copia).

## Detalles técnicos

- Migración: ampliar el CHECK de `comidas.origen` con `'codigo'`; `UPDATE comidas SET foto_path = NULL`; `COMMENT ON COLUMN ... 'DEPRECATED'`; borrar policies de `storage.objects` del bucket `fotos-comidas`, `DELETE FROM storage.objects WHERE bucket_id='fotos-comidas'` y `DELETE FROM storage.buckets WHERE id='fotos-comidas'` (pide confirmación por ser destructiva; solo afecta fotos).
- Nuevo `src/lib/off.ts` (puro): parseo de respuesta OFF -> valores por gramo, sal->sodio, porción en g, validación de datos mínimos. Tests en `off.test.ts`.
- Consulta OFF en una función de servidor (`world.openfoodfacts.org/api/v2/product/{code}`, User-Agent propio, timeout). Clasificación de categoría en `ai.functions.ts` con el modelo de `ai-model.ts`, JSON estricto, fallback "Otros".
- Ruta `/agregar/codigo`; `@zxing/browser` importado dinámicamente solo si falta `BarcodeDetector`; cámara liberada al salir.
- Borrador (`stores.ts`): origen `"foto" | "texto" | "codigo"`, sin blob de foto; datos de producto (por 100 g, porción) para el selector gramos/porciones.
- `data.ts`: quitar `subirFoto`, `urlFoto`, lógica de foto en borrar/copiar. `meal.tsx`: ícono para `codigo`.
- Actualizar AGENTS.md (regla de fotos -> "las fotos nunca se guardan") y memoria (el código de barras deja de estar fuera de alcance; la base externa se limita a Open Food Facts por código).
- Tests: cálculo por gramos y por porción, sal->sodio, producto sin datos rechazado, categoría inválida -> "Otros".
