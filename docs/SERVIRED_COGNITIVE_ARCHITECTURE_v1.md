# ServiRed — Cognitive Architecture v1

## Hipotesis consolidada

ServiRed no implementa computacion neuromorfica fisica.
Implementa una Arquitectura Cognitiva Neuromorfica Inspirada.

La unidad fundamental del sistema deja de ser la transaccion y pasa a ser
el Synaptic Atom (Atomo Sinaptico): un evento inmutable que contiene
Percepcion, Validacion DIXIE, Sintesis de patron, Persistencia SINAPSIS
e Impacto plastico.

## Componentes fijados

Nodo-C — Unidad cognitiva territorial
  - Percibir seniales
  - Filtrar localmente
  - Sintetizar patrones
  - Actuar
  - Generar nuevos eventos

DIXIE — Capa inmunologica/deterministica
  - Identidad, Permisos, Invariantes, Integridad, Rechazo de ruido
  - Principio: La inteligencia puede adaptarse; la integridad no puede negociarse.

SINAPSIS — Sistema nervioso del ecosistema
  - Event Store append-only
  - Trazabilidad, Memoria episodica, Proyecciones, Reconstruccion historica

GIA — Corteza de interpretacion
  - Detectar oportunidades
  - Interpretar patrones
  - Recomendar acciones
  - Mantener trazabilidad humana

## Decisiones tecnicas adoptadas

1. Synaptic Atom — estructura canonica
   Contiene: evento original, validacion DIXIE, evidencia, sintesis,
   confianza, hash, previous_hash, impacto plastico, DCE score.

2. Orden correcto del ciclo
   Evento -> Validacion -> Sellado en memoria -> Aprendizaje/plasticidad
   La memoria precede a la adaptacion. Nunca al reves.

3. Plasticidad economica
   Decaimiento asimetrico:
   - Alta confianza -> perdida lenta
   - Bajo desempeno -> perdida rapida
   Factores: confianza historica, calidad, actividad, respuesta, contexto.

4. DCE — Metrica nativa (Densidad Cognitiva del Evento)
   DCE = (ValorEconomico + AprendizajeIncorporado) / (BytesTransferidos + Energia + CostoOperativo)
   Objetivo: mas inteligencia por unidad de informacion movida.

## Posicionamiento en el espectro tecnologico

  Nivel 1: Software tradicional (CRUD, APIs)
  Nivel 2: Arquitecturas event-driven (Kafka, EventStore)
  Nivel 3: Sistemas cognitivos distribuidos -- ServiRed SR-NEURO
  Nivel 4: Computacion neuroformica fisica (Intel Loihi, SpiNNaker)

## Analogia biologica

  Membrana          -> DIXIE
  Potencial de accion -> Evento
  Sinapsis          -> Relaciones entre eventos
  Memoria           -> Event Store
  Plasticidad       -> Pesos adaptativos
  Sistema nervioso  -> SINAPSIS
  Corteza           -> GIA

Version: 1.0 | ServiRed MOS | Arquitectura Cognitiva
