# ADR-001: Principios Fundacionales de ServiRed

**Estado:** Aceptado  
**Fecha:** 2026-06-06  
**Autores:** Gastón Gastaldi

## Contexto

ServiRed es un marketplace de servicios del hogar para Argentina (AMBA, expansión nacional).
El sistema combina cálculo determinístico de precios con inferencia de lenguaje natural vía Groq.
Esta ADR establece los límites arquitectónicos que no pueden violarse.

## Decisiones

### 1. Separación estricta: Groq interpreta, Aladdín calcula

- **Aladdín** es el motor de precios. Opera sobre datos estructurados (catálogo, zona, complejidad).
  No depende de ninguna API externa. No infiere lenguaje natural. Es determinístico y testeable offline.
- **Groq** es el motor de inferencia. Interpreta lenguaje natural, rankea candidatos, genera mensajes.
  No calcula precios. No accede al catálogo directamente. Recibe contexto ya procesado por Aladdín.

### 2. Event Store desacoplado

El Event Store define una interfaz (`IEventStore`) implementada por:
- `MongoEventStore` — persistencia productiva en MongoDB Atlas
- `MemoryEventStore` — solo para testing, nunca en producción

El código de negocio depende de la interfaz, no de la implementación.

### 3. Persistencia productiva

MongoDB Atlas es la única base de datos productiva.
PostgreSQL y Redis son opcionales y el sistema debe operar en modo degradado si no están disponibles.

### 4. Timezone

Toda lógica de tiempo usa `process.env.BUSINESS_TIMEZONE` (default: `America/Argentina/Buenos_Aires`).
Nunca hardcodear offsets UTC.

### 5. Documentación vs implementación

Los conceptos GIA, DIXIE y SINAPSIS existen únicamente en `docs/vision/` como patrones arquitectónicos.
No existen carpetas `src/gia`, `src/dixie` ni `src/sinapsis` en el árbol de producción.

## Consecuencias

- Aladdín puede testearse sin red, sin API keys, sin base de datos.
- Groq puede reemplazarse por otro LLM sin tocar la lógica de precios.
- El Event Store puede migrarse a otro backend sin cambiar el código de negocio.
