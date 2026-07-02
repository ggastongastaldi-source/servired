# PROMPT MAESTRO — ServiRed OS Comercial (documento rector unificado)
Versión: 2.0 — Julio 2026
Supersede como norte vigente a: PROMPT_MAESTRO_FASE_COMERCIAL.md y CONTINUIDAD_PANEL_COMERCIAL.md
(esos dos quedan en el repo como insumo histórico, no se borran, pero ya no son la referencia de decisión)

---

## 0. Qué cambia en esta versión

Las dos iteraciones anteriores acertaron en capas distintas pero incompletas:
- v1 (Fase Comercial) pensaba en arquitectura de sistema: Constitución, Bounded Contexts, Event Store, SOC.
- v1.1 (Continuidad Panel Comercial) pensaba en producto: MOS vs ERP, 4 cuadrantes de pantallas, prioridad de construcción.

Lo que faltaba en ambas: no alcanza con organizar pantallas (Estado/Ejecución/Inteligencia). Hay que definir cómo piensa el comerciante cuando toma una decisión. Esta versión sube ese nivel de abstracción y queda como el filtro único para todo lo que se construya de acá en adelante.

---

## 1. Principio rector (no cambia, se reafirma)

ServiRed es un **Market Operating System (MOS)**, no un ERP. No administra datos internos del comercio (stock, AFIP, proveedores) — coordina la relación entre tres actores en un mercado.

Regla de exclusión permanente: facturación AFIP compleja, circuitos de compra a proveedores, venta física con balanza/PLU — NO entran al núcleo. Si se piden, son producto satélite, nunca módulo del Command Center.

---

## 2. La trigonometría como modelo cognitivo, no solo de negocio

Comercio – Trabajador – Cliente deja de ser únicamente el modelo de datos/negocio. Pasa a ser el modelo cognitivo que organiza toda la experiencia del panel: cada componente del Command Center existe únicamente si mejora la coordinación entre esos tres actores. Si no se puede trazar esa mejora, el componente no se construye, sin importar cuán "lindo" o "estándar de mercado" sea.

## 3. El ciclo de decisión (el corazón de esta versión)

Un dashboard no es un producto de decisión. Un sistema de decisión sí. Todo lo que el comerciante ve en el panel debe poder responder, en secuencia, estas cuatro preguntas:

1. ¿Qué está pasando? (Estado — datos crudos interpretados)
2. ¿Por qué está pasando? (Causalidad — correlación con ZoneState, AuctionOutcome, EconomicGraphProjection)
3. ¿Qué debería hacer ahora? (Recomendación accionable — Aladdín/GIA)
4. ¿Qué resultado puedo esperar si lo hago? (Proyección — el cierre del loop, hoy el eslabón más débil del sistema)

Los tres motores ya definidos (Estado/Ejecución/Inteligencia) siguen siendo la organización de pantallas, pero ahora cada pantalla se audita contra este ciclo de cuatro preguntas, no solo contra "a qué motor pertenece".

---

## 4. Framework de evaluación de cuatro perspectivas (reemplaza el protocolo de 4 pasos anterior, lo absorbe y amplía)

Toda propuesta nueva — pantalla, feature, flujo — se evalúa desde estas cuatro perspectivas antes de aprobarse:

1. **Arquitectura** — ¿es consistente con ServiRed OS (Event Store -> Projections -> UI, SOC congelado, no lógica de negocio en frontend)?
2. **Producto** — ¿qué valor real tiene para el comerciante? ¿en qué pregunta del ciclo de decisión (sección 3) encaja?
3. **Neurocomputación aplicada** — ¿reduce carga cognitiva? ¿acelera la decisión? ¿muestra la información adecuada en el momento oportuno sin manipular?
4. **Monetización** — ¿cómo incrementa ingresos, eficiencia o retención? ¿es capacidad freemium-gateable?

Toda recomendación que se proponga de acá en adelante (mía o de cualquier sesión futura) debe justificarse explícitamente contra estas cuatro perspectivas, indicando además qué evidencia real del código la respalda (no supuestos).

---

## 5. Los cinco pilares de Ingeniería Inversa Comercial (se mantienen, ahora subordinados al ciclo de decisión)

1. UX/UI — onboarding, navegación, dashboard, visual, accesibilidad. Restricción vigente: sin menú hamburguesa, identidad profesional.
2. Comercial — planes, freemium, pricing, versión Free, conversión a pago.
3. Legal — T&C, privacidad, cookies, uso aceptable, facturación, propiedad intelectual (redactado propio, inspirado en plataformas maduras).
4. Operativa — secuencia real de trabajo del comercio (qué hace primero, dónde se traba, qué busca).
5. Neurocomercio Computacional — el sello propio: perspectiva 3 del framework de la sección 4, aplicada de forma transversal a los otros cuatro pilares.

---

## 6. Los cuadrantes del Command Center (vigentes, reinterpretados por el ciclo de decisión)

| Motor | Pregunta del ciclo que resuelve primero | Contenido |
|---|---|---|
| Estado | ¿Qué está pasando? | KPIs, Timeline, Radar, Wallet, estado económico por zona |
| Ejecución | ¿Qué debería hacer ahora? (parte operativa) | Solicitudes, Presupuestos, Kanban, Alertas, Agenda |
| Inteligencia | ¿Por qué está pasando? + ¿Qué debería hacer ahora? + ¿Qué resultado puedo esperar? | Pricing (Aladdín), predicciones, zonas calientes, explicabilidad, proyección de resultado |
| Administración | (soporte, no responde al ciclo directamente) | Perfil, Equipo, Roles, Publicidad, Suscripción |

Nota: la pregunta 4 del ciclo ("qué resultado puedo esperar") hoy no está resuelta por ningún módulo existente — es el gap más importante detectado en esta versión, candidato natural para la próxima expansión de Inteligencia.

---

## 7. Orden de prioridad de construcción (vigente, sin cambios respecto a v1.1)

1º Command Center / Escritorio (motor Estado) — usa MerchantProjection + ZoneState, ya evidenciados.
2º Centro de Operaciones (motor Ejecución) — usa Quote.js/AuctionOutcome.js, ya evidenciados.
3º Inteligencia Comercial (motor Inteligencia) — usa Pricing Engine v1, ya evidenciado.
4º Administración — último, salvo bloqueo operativo real.

---

## 8. Estado heredado (no tocar sin evidencia — Discovery Pass obligatorio antes de cualquier UI nueva)

- SOC V2: Capas 1-4 completas, frozen/stable. Capa 5 (Jurisprudencia) pendiente, sin fecha.
- Pricing Engine v1: ZoneState + AuctionOutcome + EconomicGraphProjection. Trust queda fuera por ser efímero (decisión julio 2026).
- MerchantProjection: existe, es BI de dashboard, NO fuente de pricing.
- Quotes domain: completo end-to-end, validado en producción.
- Auth/tokens: pendiente técnico abierto, corre en paralelo, no bloquea esta fase.

---

## 9. Próximo paso concreto

Discovery Pass sobre la superficie comercial existente antes de diseñar una sola pantalla:
- Frontend del comerciante (pantallas/rutas ya existentes)
- routes/ disponibles
- MerchantProjection en detalle (schema real, no supuesto)
- Endpoints ya expuestos del Pricing Engine
- Eventos SINAPSIS disponibles para alimentar el Escritorio sin crear nada nuevo

Ninguna propuesta de pantalla se acepta sin haber corrido este relevamiento primero.
