# SR-NEURO-005 -- Synaptic Atom Contract v1

## Proposito

Este documento es la interfaz de arquitectura entre el modelo conceptual
SR-NEURO y los modulos existentes de ServiRed.

Sin este contrato, cualquier patch sobre sinapsisBusAdapter, marketFieldEngine
o giaRouter tiene riesgo de acoplamiento accidental.

Criterios de aceptacion:
  1. Ownership de escritura: un campo, un propietario
  2. Inmutabilidad vs evolucion: capa historica vs capa evolutiva
  3. Maquina de estados con responsables explicitos
  4. Regla de no contaminacion cognitiva

---

## 1. Ownership de escritura

Un campo tiene un unico propietario de escritura.
Ningun otro modulo puede escribir ese campo.

Campo                  Escritor                  Momento
--------               --------                  -------
atomId                 SINAPSIS                  Persistencia
eventType              Producer                  Percepcion
timestamp              Producer                  Percepcion
payload                Producer                  Evento inicial
correlationId          Producer                  Percepcion
causationId            Producer                  Percepcion
dixie.status           DIXIE                     Validacion
dixie.checks           DIXIE                     Validacion
dixie.policy_id        DIXIE                     Validacion
dixie.risk_score       DIXIE                     Validacion
synthesis.pattern      Nodo-C / MarketField      Sintesis
synthesis.evidence     Nodo-C / MarketField      Sintesis
confidence             Nodo-C / MarketField      Sintesis
memory.sequence        SINAPSIS                  Persistencia
memory.hash            SINAPSIS                  Persistencia
memory.previousHash    SINAPSIS                  Persistencia
memory.sealedAt        SINAPSIS                  Persistencia
dce.score              DCE Engine                Evaluacion post-acto
plasticity.delta       Plasticity Engine         Post-resolucion
plasticity.applied     Plasticity Engine         Post-resolucion
state                  Maquina de estados        Cada transicion

---

## 2. Estructura del Synaptic Atom

Capa historica (inmutable una vez sellada):

  atomId             string (uuid generado por SINAPSIS)
  eventType          string
  timestamp          ISO8601 (del evento original)
  payload            object (del Producer, sin modificacion)
  correlationId      string | null
  causationId        string | null (eventId que lo origino)

  dixie:
    status           APPROVED | REJECTED | ESCALATED
    checks           string[]  (lista de validaciones aplicadas)
    policy_id        string | null
    risk_score       float 0-1

  memory:
    sequence         integer (atomico, sin race condition)
    hash             string  (SHA-256 del atomo completo)
    previousHash     string  (hash del atomo anterior en la cadena)
    sealedAt         ISO8601 string explicito (para reproducibilidad del hash)

Capa evolutiva (solo mediante eventos derivados, nunca mutacion destructiva):

  synthesis:
    pattern          string | null  (ej: territorial_shortage, demand_spike)
    evidence         object | null  (datos que soportan el patron)

  confidence         float 0-1 | null

  dce:
    score            float | null  (calculado post-acto)
    value_generated  float | null  (ARS)
    cost_incurred    float | null  (ms * recursos)

  plasticity:
    delta            object | null  (cambios de peso por actor)
    applied          boolean
    learning_events  string[]  (eventIds de los eventos de aprendizaje)

  state              PERCEIVED | VALIDATED | SYNTHESIZED | PERSISTED |
                     INFERRED | ACTED | LEARNED | REJECTED

---

## 3. Inmutabilidad vs Evolucion

Principio: la memoria permanece historica.
El atomo no se modifica. El aprendizaje genera eventos derivados.

Incorrecto (mutacion destructiva):
  Atomo original -> confidence: 0.70 -> confianza: 0.92

Correcto (event sourcing preservado):
  Atomo original (immutable)
    +
  SynthesisUpdated { atomId, confidence: 0.92, pattern: ... }
    +
  DCECalculated    { atomId, score: 0.87, value_generated: ... }
    +
  LearningApplied  { atomId, delta: { workerWeight: +0.08 } }

La capa evolutiva del atomo es una proyeccion derivada de esos eventos.
No una modificacion del documento original.

---

## 4. Maquina de estados con responsables

Estado          Transicion disparada por        Condicion
-------         -----------------------         ---------
PERCEIVED       Producer emite evento           Evento valido estructuralmente
VALIDATED       DIXIE evalua                    dixie.status = APPROVED | REJECTED
SYNTHESIZED     Nodo-C / MarketField sintetiza  confidence y synthesis escritos
PERSISTED       SINAPSIS sella                  hash chain computado y guardado
INFERRED        GIA interpreta el atomo         recommendation generada
ACTED           Actor economico actua           JobCreated | PedidoAceptado
LEARNED         Plasticity Engine ajusta        JobCompleted + RatingReceived
REJECTED        DIXIE deniega                   dixie.status = REJECTED

Regla de transicion: un estado solo avanza, nunca retrocede.
Si DIXIE rechaza en VALIDATED, el atomo queda en REJECTED sin continuar.

---

## 5. Regla de no contaminacion cognitiva

Un evento bruto no debe llegar a GIA sin pasar por sintesis.

Flujo permitido:
  Raw Event
      |
  DIXIE (valida)
      |
  Nodo-C (sintetiza)
      |
  Synaptic Atom -> SINAPSIS (sella)
      |
  GIA (interpreta el atomo, no el evento bruto)
      |
  Accion recomendada

Flujo prohibido (paradigma actual a superar):
  MongoDB query directa
      |
  GIA interpreta
      |
  Accion

Por que es importante:
  GIA no debe construir inteligencia sobre datos crudos relacionales.
  Debe interpretar atomos que ya tienen: validacion, sintesis y confianza.
  Eso garantiza que la inferencia parte de evidencia curada, no de
  consultas sin contexto cognitivo.

---

## 6. Modulos existentes y su rol en el contrato

Modulo                         Rol SR-NEURO              Estado
------                         -----------               ------
sinapsisBusAdapter.js          SINAPSIS (memoria)        Existente -- extender schema
logManagerV2.js                SINAPSIS (gobernanza)     Existente -- sin cambios
dixie.js + dixieRuntime.js     DIXIE (validacion)        Existente -- conectar al flujo
marketFieldEngine.js           Nodo-C (sintesis)         Existente -- agregar emision al bus
priorityEngine.js              GIA (inferencia)          Existente -- sin cambios en logica
giaController.js               GIA (consumidor)          Modificar -- consumir atomos vs query
giaRouterContract.js           DIXIE cognitivo           Existente -- sin cambios
DCE Engine                     DCE (metrica)             A crear
Plasticity Engine              Plasticidad               A crear (sobre TrustScore existente)

---

## 7. Secuencia de implementacion recomendada

El orden preserva estabilidad de produccion en cada paso.

Paso 1 -- Extender schema del bus (Nivel 2)
  Agregar a sinapsisBusAdapter.js:
  confidence, synthesis, dce, plasticity como campos opcionales
  Los eventos existentes no se rompen (campos opcionales con default null)

Paso 2 -- Primer Synaptic Atom real (Nivel 2)
  Flujo candidato: ServiceRequestCreated -> MarketField -> Bus
  marketFieldEngine emite DemandSignalSynthesized al bus
  con confidence y synthesis poblados

Paso 3 -- Conectar GIA al bus (Nivel 2)
  giaController consulta el ultimo atomo relevante del bus
  en vez de query directa a colecciones
  priorityEngine permanece sin cambios (funcion pura)

Paso 4 -- DCE Engine (Nivel 2)
  Funcion pura que calcula dce.score sobre un atomo resuelto
  Se agrega como post-hook de JobCompleted

Paso 5 -- Plasticidad temporal (Nivel 2)
  Extiende TrustScore existente con decaimiento temporal
  Conecta con el delta del Synaptic Atom

Cada paso tiene rollback natural: los campos son opcionales
y los modulos existentes siguen funcionando sin ellos.

---

SR-NEURO-005 | v1.0 | ServiRed MOS | Synaptic Atom Contract
