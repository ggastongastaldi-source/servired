# RFC-SYNC-001B — Idempotencia y Reconciliacion Offline-First

status: DRAFT
version: 1.1
date: 2026-06-20
depends_on: docs/specs/rfc-ux-002-sync-engine.md
supersedes: RFC-AUTH-001 (cancelado - identidad ya resuelta, ver abajo)

---

## Identidad (resuelto, congelado)

actorId = req.user.userId (Usuario._id, validado por JWT existente -
middleware/auth.js). NUNCA actorId = body.userId.

## Nota de seguridad detectada (fuera de alcance, auditar despues)

POST /push-subscribe acepta userId desde req.body en vez de extraerlo del
JWT. Inofensivo para push, pero ese patron NUNCA debe replicarse en
endpoints economicos.

## Ajuste de diseno: clientSequence

clientSequence es monotono por (actorId, deviceId), NO por actorId solo.
El orden causal real entre dispositivos distintos lo da createdAt +
idempotencia por commandId. Conflictos reales los resuelve Dixie Gate.

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
  - expireAt: Date (processedAt + 30 dias)

## TTL del registro (v1.1, agregado - no existia en v1.0)

expireAt = processedAt + 30 dias. Indice TTL sobre expireAt con
expireAfterSeconds=0. Justificacion: un dispositivo offline por semanas
debe poder reconciliar sin perder proteccion de idempotencia; 30 dias
cubre ese caso sin crecer la coleccion indefinidamente.

## ACK vs status persistido (v1.1, distincion explicita)

Son dos conceptos distintos, no confundir:

IdempotencyRecord.status (persistido en Mongo): solo processed o
rejected. Es el resultado real de procesar el comando, una sola vez.

ACK.status (campo de la respuesta HTTP, nunca persistido):
processed o already_processed o un error explicito. already_processed
es un valor CALCULADO al momento de responder, cuando se encuentra un
registro existente con status=processed - el registro en Mongo sigue
diciendo processed, nunca se escribe already_processed a disco.

Regla: si aparece codigo que intente escribir
IdempotencyRecord.status = already_processed, es un bug.

## Contrato de respuesta (ACK)

  200 primera vez:     ok=true, eventId, status=processed
  200 duplicado:       ok=true, eventId, status=already_processed
  409 out of order:    ok=false, error=out_of_order, expectedSequence
  401 token invalido:  ok=false, error=invalid_token

## Fuera de alcance de v1.1

- Orden causal estricto cross-device
- Reconciliacion semantica de negocio (logica de Dixie Gate)
- Auditoria del patron body.userId en /push-subscribe
- UX de registro con Google (decision de producto, no de arquitectura)
