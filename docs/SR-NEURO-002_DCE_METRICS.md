# SR-NEURO-002 — DCE Metrics Specification

## Densidad Cognitiva del Evento (DCE)

Formula:
  DCE = (ValorEconomico + AprendizajeIncorporado) / (BytesTransferidos + Energia + CostoOperativo)

Objetivo: mas inteligencia por unidad de informacion movida.

## Componentes

Numerador (valor generado):
  ValorEconomico       — Transacciones facilitadas, ahorro generado (ARS)
  AprendizajeIncorporado — Mejora de pesos, reduccion de errores futuros (score 0-1)

Denominador (costo incurrido):
  BytesTransferidos    — Payload del evento + metadatos (bytes)
  Energia              — CPU/memoria consumida por el ciclo (ms x cores)
  CostoOperativo       — Latencia, llamadas externas, I/O (ms)

## Umbrales de referencia

  DCE < 0.3      -> Evento ruidoso — candidato a filtrado DIXIE
  DCE 0.3 - 0.6  -> Evento estandar
  DCE 0.6 - 0.9  -> Evento de alto valor
  DCE > 0.9      -> Evento critico — prioridad maxima GIA

## Decaimiento de peso sinaptico

  Alta confianza historica  -> decaimiento lento  (factor: 0.02/semana)
  Bajo desempeno reciente   -> decaimiento rapido (factor: 0.15/semana)
  Inactividad prolongada    -> decaimiento neutro (factor: 0.05/semana)

## Estructura de medicion por nodo

  nodeId: string | territory: string
  dce_average_7d: float | dce_trend: UP|STABLE|DOWN
  events_processed: integer | high_value_ratio: float

## Estructura de medicion por red territorial

  territory: string | network_dce: float
  active_nodes: integer | coordination_efficiency: float
  timestamp: ISO8601

SR-NEURO-002 | v1.0 | ServiRed MOS
