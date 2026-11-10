# Cambiar la IA de la app a Gemini con tu propia clave

## Qué se reemplaza (los 5 usos de IA que tiene hoy la app)
| Función | Uso | Modelo nuevo |
|---|---|---|
| Analizar comida | foto + texto/voz, o solo texto | gemini-2.5-flash si hay foto; gemini-2.5-flash-lite si es solo texto |
| Leer etiqueta nutricional | foto de la etiqueta | gemini-2.5-flash |
| Corregir con IA | texto | gemini-2.5-flash-lite |
| Clasificar categoría (escáner) | texto | gemini-2.5-flash-lite |
| Dictado por voz (transcripción) | audio | gemini-2.5-flash-lite (Gemini acepta audio) |

No hay otros usos de la IA de Lovable en la app: todo pasa por un único archivo del servidor.

## Clave
- Se lee del secreto `GEMINI_API_KEY`, solo en el servidor. Te pido que lo cargues con el formulario seguro antes de probar.
- Nunca se imprime ni se registra en logs.

## Comportamiento
- La app recibe exactamente el mismo formato de respuesta: se mantienen los mismos esquemas, validaciones, cupos diarios (30 / 100 / 50), reglas de grasa visible, Atwater y corrección por ingrediente.
- Fotos: ya se comprimen en el navegador a máx. 1024 px y JPEG 0,8; queda igual (ya cumple).
- Sin cambios de diseño ni de otras funciones.

## Errores
- 429 / RESOURCE_EXHAUSTED: mensaje "Ocurrió un error con la IA. Intentá nuevamente en unos minutos." y log `LIMITE_GEMINI`.
- Cualquier otro error: mismo mensaje, log con el motivo real (sin la clave).
- Sin reintentos automáticos. La foto y el texto cargados no se borran (la pantalla ya los conserva ante error; se verifica).

## Verificación
- Consultar la lista de modelos de Gemini con tu clave; si algún nombre no existe, usar el equivalente estable más barato y avisarte.
- Probar una foto real de comida, una corrección y una clasificación; correr los tests existentes.

## Nota
- Los mismos modelos de Google también están disponibles en la IA integrada, al precio del proveedor con créditos de plan mensual, con registro de uso y alertas. Sigo con tu clave salvo que me digas lo contrario.

## Detalles técnicos
- `src/lib/ai-model.ts`: constantes `GEMINI_MODEL_VISION`, `GEMINI_MODEL_TEXT`, `GEMINI_BASE_URL`.
- Nuevo `src/lib/gemini.server.ts`: helper `llamarGemini({model, system, partes, schema})` con `fetch` a `generateContent` (`responseMimeType: application/json` + `responseSchema`), header `x-goog-api-key`; mapea errores a una clase con motivo para log. Las "edge functions" serán las server functions existentes (estándar de este proyecto).
- `src/lib/ai.functions.ts`: reemplazar las 4 llamadas AI SDK y la transcripción por el helper; conservar `procesarRespuesta`, `aplicarCorreccion`, Zod, cupos y estados.
- Quitar dependencia `@ai-sdk/openai` si queda sin uso.

## Ajustes aprobados
- Se usa solo tu clave de Gemini, no la IA integrada.
- Si un modelo no existe: equivalente ESTABLE más barato, nunca "preview"; te aviso cuál quedó.
- "Thinking" desactivado en todas las llamadas (`thinkingBudget: 0`; si un modelo no lo permite, el mínimo aceptado).
- Dictado por voz con su propia constante `GEMINI_MODEL_TRANSCRIBE` (hoy flash-lite, se puede subir a gemini-2.5-flash).
- `@ai-sdk/openai` se quita solo tras verificar que no queda ningún otro uso.
