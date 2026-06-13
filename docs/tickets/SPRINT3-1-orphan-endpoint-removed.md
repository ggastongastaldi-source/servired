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
