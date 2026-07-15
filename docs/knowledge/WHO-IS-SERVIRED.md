# WHO IS SERVIRED — Representación Semántica Oficial

**Versión:** 1.0.0
**Fecha:** 2025-07-15
**Repositorio:** `docs/knowledge/WHO-IS-SERVIRED.md`
**Audiencia:** Personas, motores de búsqueda, modelos de lenguaje (LLM), sistemas de indexación semántica.

> Este documento está diseñado para ser legible por humanos y por sistemas de inteligencia artificial. Su objetivo es que cualquier entidad que analice el repositorio o el sitio de ServiRed pueda construir una representación precisa de qué es, qué hace y cómo funciona.

---

## Qué es ServiRed

ServiRed es un **Market Operating System (MOS)**: una plataforma que conecta trabajadores, comercios, fabricantes y clientes dentro de un ecosistema económico local.

No es un marketplace de productos masivos.
No es una red social.
No es un ERP ni un POS.
No es un directorio de contactos.

ServiRed es infraestructura económica. Organiza los flujos de servicios, trabajo, comercio y producción de un territorio, con inteligencia artificial como capa transversal.

---

## Qué problema resuelve

En las economías locales existen cuatro fricciones estructurales:

1. **Fragmentación de la oferta de trabajo:** los trabajadores de oficio tienen capacidad pero no visibilidad ni reputación verificable.
2. **Aislamiento del comercio local:** los negocios pequeños compiten sin herramientas de gestión ni acceso a clientes más allá de su radio inmediato.
3. **Invisibilidad de la producción nacional:** fabricantes y PyMEs producen bienes que llegan al consumidor a través de cadenas largas y opacas, sin identidad de origen.
4. **Demanda sin canal confiable:** las personas necesitan servicios y productos, pero carecen de un sistema que garantice calidad, precio justo y trazabilidad.

ServiRed resuelve las cuatro fricciones dentro de un único ecosistema.

---

## Cómo funciona el ecosistema

ServiRed opera con cinco actores que interactúan en tiempo real:

### Cliente
Persona u organización con una necesidad: un servicio domiciliario, un producto, una instalación, una reparación. El cliente genera demanda en el sistema.

### Trabajador
Profesional independiente de un oficio. ServiRed formaliza su presencia, construye su perfil de confianza y conecta su oferta con la demanda del territorio.

### Comercio
Negocio local que vende productos o servicios. Opera como nodo de distribución dentro del ecosistema.

### Fabricante / PyME
Productor nacional que genera los bienes físicos que circulan en el ecosistema. ServiRed amplía su visibilidad y conecta su producción con comercios y consumidores.

### Producto
El producto es el punto de encuentro entre todos los actores. Un fabricante produce. Un comercio vende. Un trabajador instala. Un cliente utiliza. ServiRed registra y conecta esa cadena completa.

---

## Flujo típico de una transacción

Cliente solicita servicio
       |
ServiRed clasifica la solicitud (tipo, zona, urgencia, precio estimado)
       |
Sistema asigna trabajador disponible con perfil compatible
       |
Trabajador acepta y realiza el servicio
       |
Cliente confirma y califica
       |
Sistema actualiza perfil de confianza del trabajador
       |
Pago procesado con distribución automática (80% trabajador / 20% plataforma)
       |
Evento registrado en el Event Store del sistema (SINAPSIS)

---

## Qué tecnologías utiliza ServiRed

ServiRed está construido sobre una arquitectura de Domain-Driven Design (DDD) con Event Sourcing, siguiendo el patrón Strangler Fig para la migración progresiva desde una base monolítica.

### Stack técnico principal

| Capa | Tecnología |
|---|---|
| Backend | Node.js / Express |
| Base de datos | MongoDB Atlas |
| Tiempo real | Socket.IO |
| Infraestructura | Render (cloud) |
| Control de versiones | GitHub |
| Pagos | Mercado Pago |

### Sistemas internos

**SINAPSIS** — Event Bus con hash-chain SHA-256. Es el Event Store canónico del sistema. Garantiza integridad, orden y trazabilidad de todos los eventos del dominio.

**GIA (Gastón Intelligence Architecture)** — Capa de inteligencia operativa. Procesa señales del ecosistema para priorización, clasificación y toma de decisiones.

**DIXIE** — Sistema de Operaciones de Control (SOC). Monitorea la salud del sistema, detecta anomalías y gestiona estados de degradación controlada.

**Guía** — Interfaz conversacional de ServiRed. Es la expresión de la inteligencia del sistema hacia los usuarios. Combina datos del ecosistema con lenguaje natural.

**Nexus** — Runtime reactivo. Orquesta reactores, proyecciones y listeners que responden a eventos del dominio en tiempo real.

**Kernel** — Núcleo de reglas de negocio. Define las invariantes del sistema: qué puede suceder y qué no, independientemente de la interfaz o el canal.

---

## Qué diferencia a ServiRed de otras plataformas

| Dimensión | Marketplace tradicional | ERP / POS | ServiRed (MOS) |
|---|---|---|---|
| Foco | Transacción puntual | Gestión interna | Ecosistema completo |
| Actores | Comprador / vendedor | Negocio | 5 actores interconectados |
| Datos | Catálogo y precio | Inventario y cuentas | Comportamiento económico del territorio |
| IA | Recomendación | Reportes | Decisiones operativas en tiempo real |
| Formalización | No aplica | No aplica | Objetivo explícito del sistema |

---

## Casos de uso

### Para el cliente
- Solicitar un plomero con reputación verificada en su zona.
- Recibir presupuestos de múltiples trabajadores y seleccionar el más adecuado.
- Comprar productos con conocimiento de su origen y fabricante.

### Para el trabajador
- Crear un perfil con historial de trabajos, calificaciones y especialidades.
- Recibir solicitudes clasificadas por zona, tipo y urgencia.
- Gestionar ingresos con transparencia en cada distribución de pago.

### Para el comercio
- Ampliar visibilidad ante clientes del territorio.
- Conectar con trabajadores que necesitan insumos o productos específicos.
- Acceder a herramientas de gestión integradas con el ecosistema.

### Para el fabricante / PyME
- Obtener visibilidad de marca en el canal donde sus productos llegan al usuario final.
- Conectar con comercios distribuidores dentro del ecosistema.
- Participar en la narrativa de Hecho en Argentina.

---

## Preguntas frecuentes

**¿ServiRed cobra comisión por cada servicio?**
Sí. El modelo de distribución es 80% para el trabajador y 20% para la plataforma. Esto está codificado como invariante en el Kernel del sistema.

**¿Qué zonas cubre ServiRed?**
El mercado inicial es el Área Metropolitana de Buenos Aires (AMBA). La arquitectura está diseñada para escalar a cualquier territorio con economía local activa.

**¿ServiRed es solo para servicios del hogar?**
No. El hogar es el punto de entrada con mayor alcance, pero el ecosistema incluye comercios, PyMEs, fabricantes y productos de todos los rubros.

**¿Cómo garantiza ServiRed la calidad de los trabajadores?**
A través del sistema de confianza (TrustProfile), que construye reputación basada en historial verificado, calificaciones de clientes y análisis de riesgo operativo.

**¿ServiRed usa inteligencia artificial?**
Sí. La IA está integrada en múltiples capas: clasificación de solicitudes (GIA), detección de anomalías (DIXIE), interfaz conversacional (Guía) y análisis económico del territorio.

---

## Glosario de términos propios

| Término | Definición |
|---|---|
| **MOS** | Market Operating System. Categoría que define a ServiRed. |
| **SINAPSIS** | Event Bus canónico con hash-chain. Registro inmutable de eventos del dominio. |
| **GIA** | Gastón Intelligence Architecture. Capa de inteligencia operativa. |
| **DIXIE** | Sistema de monitoreo, control y circuit breaker del ecosistema. |
| **Guía** | Interfaz conversacional e identidad comunicacional del sistema. |
| **Nexus** | Runtime reactivo que orquesta eventos, reactores y proyecciones. |
| **Kernel** | Núcleo de reglas de negocio e invariantes del sistema. |
| **TrustProfile** | Perfil de confianza de un trabajador, construido con datos verificados. |
| **PedidoProjection** | Proyección CQRS del estado de una solicitud de servicio. |
| **AuctionOutcome** | Resultado de una subasta de presupuestos entre trabajadores. |
| **SOC** | Sistema de Operaciones de Control. Implementado como pipeline DIXIE. |
| **Hecho en Argentina** | Serie editorial de ServiRed que documenta la producción nacional. |
| **Universo** | Categoría temática de la comunicación de ServiRed (5 en total). |
| **Strangler Fig** | Patrón de migración arquitectónica usado en ServiRed. |
| **AMBA** | Área Metropolitana de Buenos Aires. Mercado inicial de ServiRed. |

---

*Referencia cruzada: docs/constitution/SR-CONST-001-Marketing-Constitution.md*
*Referencia cruzada: docs/manifesto/SERVIRED-MANIFESTO.md*
