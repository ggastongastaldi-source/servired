# SR-NEURO-001 — Reference Event Flow Specification

## Caso de referencia: Deteccion preventiva de falta de oferta territorial

Estado inicial:
  Zona: Oeste AMBA | Categoria: Electricidad
  Demanda promedio historica: 120 solicitudes/semana
  Oferta activa: 45 trabajadores | Conversion: 82%

## Ciclo cognitivo completo

1. Percepcion — senial entrante
   type: ServiceRequestCreated | category: electricity | territory: oeste
   Estado: senial cruda. No es inteligencia todavia.

2. Nodo-C — analisis de ventana temporal
   window = ultimos 7 dias
   current_demand = 310 solicitudes | baseline = 120 | incremento = +158%

3. Sintesis de patron — spike neuronal
   type: DemandSpikeDetected | territory: oeste | category: electricity
   confidence: 0.93 | evidence: increase=1.58, window=7d

4. DIXIE — validacion
   Checks: identidad del nodo, firma del evento, territorio valido,
           categoria existente, confianza superior al umbral
   Resultado: APPROVED

5. SINAPSIS — persistencia
   Event ID: SRN-82931 | Hash: a82f91... | Previous: 91bc22...

6. GIA — inferencia
   Pregunta: Que accion genera mayor valor territorial?
   Respuesta: Deficit temporal de oferta electrica detectado.
   Acciones: activar trabajadores con peso sinaptico alto,
             sugerir Boost comercial, generar campana preventiva.

7. Plasticidad — aprendizaje post-resolucion
   Eventos: JobCompleted + RatingReceived + PaymentSettled
   WorkerWeight +8% | TerritoryAffinity +5% | ResponseScore +3%

## Ciclo canonico

  SENAL -> VALIDACION -> PATRON -> EVENTO -> MEMORIA -> INFERENCIA -> ACCION -> APRENDIZAJE

  Este ciclo es el equivalente software de un arco reflejo biologico.

## Esquema Synaptic Atom

  atomId: string (uuid)
  eventType: string
  territory: string
  category: string
  timestamp: ISO8601
  dixie:
    status: APPROVED | REJECTED
    checks: [identity, signature, territory, category, confidence]
  evidence:
    raw: {}
    synthesized: {}
    confidence: 0.0
  memory:
    hash: string
    previous_hash: string
    sequence: integer
  plasticity:
    weights_delta: {}
    learning_applied: boolean
    dce_score: float

## Maquina de estados

  PERCEIVED -> VALIDATED -> SYNTHESIZED -> PERSISTED -> INFERRED -> ACTED -> LEARNED
                   |
               REJECTED (DIXIE)

SR-NEURO-001 | v1.0 | ServiRed MOS
