# CONSTITUCION ServiRed — v6 "Organismo Vivo"
Ultima revision de esta seccion: 2026-07-05
Fundador / Ingeniero: Gaston Gabriel Gastaldi

## 1. Identidad del proyecto

Que es: ServiRed es un Market Operating System (MOS), no un ERP ni un
marketplace tradicional. Conecta Comercios, Trabajadores/Providers,
Clientes y Vendors en AMBA con expansion nacional planificada.

Problema que resuelve: fragmentacion entre oferta y demanda de servicios
locales, sin capa de confianza, pricing dinamico ni trazabilidad de eventos.

Vision de largo plazo: infraestructura de inteligencia donde agentes
humanos, modelos de IA y componentes deterministicos colaboran bajo
gobernanza comun para resolver problemas reales de mercado.

Principios que nunca se rompen:
- Backend calcula toda la logica de negocio; frontend solo renderiza estado.
- Event Store como fuente de verdad (SINAPSIS / sinapsis_bus_log).
- Todo cambio debe ser auditable.
- No se agrega feature nueva sin Discovery Pass previo (evidencia de que
  no existe ya algo reusable).
- Aladdin Intelligence es de solo lectura sobre estado territorial: nunca
  fija precios de forma autoritativa.

## 2. Arquitectura

Bounded contexts separados: Auth/Onboarding, SQOP (QR onboarding),
Comercio/Merchant, Trabajador/Provider, Quotes/Auction, Dispatch,
Pricing (marketFieldEngine), SOC (Police-Fiscal-Defensor), Aladdin
Intelligence, GIA (asistente).

Event Store: sinapsis_bus_log es el unico Event Store canonico
(ADR-002). marketing_events es un bus separado para analytics de
negocio, intencionalmente desacoplado.

Proyecciones: MerchantProjection, EconomicGraphProjection,
AuctionOutcomeProjected alimentan lectura/BI, nunca logica de pricing
autoritativa salvo las explicitamente definidas en Pricing Engine v1.

Gobernanza: identityGate (ex DixieGate) + SOC pipeline
(Police-Fiscal-Defensor) como capa de defensa y auditoria.

Offline-first / resiliencia: Render free tier con spin-down; el sistema
debe tolerar reinicios sin perder estado (Event Sourcing + Reconciliator).

Auditoria: ProviderStateReconciliator replica el bus contra Mongo para
detectar drift, persistido en state_drift_events.

## 3. Reglas de desarrollo

- Simplicidad antes que complejidad. No duplicar logica (grep-first,
  Discovery Pass obligatorio antes de escribir codigo nuevo).
- Pensar antes de programar: protocolo de 4 preguntas (trigonometria del
  problema, evidencia de Discovery Pass, es capacidad monetizable,
  no rompe el core).
- Todo cambio debe ser auditable y trazable a un evento SINAPSIS cuando
  corresponda.
- Preferir eventos sobre acoplamiento directo entre bounded contexts.
- Alcance minimo por cambio: no mezclar refactors de distintos bounded
  contexts en un mismo commit.
- Metrica de exito: % del sistema funcionando end-to-end, no cantidad
  de features.

## 4. Conocimiento de negocio

Comercios: alta via QR (SQOP) o registro directo. Estado actual: gap
conocido entre Commerce y Usuario (ver ESTADO.md).
Trabajadores: onboarding con Provider Activation Pipeline, FSM propia,
eventos PROVIDER_ONBOARDING_STARTED / PROVIDER_PROFILE_COMPLETED /
PROVIDER_ACTIVATED. Usuaria de prueba: Debora Rouiller.
Clientes: alta via Google OAuth, FSM de onboarding compartida con
Comercio (needsRoleSelection / needsProfileCompletion).
Reservas / Quotes: DispatchEngine (urgente/commodity) vs Quote/Auction
Engine (complejo) son bounded contexts separados a proposito
(JobClassifier hace el ruteo determinista).
QR: protocolo SQOP con QRCodeCampaign, OnboardingSession con TTL,
tracking de conversion via vendorCommissionReactor (atribucion de
comision a vendor, no lifecycle de Commerce).
Monetizacion: freemium por capacidades, no por pantallas.
Pricing: v1 usa solo señales persistentes (ZoneState, AuctionOutcome,
EconomicGraphProjection). Trust queda fuera de v1 por ser efimero
(TrustDecayReactor en memoria, se resetea con cada spin-down de Render).

## 5. Asistente G.I.A. — limites de decision

Puede: sugerir prioridad comercial visible al merchant (/api/gia/priority),
generar recomendaciones, redactar, resumir, detectar patrones.
Solo puede recomendar (no ejecutar): pricing, ranking, decisiones que
afecten dinero real de un tercero.
Debe escalar a Dixie / identityGate: cualquier accion que modifique
estado protegido, cualquier escritura fuera del whitelist de campos.
Debe recordar en SINAPSIS: decisiones con impacto en el bus de eventos,
nunca datos efimeros de sesion.
Jamas debe inventar: precios, disponibilidad, datos de un usuario que no
esten confirmados en el estado real del sistema.
