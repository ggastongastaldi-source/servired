# RFC: FSM de OnboardingSession para wizard Merchant
Fecha: 2026-07-05
Estado: propuesto

## Estados (campo unico: status)

| Estado           | Significado                                          |
|------------------|-------------------------------------------------------|
| pending          | Sesion creada por escaneo QR, sin interaccion aun     |
| validated        | Usuario abrio /qr/onboarding, sesion verificada       |
| authenticated    | Usuario tiene JWT valido, usuarioId asignado          |
| profile_created  | POST /api/merchant/profile exitoso                    |
| completed        | Flujo cerrado, usuario redirigido a merchant.html      |
| expired          | TTL vencido (ya existe, sin cambios)                   |
| aborted          | Usuario abandono o rechazo el flujo (ya existe)        |

## Transiciones validas

pending          -> validated        | GET  /api/onboarding/session/:id (ya existe)
validated        -> authenticated    | POST /api/onboarding/session/:id/auth
authenticated    -> profile_created  | POST /api/merchant/profile (agrega hook)
profile_created  -> completed        | POST /api/onboarding/session/:id/complete
cualquiera       -> expired          | TTL index (ya existe, automatico)
cualquiera       -> aborted          | accion explicita del usuario (futuro, no MVP)

No se permite retroceder de estado. Una transicion invalida (ej. intentar
authenticated -> validated) debe responder 409, no silenciarse.

## Endpoints por transicion

1. GET /api/onboarding/session/:sessionId (ya existe)
   pending -> validated. Sin cambios de contrato.

2. POST /api/onboarding/session/:sessionId/auth  (NUEVO)
   Body: { } — usa req.userId del authMiddleware (agnostico al proveedor
   de identidad: Google OAuth hoy, cualquier otro metodo futuro sin
   cambiar este contrato).
   Precondiciones: status === 'validated' AND req.userId presente.
   Efecto: session.usuarioId = req.userId; status = 'authenticated'.
   Publica evento SINAPSIS: ONBOARDING_SESSION_AUTHENTICATED.

3. POST /api/merchant/profile  (YA EXISTE — se le agrega un hook opcional)
   Si el request incluye header/query sessionId Y la sesion esta en
   'authenticated', al crear el BusinessProfile exitosamente:
     - session.status = 'profile_created'
     - session.commerceId = profile._id
   No se modifica el contrato existente del endpoint para clientes que
   no pasan sessionId (login directo sin QR sigue funcionando igual).

4. POST /api/onboarding/session/:sessionId/complete  (NUEVO)
   Precondiciones: status === 'profile_created' AND commerceId != null.
   Efecto: status = 'completed'; completedAt = now().
   Publica evento SINAPSIS: ONBOARDING_SESSION_COMPLETED.

## Campos nuevos en OnboardingSession

- usuarioId: ObjectId, ref 'Usuario', default null.
  Asignado en la transicion validated -> authenticated.
- completedAt: Date, default null.
  Asignado en la transicion profile_created -> completed.

No se agrega lastStep: el propio status cumple esa funcion, evitando
dos fuentes de verdad sobre en que paso esta el wizard.

commerceId ya existe en el modelo (ref BusinessProfile) — se reutiliza
tal cual, sin cambios de tipo.

## Independencia del proveedor de identidad

El wizard no asume Google OAuth especificamente. La regla es: "requiere
un usuario autenticado". Si no hay sesion valida, redirige al flujo de
login configurado por la app (hoy Google, mañana potencialmente otro).
Al volver, retoma el sessionId original via query param y continua la
FSM en el estado que corresponda. Este desacople evita que la FSM deba
modificarse si cambia el mecanismo de login.

## Reanudacion del wizard

Si el usuario cierra el navegador y vuelve con el mismo sessionId, el
wizard hace GET /api/onboarding/session/:sessionId, lee status, y
renderiza el paso correspondiente:
- validated       -> pantalla de login
- authenticated   -> formulario de datos del comercio
- profile_created -> pantalla de confirmacion (llama a /complete)
- completed       -> redirige directo a merchant.html
- expired/aborted -> pantalla de error, sugiere volver a escanear el QR

## Fuera de alcance de este RFC

- Vinculo opcional a Commerce.js (ruta legacy) — no se toca en esta
  convergencia, sigue siendo huerfano hasta que se decida deprecarlo.
- Reintentos automaticos ante fallo de /api/merchant/profile.
- Estado 'aborted' explicito por el usuario (boton "cancelar").
