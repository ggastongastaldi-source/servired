# Sprint 3.1 - Eliminacion de endpoint huerfano

## Que se elimino

POST /api/referidos/convertir (src/routes/referidos.js)

## Evidencia

grep -rn "convertir" en todo el repo (excluyendo node_modules/.git)
solo encontro la definicion del endpoint en src/routes/referidos.js
(lineas 23, 25, 35). Cero callers en public/*.html, src/core/routes/auth.js,
ni en ningun otro archivo.

## Por que existia ambiguedad causal

Habia dos productores potenciales del mismo efecto de negocio
(Referido.stats.registros / clientes / workers):

- Camino A (real, en uso): registrarOrigenAtribucion() dentro de
  src/core/routes/auth.js, disparado por POST /api/auth/registro.
- Camino B (muerto): POST /api/referidos/convertir.

Si el Camino B se hubiera conectado mas adelante sin conocer el A,
cada registro habria incrementado las estadisticas dos veces.

## Estado final

Solo queda GET /api/referidos/resolver (incrementa stats.scans).
La atribucion de registros/clientes/workers sigue siendo
responsabilidad exclusiva de registrarOrigenAtribucion() en auth.js.

## Siguiente paso

Sprint 3.2 - reconectar SessionContext.setOriginRef() en qr-landing.js
(actualmente usa sessionStorage.setItem('origin_ref', ref) directo).

---

# Sprint 3.2 - SessionContext reconectado

## Hallazgo adicional

session-context.js (Sprint 2.1) nunca estaba incluido en index.html.
SessionContext era undefined en el navegador.

## Cambios

1. public/index.html: agregado <script src="/js/session-context.js">
   ANTES de qr-landing.js (orden de carga importa: SessionContext
   debe existir en window antes de que qr-landing.js se ejecute).
2. public/js/qr-landing.js: sessionStorage.setItem('origin_ref', ref)
   -> SessionContext.setOriginRef(ref).

## Estado final

origin_ref ahora pasa por el unico punto de entrada centralizado.
correlation_id y last_event (las otras dos claves de SessionContext)
siguen sin productores reales - se conectaran en Sprint 3.3
(qr_scanned / register_completed / lead_attributed).
