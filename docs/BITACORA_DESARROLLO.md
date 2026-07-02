# Bitácora de Desarrollo — ServiRed OS
Registro cronológico de decisiones técnicas. Append-only, entradas más nuevas abajo.

## Julio 2026 — Fix giaStateReader + gap de ETA identificado

**Contexto:** Discovery Pass sobre el pipeline G.I.A. (buildUserState → priorityEngine
→ /api/gia/priority → gia-home.html) en el marco del norte v2.1 (ciclo cognitivo de
4 preguntas).

**Bug encontrado y corregido:** `giaStateReader.js` consultaba `workerId`/`clienteId`
y estados `ASIGNADO/EN_CAMINO/EN_CURSO/FINALIZADO` que no existen en el schema real
de `Pedido` (`worker`/`cliente`, estados `ACEPTADA/EN_PROCESO/REALIZADA/CERRADA`).
No había ninguna capa de traducción en el resto del sistema — confirmado por grep
exhaustivo. Consecuencia: `pedidoActivo` devolvía `null` siempre para worker y
cliente, y `PriorityEngine` nunca veía un trabajo activo real.
Fix: commit a569759. `priorityEngine.js` no se tocó (función pura, 10 tests OK) —
la traducción vive en `giaStateReader.js` vía `ETAPA_MAP_WORKER`.

**Gap identificado, deliberadamente NO resuelto:** `etaMinutos` (cliente) y
`llegadaConfirmada` (worker) no tienen dónde leerse. El motor de ETA
(`src/dispatch/services/ETAProvider.js`) calcula `etaMinutes` solo en tiempo de
dispatch/asignación — no se persiste en `Pedido` ni se actualiza después.
`TimelineEvent` tampoco tiene un tipo de evento para confirmación de llegada.
Decisión: dejar ambos campos en valor neutro (`0` / `false`) con TODO explícito
en el código, en vez de inventar un campo o simular el dato. Se documenta acá
como candidato futuro: un bounded context de seguimiento post-asignación que
persista `etaMinutes` al aceptar el pedido y lo actualice vía un evento nuevo
(ej. `ETA_RECALCULATED`, `WORKER_ARRIVED`) — reutilizando `ETAProvider.js`
existente, no reconstruyéndolo.

**Estado del pipeline G.I.A. tras esta sesión:** confirmado end-to-end y sin
duplicaciones. `priorityEngine.js` responde correctamente a la pregunta 3 del
ciclo cognitivo ("qué hacer"). Preguntas 2 y 4 ("por qué" / "qué resultado
esperar") siguen sin resolver — requieren conectar MarketFieldEngine,
PricingPolicyEngine y AladdinInsight, que hoy corren aislados del árbol de
decisión de G.I.A.
