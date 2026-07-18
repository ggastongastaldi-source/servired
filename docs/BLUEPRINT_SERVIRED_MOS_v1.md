# ServiRed MOS — Blueprint del Producto v1.0

## Definición fundamental

**"ServiRed es un Sistema Operativo de Mercado que conecta personas, trabajadores, comercios, PyMEs e industrias en un ecosistema inteligente donde la oferta, la demanda y las relaciones comerciales generan oportunidades, crecimiento y valor para todos sus participantes."**

### Lema interno
> "No construimos una aplicación. Construimos la infraestructura digital donde ocurre la economía local."

---

## Propósito

ServiRed existe para reducir la distancia entre quienes necesitan algo y quienes pueden resolverlo, creando un ecosistema económico basado en confianza, identidad, inteligencia y colaboración.

Cada nueva función debe fortalecer ese propósito.

---

## Principios rectores

1. Un único ecosistema. Clientes, trabajadores, comercios, PyMEs e industrias forman parte del mismo mercado.
2. Cada actor tiene un propósito distinto.
3. La inteligencia es transversal. GIA acompaña a todos los actores.
4. La confianza genera economía. Identidad, reputación y verificación permiten transacciones seguras.
5. La monetización acompaña el crecimiento. Base gratuita a premium a servicios financieros.
6. Cada interacción debe acercar a una oportunidad económica.
7. La complejidad pertenece al sistema. La simplicidad pertenece al usuario.

---

## Identidad Económica

Cada persona posee una única identidad económica sobre la que puede desempeñar múltiples roles:
- Cliente
- Profesional / Trabajador
- Comercio / PyME
- Industria / Fabricante
- Administrador (cuando corresponda)

Los roles no representan cuentas distintas. Representan capacidades distintas de una misma identidad.

---

## Los cinco actores económicos

### 1. Cliente
- Misión: resolver una necesidad
- Recorrido: Descubrir, Comparar, Solicitar, Contratar, Pagar, Calificar
- Centro Operativo: Centro del Cliente
- Nav: Inicio, Buscar, Pedidos, Perfil

### 2. Profesional / Trabajador
- Misión: conseguir trabajo y administrar su actividad
- Recorrido: Trabajos, Presupuestos, Agenda, Cobros, Reputación
- Centro Operativo: Centro Profesional
- Nav: Inicio, Trabajos, Agenda, Billetera, Perfil

### 3. Comercio / PyME
- Misión: vender
- Recorrido: Pedidos, Catalogo, Clientes, Promociones, Estadisticas
- Centro Operativo: Centro Comercial (Operativo v1)
- Nav: Inicio, Pedidos, Catalogo, Clientes, Perfil

### 4. Industria / Fabrica
- Misión: abastecer
- Recorrido: Ofertas, Produccion, Capacidad, Distribucion, Relaciones B2B
- Centro Operativo: Centro Industrial
- Nav: Inicio, Ofertas, Produccion, Distribucion, Perfil

### 5. Administracion
- No forma parte del producto publico
- Centro operativo completamente desacoplado
- Nunca es el Home de ningun usuario
- Acceso exclusivo por rol admin

---

## Centros Operativos

| Actor | Centro | Estado |
|-------|--------|--------|
| Cliente | Centro del Cliente | En construccion |
| Trabajador | Centro Profesional | En construccion |
| Comercio / PyME | Centro Comercial | Operativo v1 |
| Industria | Centro Industrial | En construccion |
| Admin | Centro Territorial | Operativo v1 |

---

## GIA

GIA no es un modulo ni una seccion. Es la inteligencia transversal del Sistema Operativo de Mercado.

GIA observa el contexto, comprende el objetivo del usuario, sugiere oportunidades, automatiza tareas y asiste decisiones.

- Disponible desde cualquier contexto via boton flotante permanente
- No compite con la navegacion principal
- Aprende del movimiento economico del ecosistema

---

## Arquitectura de navegacion

Landing Publica
  - Buscar un servicio
  - Ofrecer mis servicios
  - Registrar mi comercio
  - Registrar mi PyME o fabrica
  - Login / Registro
      |
      Identidad Economica (rol)
      |
      Cliente / Trabajador / Comercio / Industria / Admin
      |
      Centro Operativo correspondiente

---

## Hoja de ruta

- v1: Mercado de servicios, trabajadores y clientes
- v2: Comercio y PyMEs
- v3: Industria y fabricantes
- v4: Logistica y distribucion
- v5: Servicios financieros
- v6: Ecosistema economico completo

---

## Monetizacion

- Comision por operaciones (v1, todos)
- Promociones y destacados (v1-v2, comercio/PyME)
- Herramientas premium profesional (v2, trabajador)
- Soluciones B2B (v3, industria)
- Publicidad inteligente (v2, comercio/PyME)
- Servicios financieros (v5, todos)

---

## Discovery Pass — Protocolo obligatorio

Todo cambio estructural de frontend requiere un Discovery Pass previo que responda:

1. Que existe actualmente
2. Que se conserva
3. Que se modifica
4. Que se elimina y por que
5. Que impacto tiene en el modelo de negocio

Sin Discovery Pass aprobado no se implementan cambios estructurales.

---

## Reglas de implementacion

1. Discovery Pass obligatorio antes de cualquier cambio estructural
2. Ningun cambio puede eliminar una capacidad existente sin justificacion
3. Toda pantalla debe responder: como acerca al usuario a una operacion economica
4. El modelo de negocio gobierna el codigo, nunca al reves
5. Este Blueprint es la fuente de verdad del proyecto

---

Version 1.0 - Julio 2026
Gaston Gastaldi + ServiRed MOS
