# ENGINEERING ServiRed — Convenciones de desarrollo
Ultima revision: 2026-07-05

Este documento cambia con el tiempo (a diferencia de CONSTITUCION.md).
Ac谩 van herramientas, comandos y practicas concretas del entorno actual.

## Entorno de trabajo

- Desarrollo exclusivamente en Termux (Android), editor Acode.
- Nunca usar /tmp/ (permission denied en sandboxing de Android). Usar
  siempre ~/ o la raiz del proyecto.
- termux-wake-lock activado para evitar que Android mate procesos Node
  en background.

## Practicas de edicion de codigo

- python3 heredoc + str.replace() para parches quirurgicos en archivos.
  No usar sed para strings complejos.
- Sin fences de triple backtick dentro de heredocs: cuelga el paste en
  Termux.
- node --check obligatorio antes de cada commit.
- Discovery Pass (grep-first, sin asunciones) obligatorio antes de
  escribir codigo nuevo.
- Alcance minimo por cambio: no mezclar refactors de bounded contexts
  distintos en un mismo commit.

## Infraestructura actual

- Deploy: Render free tier (https://servired-6e5r.onrender.com).
  Spin-down por inactividad (50s+ de delay al despertar). Se recomienda
  cron externo cada 14 min para evitar el spin-down.
- Base de datos: MongoDB Atlas, cluster cluster0.fjqkqhf.
- Variable de entorno de Mongo: MONGO_URI (no MONGODB_URI).
- Repo canonico: https://github.com/ggastongastaldi-source/servired.git
  (NO usar Gastaldog/servired).

## Estructura de carpetas

server.js, routes/, models/, controllers/, middleware/, public/
(index.html + style.css), services/, seeds/, globuloRojo/, config/,
railway.json, push.sh, src/core/ (ex src/old_structure/).

## Cierre de sesion (obligatorio)

Toda sesion de trabajo termina con:
git add -A && git commit -m "..." && git push

## Notas de seguridad pendientes

- Credenciales hardcodeadas en utils/assertSystemUsers.js: item diferido
  a rotar en un milestone futuro (decision consciente para no
  interrumpir el desarrollo).
- Verificar integridad del paquete dotenv (se detecto una referencia
  sospechosa a vestauth.com en vez de dotenvx.com oficial) — pendiente
  de confirmar resuelto.
