# ServiRed — Estado del Proyecto

## Producción
URL: https://servired-6e5r.onrender.com
Repo: https://github.com/ggastongastaldi-source/servired.git
Stack: Node.js + MongoDB Atlas + Socket.IO + Render (free tier)

## Circuito de conversión (HOME)
- Portal Comercial → registro comercio + QR generado
- Área del Cliente → login cliente / registro cliente
- Portal del Trabajador → login trabajador / registro trabajador

## Trazabilidad QR territorial
1. Comercio se registra → genera QR con URL /?ref=COMERCIO_${id}
2. Worker escanea QR → qr-landing.js guarda ref en sessionStorage
3. Worker se registra → origin_ref viaja al backend
4. Backend guarda worker_origin_ref en perfil del Usuario

## Endpoints commerce
- POST /api/commerce/register → crea comercio + genera QR
- GET /api/commerce/:id/qr → imagen PNG del QR
- GET /api/commerce → lista comercios activos

## Modelo de negocio (capas)
1. Visibilidad gratuita (entrada al sistema via QR)
2. Prioridad paga (ranking en resultados por zona/rubro)
3. Performance (pago por acción: click, visita, orden)

## Próximos pasos
- [ ] Panel del comercio: ver QR propio + workers vinculados + pedidos generados
- [ ] Ranking de comercios en mapa por zona/rubro
- [ ] Sistema de prioridad paga
- [ ] Banner PWA bajo control

## Kernel (backend crítico)
- Health: /api/health (HEALTHY confirmado)
- Event Store: MongoDB colección events con correlationId + sequenceNumber
- Auction Engine: nexus/application/auctionEngine.js
- Watchdog: globuloRojo/watchdog.js (patrol cada 3 min)
- Circuit Breaker: src/sinapsis/dixieTerminal/circuitBreaker.js
