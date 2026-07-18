# ServiRed MOS — Frontend Architecture v1.0

## Fuentes de verdad
- docs/constitution/SR-CONST-001-Marketing-Constitution.md
- docs/manifesto/SERVIRED-MANIFESTO.md
- docs/knowledge/WHO-IS-SERVIRED.md
- docs/BLUEPRINT_SERVIRED_MOS_v1.md

---

## Modelo de Identidad

### Jerarquia conceptual

  Identidad Economica (permanente, una por persona)
          |
          +---------------------------+
          |                           |
      Mercado                   Operacion del Sistema
   (roles economicos)                 |
          |                        Admin
    +-----+------+------+
    |      |      |      |
 Cliente  Trabajador  Comercio  Industria
 (capacidades dinamicas, pueden coexistir)
          |
  Centro Operativo Activo
  (contexto de trabajo actual)


### Principio fundamental
- La Identidad Economica es permanente
- Los roles economicos son capacidades habilitadas
- Los Centros Operativos son contextos de interaccion
- Admin NO es un rol economico: opera la infraestructura, no el mercado

---

## Modelo de sesion

Una sola sesion. Un solo token. Un solo usuario.

Lo que cambia es el Centro Operativo activo.

No se requiere nuevo login para cambiar de Centro.
No se requiere nueva cuenta para tener multiples roles.
El token permanece igual al cambiar de contexto.

---

## Shell Publico (no autenticado)

Visible para cualquier visitante. Primera impresion del ecosistema.

### Estructura
1. Header: Logo ServiRed + estado del sistema
2. Propuesta de valor: que es ServiRed, por que confiar
3. Selector de proposito (no de modulos):
   - Buscar un servicio
   - Ofrecer mis servicios
   - Registrar mi comercio
   - Registrar mi PyME o fabrica
4. Acceso: Iniciar sesion / Registrarse gratis
5. Guia flotante (acceso a asistente incluso sin login)

### Reglas
- Nav inferior: OCULTA
- Centros Operativos: NO ACCESIBLES
- Admin: NO VISIBLE
- Toda accion lleva al login como primer paso

---

## Shell Autenticado

### Elementos permanentes (siempre visibles)
- Header: Logo + Identidad activa + Selector de Centro (si hay mas de un rol)
- Guia: boton flotante permanente, adapta contexto segun Centro activo
- Estado del sistema: indicador Online/Offline

### Elementos dinamicos (cambian segun Centro activo)
- Nav inferior
- Contenido principal
- Acciones disponibles
- Contexto de Guia

### Selector de Centro Operativo
- Aparece SOLO cuando el usuario tiene mas de un rol habilitado
- No es cambio de cuenta ni de login
- Cambio instantaneo de contexto
- Ubicacion: header o menu hamburguesa

---

## Centros Operativos

### Centro del Cliente
- Mision: resolver una necesidad
- Recorrido: Descubrir, Comparar, Solicitar, Contratar, Pagar, Calificar
- Nav inferior: Inicio | Buscar | Pedidos | Perfil
- Estado actual: placeholder

### Centro Profesional
- Mision: conseguir trabajo y administrar actividad
- Recorrido: Trabajos, Presupuestos, Agenda, Cobros, Reputacion
- Nav inferior: Inicio | Trabajos | Agenda | Billetera | Perfil
- Estado actual: placeholder

### Centro Comercial
- Mision: vender
- Recorrido: Pedidos, Catalogo, Clientes, Promociones, Estadisticas
- Nav inferior: Inicio | Pedidos | Catalogo | Clientes | Perfil
- Estado actual: OPERATIVO v1

### Centro Industrial
- Mision: abastecer
- Recorrido: Ofertas, Produccion, Capacidad, Distribucion, B2B
- Nav inferior: Inicio | Ofertas | Produccion | Distribucion | Perfil
- Estado actual: placeholder

### Administracion (aislado del mercado)
- NO es Centro Operativo del mercado
- Acceso exclusivo por rol admin
- Nav propia: Sistema | Territorial | Actores | Config
- NUNCA aparece en nav de mercado
- NUNCA es el Home de ningun usuario de mercado
- Estado actual: parcialmente operativo

---

## Guia / GIA

### Distincion conceptual
- GIA: inteligencia interna del sistema (clasificacion, priorizacion, analisis)
- Guia: expresion conversacional de esa inteligencia hacia el usuario

### En el frontend
El usuario no interactua con GIA como modulo tecnico.
El usuario experimenta a Guia como acompanante inteligente.

### Comportamiento
- Boton flotante permanente en todos los contextos
- Adapta su rol segun Centro activo:
  - En Centro Cliente: ayuda a encontrar el servicio correcto
  - En Centro Profesional: sugiere trabajos disponibles
  - En Centro Comercial: analiza ventas y oportunidades
  - En Centro Industrial: analiza capacidad y demanda
- No compite con la navegacion principal

---

## Centro Territorial

Capacidad compartida de la infraestructura. No es navegacion principal.

Aparece DENTRO de cada Centro cuando aporta valor:
- En Centro Comercial: analisis de zona y competencia
- En Centro Profesional: demanda en la zona del trabajador
- En Centro Industrial: distribucion y logistica territorial
- En Administracion: vision completa del ecosistema AMBA

---

## Navegacion dinamica por rol

La nav inferior NO es identica para todos.
Se construye segun el Centro Operativo activo.

| Estado | Nav inferior |
|--------|-------------|
| Sin autenticar | OCULTA |
| Centro Cliente | Inicio / Buscar / Pedidos / Perfil |
| Centro Profesional | Inicio / Trabajos / Agenda / Billetera / Perfil |
| Centro Comercial | Inicio / Pedidos / Catalogo / Clientes / Perfil |
| Centro Industrial | Inicio / Ofertas / Produccion / Distribucion / Perfil |
| Admin | Sistema / Territorial / Actores / Config |

---

## Flujo de navegacion completo

Landing Publica
    |
    +-- Accion seleccionada (buscar / ofrecer / comercio / industria)
    |
    Login / Registro
    |
    Identidad Economica reconocida
    |
    Si un solo rol:
        Ir directo al Centro correspondiente
    Si multiples roles:
        Mostrar selector de Centro
    Si admin sin roles de mercado:
        Ir a panel de administracion
    |
    Centro Operativo Activo
    |
    Guia disponible en todo momento

---

## Reglas UX derivadas del MOS

1. Cada pantalla debe responder: como acerca al usuario a una operacion economica
2. La complejidad pertenece al sistema, la simplicidad al usuario
3. El usuario no deberia ver conceptos internos (SINAPSIS, DIXIE, eventos)
4. La nav inferior nunca muestra opciones irrelevantes para el rol activo
5. Admin nunca contamina la experiencia de mercado
6. Guia siempre disponible sin importar el contexto
7. El cambio de Centro no interrumpe la sesion

---

## Estado de implementacion

| Componente | Estado | Prioridad |
|------------|--------|-----------|
| Landing publica | Operativo v1 | Mejorar propuesta de valor |
| Login Google | Operativo | Estable |
| Centro Comercial | Operativo v1 | Iterar |
| Centro Territorial (admin) | Operativo v1 | Iterar |
| Nav dinamica por rol | Pendiente | ALTA |
| Selector de Centro | Pendiente | ALTA |
| Centro Profesional | Placeholder | ALTA |
| Centro del Cliente | Placeholder | ALTA |
| Centro Industrial | Placeholder | MEDIA |
| Guia como asistente contextual | Parcial | ALTA |
| Panel Admin desacoplado | Parcial | ALTA |

---

## Discovery Pass — obligatorio antes de cambios estructurales

Antes de modificar Shell, Landing, nav o flujo de autenticacion:

1. Que existe actualmente
2. Que se conserva
3. Que se modifica
4. Que se elimina y por que
5. Impacto en el modelo de negocio
6. Referencia al Blueprint o Constitution que justifica el cambio

Sin Discovery Pass aprobado no se implementan cambios estructurales.

---

Version 1.0 - Julio 2026
Gaston Gastaldi + ServiRed MOS
Referencias: SR-CONST-001, SERVIRED-MANIFESTO, WHO-IS-SERVIRED, BLUEPRINT_SERVIRED_MOS_v1
