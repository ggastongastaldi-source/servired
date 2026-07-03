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

## Julio 2026 — Fase 2: state.merchant enriquecido con mercado/pricing

**Alcance (decisión tomada al iniciar):** merchant-first pero acotado — no toda
la rama merchant, solo `marketContext` conectado a las dos acciones más
cercanas a mercado/pricing (`RENOVAR_CAMPANIA`, `AUMENTAR_VISIBILIDAD`).
Worker y cliente quedan sin tocar en esta iteración.

**Cambios:**
- `giaStateReader.js`: nueva función `buildMarketContext(zonaId, rubroId)` que
  lee `MarketFieldEngine.analyze()`, `PricingPolicyEngine.computePricing()` y
  el `AladdinInsight` activo más reciente para la zona/rubro. Cada fuente con
  try/catch independiente (degradación segura por fuente, no todo-o-nada).
  `buildMerchantState()` ahora llama a esto usando `profile.zonaId`/`rubroId`
  (ya existían en `BusinessProfile`, no se agregó ningún campo nuevo).
- `priorityEngine.js`: sigue sin requires de Mongo ni servicios externos.
  Se agregaron dos funciones puras (`explicarMercado`, `proyectarResultado`)
  que solo interpretan el `marketContext` ya calculado. El objeto `accion()`
  ahora tiene dos campos opcionales: `explicacion` (responde "¿por qué?") y
  `resultadoEsperado` (responde "¿qué resultado espero?"), poblados solo en
  las dos ramas mencionadas, `null` en el resto.
- Tests: 10→12 (T11 valida null-safety sin marketContext, T12 valida
  explicacion/resultadoEsperado poblados con marketContext SHORTAGE).

**No se tocó:** modelos, Dispatch, kernel, `AladdinTool.js` (sigue leyendo
solo `MerchantProjection`, no es el consumidor correcto para esto — se dejó
así, evaluar si conviene unificarlo más adelante).

**Estado del ciclo cognitivo tras esta sesión:**
1. ¿Qué está pasando? ✅ (ya resuelto en sesión anterior)
2. ¿Por qué pasa? ✅ parcial — resuelto solo en ramas RENOVAR_CAMPANIA y
   AUMENTAR_VISIBILIDAD de merchant. Worker y cliente, sin resolver.
3. ¿Qué debo hacer? ✅ (resuelto desde el inicio, priorityEngine.js)
4. ¿Qué resultado espero? ✅ parcial — mismo alcance que el punto 2.

**Pendiente explícito para continuar Fase 2:**
- Extender a las demás ramas merchant (SOLICITUDES_PENDIENTES, CATALOGO_VACIO).
- Evaluar si worker/cliente necesitan su propio marketContext o si no aplica
  (el pricing/mercado es primariamente una señal de oferta, más relevante
  para merchant y quizás worker — no evaluado todavía).
- Test de integración contra Mongo real para buildWorkerState/buildClienteState:
  seguía pendiente de la sesión anterior, no se hizo en esta iteración porque
  el foco fue merchant. Sigue en la cola.

## Julio 2026 — Fase 3: Panel Comercial visible (merchant.html)

**Contexto:** Discovery Pass de frontend confirmó que `merchant-app.js` (el
controlador JS completo, con dashboard/perfil/catálogo/analítica) no tenía
HTML — literalmente "el cerebro sin cuerpo". Además existían dos paneles de
comercio en paralelo: `comercio.html` (placeholder "en construcción" con
widget G.I.A. funcional) y `merchant-app.js` (lógica completa sin vista).

**Cambios:**
- `public/merchant.html` creado: cuerpo HTML completo con todos los IDs que
  `merchant-app.js` ya esperaba (KPIs, formulario de perfil, grid de
  catálogo, analítica, boost). Estética cyberpunk oscura consistente con
  `admin.html` (cyan/naranja, Rajdhani + Share Tech Mono), con variante
  clara vía `data-theme`.
- Tarjeta de prioridad G.I.A. agregada al dashboard: consume
  `/api/gia/priority` y renderiza `explicacion`/`resultadoEsperado`
  (los campos agregados en la Fase 2 de esta misma bitácora) — primera
  superficie visible de esa integración.
- Widget flotante G.I.A. portado desde `comercio.html` (actividad + chat),
  re-tematizado con los tokens de `merchant.html`. Misma lógica funcional,
  no reescrita.
- Selector Sol/Luna: implementado autocontenido en `merchant.html` vía
  `data-theme` + clave `servired_theme` en localStorage. Se investigó si
  ya existía un mecanismo reutilizable en `index.html`/`cliente.html` — el
  match del grep anterior resultó ser el meta tag `theme-color` (falso
  positivo), no un toggle real. Decisión: mecanismo propio y simple, sin
  asumir una convención no verificada. Pendiente: si en el futuro se
  confirma un toggle real en otras páginas, unificar clave.
- `public/js/merchant-app.js`: un solo patch aditivo — emite el evento
  `merchant:dashboard-loaded` con el `merchantId` tras cargar el dashboard,
  para que el widget G.I.A. de `merchant.html` pueda conectarse sin poll
  y sin que `merchant-app.js` conozca la existencia de ese widget.
- `public/comercio.html`: pasa a redirigir a `/merchant.html` (con backup
  `.bak-<timestamp>` conservado localmente, no versionado). Elimina la
  duplicación de paneles señalada en esta sesión.

**Punto 5 de la orden (token inválido) — revisado, sin fix nuevo:**
`merchant-app.js` y `gia-home.html` ya usan una cadena de fallback
(`merchant_token` → `token` → `sessionStorage.token`). El login real en
`index.html`/`cliente.html`/`trabajador.html` siempre escribe `token`, así
que ese fallback ya cubre el flujo de comerciante. No se encontró una causa
raíz activa que corregir sin tocar los flujos de login de los otros roles
(fuera del alcance de bajo riesgo pedido esta sesión). Se deja como
observación: unificar a una sola clave (`token`) en todo el ecosistema
sigue pendiente como mejora de consistencia, no como bug urgente.

**No se tocó:** modelos, Dispatch, kernel, `priorityEngine.js`,
`giaStateReader.js` (ya cerrados en Fase 2).

**Estado tras esta sesión:** el Panel Comercial es ahora una superficie
real y navegable en `/merchant.html`, alimentada por datos existentes
(`MerchantProjection`, `priorityEngine` con `marketContext`, catálogo,
G.I.A.). El siguiente salto de valor visible ya no requiere más backend —
requiere iterar sobre esta misma pantalla (pulir estados vacíos, probar
con datos reales de un comercio, verificar el flujo completo end-to-end
en el dispositivo).
