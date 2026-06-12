# BUS-EVOLUTION-001

**Estado:** Abierto — no bloqueante. Evaluar en Sprint 4/5.

## Resumen

Sprint 2 representa `role_changed`, `support_opened` y `open_profile`
como `event_type: shell_opened` + `payload.action`, para no modificar
el catálogo congelado de `EVENT_TYPES` (Sprint 1).

## Problema a futuro

Cuando SINAPSIS necesite responder preguntas analíticas como:

> "¿Cuántos cambios de rol hubo en La Matanza este mes?"

con el modelo actual hay que escanear `payload.action` dentro de todos
los eventos `shell_opened`, en lugar de filtrar directamente por
`event_type`.

## Acciones candidatas a promoción

- `change_role` -> `role_changed`
- `open_support` -> `support_opened`
- `open_profile` -> `profile_opened`

`open_wallet` ya tiene su propio `event_type` (`wallet_opened`) desde
Sprint 1 y no requiere cambios.

## Costo de la migración (cuando se decida hacer)

1. Agregar los nuevos valores al enum `event_type` en `event.schema.json`.
2. Agregar las constantes correspondientes a `EVENT_TYPES` en `event-types.js`.
3. Actualizar `shell-events.js` para emitir el `event_type` dedicado
   en lugar de `shell_opened` + `payload.action`.
4. Los eventos `shell_opened` históricos con esos `payload.action`
   quedan como están (los eventos son inmutables) — los lectores
   (SINAPSIS, dashboards) deben soportar ambas formas si necesitan
   leer historial pre-migración.

## Decisión

No actuar ahora. Revisar cuando SINAPSIS empiece a consumir eventos
del Shell en queries analíticas reales.
