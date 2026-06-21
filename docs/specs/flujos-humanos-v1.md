# ServiRed OS — Flujos Humanos v1 (Capa 2: Civilizacion)

status: ARTEFACTO OPERATIVO VIGENTE
version: 1.0
date: 2026-06-20
depende_de: docs/specs/roadmap-fases.md (Capa 1: Constitucion)

---

## Marco

Capa 1 (Constitucion) ya esta resuelta: Event Store, Sync Engine,
MaterialReservation, idempotencia, gobernanza. Este documento NO agrega
mas constitucion. Describe la Capa 2: que hace una persona real cuando
abre ServiRed, en lenguaje de producto, no de arquitectura.

El usuario no ve MaterialReservationAggregate. Ve "Reservar Material".
No ve ZoneProjection. Ve "Mi Zona". No ve NodeEnteredZone. Ve
"Hay trabajo cerca tuyo".

## Filosofia del pulgar

- Zona Caliente (abajo/centro): accion critica (Solicitar, Aceptar, Escanear/Confirmar)
- Zona Neutra (centro/arriba): contexto territorial (mapa, radar, tendencias)
- Zona Fria (esquinas superiores): configuracion, perfil, historial profundo

## Estructura del Menu del Pulgar (3 botones + barra fija)

Rol        | Boton izquierdo (metricas)         | Boton central (accion critica)          | Boton derecho (gestion)
Cliente    | Mi Zona (DPI, actividad local)      | Solicitar / Capturar (foto o voz)        | Mis Pedidos (estado)
Trabajador | Oportunidades (radar de trabajos)   | Escanear / Confirmar (cierre en calle)   | Mi Bolsillo (ingresos, materiales, agenda)
Comercio   | Tendencias (que se pide en la zona) | Despachar Reserva (entrega rapida)       | Mi Stock (catalogo, promociones)

Nota tecnica: se implementa en HTML/CSS/JS vanilla, NO React ni React
Native (ver ux-constitution-v1.2.md). Cualquier pseudocodigo JSX de
sesiones anteriores debe traducirse antes de tocar codigo real.

## Flujo 1 — Cliente (disparador del evento)

Abrir App -> Solicitar (foto o voz) -> Claude Vision clasifica [Fase 2,
pendiente] -> Tarjeta: categoria + precio estimado territorial ->
Confirmar -> Sistema calcula DPI de zona -> Trabajadores reciben
oportunidad -> Asignacion -> Reserva de materiales [Fase 4, YA
implementada] -> Seguimiento en tiempo real -> Calificacion

## Flujo 2 — Trabajador (motor del servicio)

Abrir App -> Ve "Oportunidades Cerca" (radar territorial, NEXUS scoring)
-> Acepta -> Reserva automatica de materiales en comercio cercano con
stock -> Notificacion al comercio -> Retiro -> Ejecucion -> Confirma
cierre (idempotente) -> Cobra -> Sube reputacion territorial

## Flujo 3 — Comercio (nodo de soporte)

Abrir App -> Ve "Tendencias" (que materiales se piden en su zona) ->
Indexa stock -> Recibe alerta de reserva entrante -> Prepara pedido ->
Trabajador llega -> Confirma entrega (idempotente, sin doble gasto) ->
Pago automatico -> Ve metricas del dia

## Agrupacion funcional

Grupo Cliente: Solicitar, Reservar, Seguir pedido, Calificar
Grupo Trabajador: Oportunidades, Materiales, Agenda, Ingresos
Grupo Comercio: Stock, Reservas, Promociones, Metricas
Grupo Territorial (compartido): Mi Zona, Actividad, Tendencias, Economia local

## Mapeo contra roadmap-fases.md (que falta construir)

- Componente de captura camara/voz -> localCommandQueue.js (Fase 1, pendiente)
- Handler backend: comando sincronizado -> Claude Vision -> tarjeta
  categoria + precio (Fase 2, pendiente)
- UI del Navigation Dock por rol, vanilla JS, mutando segun contexto
  (ya decidido: navegacion por contexto, no por rol)

## Fuera de alcance de v1.0

- Narrativas de marketing extendidas (utiles para discurso comercial,
  no como especificacion tecnica)
- Mockups visuales
