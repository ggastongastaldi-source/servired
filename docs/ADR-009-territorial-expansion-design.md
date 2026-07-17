# ADR-009: Diseño de la Expansión Territorial — Extensión de BCs Existentes

**Fecha:** 2025-07
**Estado:** Aprobado
**Relacionado con:** ADR-008 (Expansión Territorial BC), Constitución Expansión v1.0

---

## Contexto

El ADR-008 estableció la Doctrina de Expansión Territorial como capacidad
estructural del SEOT y propuso un BC `territorial-development`.

Tras auditar el repositorio real, se encontró que cinco BCs ya existen en
`bounded-contexts/` con patrones maduros, y que dos de ellos ya modelan
conceptos directamente relacionados con la expansión territorial:

- `economic-identity`: EconomicActor (participante verificado dentro del sistema)
- `territorial-intelligence`: TerritorialSnapshot (inteligencia territorial por zona)

Crear un BC nuevo habría duplicado responsabilidades ya asignadas.

---

## Decisión

La Doctrina de Expansión Territorial se implementa como **extensión de BCs
existentes**, no como un BC nuevo:

### 1. ProspectActor → economic-identity BC

**Problema:** EconomicActor modela a un participante YA dentro del ecosistema.
La Doctrina necesita modelar el camino ANTES de entrar.

**Solución:** Nuevo agregado `ProspectActor` en el mismo BC.

| Concepto | Dónde vive | Qué modela |
|----------|-----------|------------|
| EconomicActor | economic-identity | Actor verificado DENTRO del ecosistema |
| ProspectActor | economic-identity | Candidato AÚN FUERA, en incorporación |

FSM: `DISCOVERED → CONTACTED → EDUCATED → ACTIVATED`

Al `ACTIVATED`, emite `ProspectActorActivated` (integration event) que
dispara el use case `RegisterEconomicActor` existente, convirtiendo el
prospect en un EconomicActor real.

### 2. TerritoryDevelopment → territorial-intelligence BC

**Problema:** TerritorialSnapshot modela inteligencia (señales, ZoneHealth).
La Doctrina necesita modelar el ciclo de madurez del territorio.

**Solución:** Nuevo agregado `TerritoryDevelopment` en el mismo BC.

| Concepto | Responsabilidad |
|----------|----------------|
| TerritorialSnapshot | INTELIGENCIA: observa señales, calcula ZoneHealth |
| TerritoryDevelopment | DESARROLLO: ciclo de madurez del territorio |

FSM: `IDENTIFIED → MAPPED → ACTIVE → CONSOLIDATED → SCALABLE`

TerritoryDevelopment PRODUCE señales que TerritorialSnapshot CONSUME.

### 3. shared/domain/StateMachine.js

Utilidad base para FSMs del dominio. Elimina la duplicación de lógica de
transición que existe en CycleStatus, VerificationStatus y ZoneHealth.
Los nuevos Value Objects ProspectStatus y TerritoryStatus la usan desde el
inicio. Los existentes pueden migrar gradualmente.

### 4. eventTaxonomy.js — eventos nuevos

Se agregan al registro canónico los eventos de expansión territorial.

---

## Consecuencias

**Positivas:**
- Sin duplicación de responsabilidades entre BCs
- ProspectActor y EconomicActor son conceptos distintos con ciclos distintos
- TerritoryDevelopment y TerritorialSnapshot son dos lentes sobre el mismo territorio
- StateMachine base reduce deuda técnica de FSMs duplicadas
- El patrón AggregateRoot / _recordEvent / _applyEvent / _rehydrate se mantiene uniforme

**Negativas / Riesgos:**
- economic-identity BC ahora tiene dos agregados (EconomicActor + ProspectActor)
  → Mitigación: son responsabilidades del mismo BC (identidad económica)
- La integración ProspectActivated → RegisterEconomicActor requiere un
  handler/reactor que aún no existe → implementar en Fase Beta

---

## Alternativa descartada

Crear `bounded-contexts/territorial-development/` como BC independiente.

Razón del descarte: hubiera duplicado EconomicActor (que ya existe en
economic-identity) y TerritorialSnapshot (que ya existe en
territorial-intelligence), generando la deuda técnica que se buscaba evitar.
