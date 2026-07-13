# Centro de Comando — ServiRed MOS

## Principio fundamental

No instrumentar la UI para generar analitica. La fuente unica de verdad es el flujo natural de Domain Events emitidos por el Kernel. Los eventos generan conocimiento. No los dashboards.

## Separacion de responsabilidades

**SINAPSIS:** memoria del sistema, contexto historico, grafo cognitivo, alimentacion de GIA. No es motor de BI.

**Analytics Engine:** bounded context separado. Consume Domain Events, construye proyecciones analiticas, calcula KPIs, mantiene vistas optimizadas. Completamente desacoplado de SINAPSIS. Ambos consumen los mismos eventos. Nunca dependen uno del otro.

## Arquitectura general

Usuarios -> Commands -> Application Layer -> Domain -> Domain Events -> Nexus Event Bus
  -> SINAPSIS (memoria, GIA)
  -> Analytics Engine (Read Models, KPIs)
  -> Otros Reactores

## Los cuatro pilares

### I. Domain Funnel

Responde: como circula un Job dentro del ecosistema.

Pipeline canonico:
JOB_CREATED -> PROVIDER_MATCHED -> QUOTE_SENT -> QUOTE_ACCEPTED -> JOB_STARTED -> JOB_COMPLETED -> PAYMENT_COMPLETED -> MUTUAL_REVIEW

Por cada transicion calcular: conversion, tiempo promedio/maximo/minimo, cancelaciones, reintentos, ciudad, rubro, comercio, prestador.

Objetivo: detectar fricciones comerciales, no bugs.

### II. Ecosystem Health

Responde: esta funcionando correctamente el mercado.

- Actores: clientes activos, comercios activos, prestadores activos
- Operacion: jobs abiertos, jobs demorados, tiempo medio de respuesta y resolucion
- Economia: comision diaria/mensual, wallets activas/bloqueadas, liquidez del ecosistema
- Infraestructura: eventos/segundo, latencia, reactores activos/detenidos, DLQ, errores, integraciones externas
- Componentes: estado de Kernel, Nexus, SINAPSIS, DIXIE, GIA

### III. Market Intelligence

Responde: que esta ocurriendo en el mercado.

- Geografia: mapa oferta/demanda, mapa de calor, densidad de prestadores y clientes
- Economia: ticket promedio, facturacion por ciudad y rubro, velocidad del dinero, rotacion de wallets
- Tendencias: rubros emergentes, horarios pico, estacionalidad, crecimiento, retencion
- Prediccion GIA: demanda, deficit de prestadores, saturacion, oportunidades. Siempre basada en evidencia historica, nunca reglas arbitrarias.

### IV. Operational Intelligence

Responde: que necesita atencion ahora mismo.

NOC del mercado digital. Alertas en tiempo real:
- Jobs bloqueados, comercios inactivos, prestadores con caida abrupta
- Wallets inconsistentes, disputas abiertas
- Reactores caidos, colas detenidas, integraciones degradadas
- Posibles fraudes, eventos repetidos, picos anomalos

Cada alerta incluye: prioridad, impacto, evidencia, accion recomendada.

## Insights automaticos

El sistema genera observaciones automaticamente. Ejemplos:
- "Electricidad presenta un deficit del 42% de oferta en Zona Oeste."
- "La conversion de presupuestos cayo un 18% respecto de la semana anterior."
- "La demanda de aire acondicionado crecio un 160%."
- "Mercado Pago incremento el tiempo promedio de cierre en 11 minutos."

Todos los insights incluyen: evidencia utilizada, periodo analizado, nivel de confianza, impacto estimado. No generar afirmaciones sin respaldo en eventos.

## Principios de diseno

- Todo KPI proviene de Domain Events
- Ningun dashboard consulta directamente agregados transaccionales
- Las consultas se realizan unicamente sobre Read Models
- Analytics y SINAPSIS evolucionan de forma independiente
- Las proyecciones deben ser reconstruibles desde el Event Store
- El sistema debe tolerar reprocesamiento completo
- Ningun calculo debe modificar el dominio
- Toda inteligencia debe ser explicable mediante evidencia

## Vision final

El Panel de Administracion de ServiRed no es un panel administrativo convencional. Es el Centro de Comando del Market Operating System. Su mision: observar, comprender, gobernar y optimizar el mercado completo mediante eventos del dominio, proyecciones analiticas especializadas e inteligencia operacional basada en evidencia.

*Registrado 2026-07-13*
