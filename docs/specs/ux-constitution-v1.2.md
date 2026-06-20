# ServiRed UX Constitution v1.2

status: APPROVED
version: 1.2
date: 2026-06-19
supersedes: none

---

## Decisión arquitectónica

Plataforma cliente oficial: **PWA HTML/CSS/JS** (no React Native).

Esta decisión separa dos cosas que no deben mezclarse:
- **Principios de producto** (thumb-first, offline-first, optimistic UI,
  comando→evento, la UI no decide verdad) — son independientes del framework.
- **Elección de plataforma cliente** — hoy es PWA, porque ya existe, ya
  despliega, y mantiene continuidad con la filosofía de simplicidad
  auditable de ServiRed OS.

## Tabla de equivalencia (documento original RN → stack actual)

| Documento original (RN)     | Equivalente PWA              |
|------------------------------|-------------------------------|
| React Native Component Tree | Módulos JS + vistas HTML      |
| SQLite local                 | IndexedDB                     |
| State Store                  | Store JS / Event Bus          |
| Local Commands Queue         | Cola en IndexedDB             |
| Offline Sync Engine          | Service Worker + Sync         |
| Optimistic UI                | DOM update inmediata          |
| Event Replay                 | Replay desde IndexedDB        |
| Mobile Navigation             | Router JS / PWA                |

## Invariantes (heredadas del documento original, sin cambios)

- Persistencia local: IndexedDB.
- Sin dependencia obligatoria de React Native ni SQLite.
- Thumb-first obligatorio.
- Offline-first obligatorio.
- Optimistic UI obligatoria.
- Command → Event → Projection obligatorio.
- La UI nunca es fuente de verdad.
- Event sourcing del backend permanece inalterado.

## Cláusula de futuro

Una futura aplicación React Native podrá implementarse como cliente
alternativo de ServiRed OS, consumiendo los mismos contratos de API y
eventos — pero no reemplaza ni condiciona la evolución de la PWA actual.
Requiere RFC propio que justifique el problema que la PWA no resuelve.

## Roadmap de implementación (orden de dependencia)

1. Local Event Store + Command Queue (IndexedDB) — fundación, todo lo demás depende de esto
2. Sync Engine (detección de conectividad, reenvío, ACK, backoff, idempotencia)
3. Worker Home (Capítulo I del documento original)
4. Commerce Home (Capítulo II)
5. Replay UI (cola local visible, forzar sync, reconciliación)
6. Casos borde + estrategia de testing + riesgos operacionales
