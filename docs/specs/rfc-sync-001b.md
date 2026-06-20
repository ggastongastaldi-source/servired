# RFC-SYNC-001B — Idempotencia y Reconciliacion Offline-First

status: DRAFT
version: 1.0
date: 2026-06-19
depends_on: docs/specs/rfc-ux-002-sync-engine.md
supersedes: RFC-AUTH-001 (cancelado - identidad ya resuelta, ver abajo)

---

## Identidad (resuelto, congelado)

actorId = req.user.userId (Usuario._id, validado por JWT existente -
middleware/auth.js). NUNCA actorId = body.userId.

No se requiere Google OAuth ni nuevo sistema de autenticacion. El JWT
existente ya entrega un actorId estable, independiente del dispositivo.

## Nota de seguridad detectada (fuera de alcance, auditar despues)

POST /push-subscribe acepta userId desde req.body en vez de extraerlo del
JWT. Inofensivo para push, pero ese patron NUNCA debe replicarse en
endpoints economicos.

## Ajuste de diseno: clientSequence

clientSequence es monotono por (actorId, deviceId), NO por actorId solo.
Un mismo actor en 2 dispositivos genera 2 secuencias independientes.

El orden causal real entre dispositivos distintos del mismo actor lo da
createdAt + idempotencia por commandId. Conflictos reales entre
dispositivos (ej. doble reserva del mismo material) los resuelve la
logica de negocio en Dixie Gate, no este RFC.

deviceId: generado client-side una vez, persistido en IndexedDB junto a
la cola (no existe todavia en localCommandQueue.js - pendiente).

## Idempotency Registry - contrato

Coleccion: idempotency_registry

Campos:
  - commandId: string, unique, indexed
  - actorId: ObjectId, indexed
  - deviceId: string
  - clientSequence: number
  - commandType: string
  - status: processed o rejected
  - eventId: ObjectId o null
  - processedAt: Date

Regla: antes de procesar cualquier comando, el servidor busca commandId
en este registro. Si existe, devuelve el resultado ya guardado sin
reejecutar ningun efecto.

## Contrato de respuesta (ACK)

  200 primera vez:     ok=true, eventId, status=processed
  200 duplicado:       ok=true, eventId, status=already_processed
  409 out of order:    ok=false, error=out_of_order, expectedSequence
  401 token invalido:  ok=false, error=invalid_token

## Problemas que resuelve este RFC

1. commandId global (ya existe - localCommandQueue.js, RFC-UX-002)
2. idempotency_registry - nuevo, lado servidor
3. deduplicacion
4. reconciliacion offline-first
5. clientSequence por actor y dispositivo
6. ACK de sincronizacion
7. recuperacion tras caida (servidor)

## Fuera de alcance de v1.0

- Orden causal estricto cross-device (ver ajuste arriba)
- Reconciliacion semantica de negocio (logica de Dixie Gate)
- Auditoria del patron body.userId en /push-subscribe
