# ESTADO ServiRed
Ultima actualizacion: 2026-07-05

## Estado general

- Produccion: activa en Render free tier.
- Estabilidad: SOC v2 (Capas 1-4) validado en produccion y congelado
  (solo tocar por bugs criticos). Nexus/MerchantProjection y Resend
  adapter con bugs estructurales ya resueltos.
- MVP: Auth/Onboarding via Google cerrado funcionalmente (pendiente
  E2E con 3 cuentas reales). Pricing Engine v1 con señales definidas.
- Riesgos actuales:
  - STATE DRIFT CRITICAL reportado por ProviderStateReconciliator para
    dos providers (item abierto).
  - Integridad de paquete dotenv sin confirmar.
  - Comercio domain: alta via QR no vincula Usuario (ver abajo).

## Ultimo hito completado

Fase 2b del fix de Google Login / Onboarding FSM (commit e85c35b):
separacion de needsRoleSelection y needsProfileCompletion en el
snapshot de /api/auth/me, terminando el loop de usuarios con rol
existente viendo el selector de rol indefinidamente.

## Trabajo en curso

Cierre de la fase de Auth/Onboarding: falta el test funcional E2E con
tres cuentas reales para dar por cerrada la fase completa.

## Proximo objetivo inmediato

Convergencia SQOP↔Merchant — diagnostico cerrado tras Discovery Pass
completo (2026-07-05). Hallazgo confirmado:

- El dominio Merchant SI esta implementado: BusinessProfile,
  merchantController.createProfile, emision de MERCHANT_PROFILE_CREATED
  via Nexus, todo funcional.
- El flujo SQOP (GET /o) SI esta implementado: verifica QR, crea
  OnboardingSession, publica eventos, redirige con 302 a
  /qr/onboarding?session=...
- La pieza faltante: no existe el wizard de /qr/onboarding en public/.
  No hay HTML/JS que reciba el sessionId, autentique al usuario, cargue
  el formulario del comercio, y llame a POST /api/merchant/profile.
  El unico wizard existente (wizard-provider.js) es del onboarding de
  Trabajador/Provider, no de Merchant.
- Commerce.js (ruta vieja /api/commerce/register) queda confirmado como
  legado/huerfano, no como fuente de verdad en competencia.

Clasificacion: no es "Organo Conectado pero Enfermo" sino Organo
No Conectado — falta construir la orquestacion, no reparar una conexion
existente.

Flujo objetivo a implementar:
1. Usuario escanea QR.
2. SQOP crea OnboardingSession (ya existe).
3. Wizard /qr/onboarding autentica al usuario (o lo deriva a login).
4. Formulario de datos del comercio.
5. POST /api/merchant/profile (ya existe, no requiere cambios).
6. Vincular BusinessProfile.commerceId si corresponde.
7. Marcar OnboardingSession.status = 'completed'.
8. Redirigir a merchant.html.

## Issues abiertos

- vendorCommissionReactor.js (exporta onCommerceCreated) esta huerfano:
  la funcion correcta es atribucion de conversion de campaña QR, no
  lifecycle de Commerce.
- El evento COMMERCE_CREATED no existe en ningun lugar del codebase
  (se necesita para cerrar la convergencia SQOP↔Merchant).
- STATE DRIFT CRITICAL en dos providers (Reconciliator).

## Deuda tecnica

- Campo onboardingStep compartido entre la FSM de login y la FSM de
  Provider Activation, con semanticas distintas. Aislado como deuda
  tecnica para una auditoria futura separada del bounded context
  Trabajador/Provider.
- Patron fire-and-forget .catch(e => console.error(..., e.message))
  identificado como recurrente; se actualizo a loguear el objeto e
  completo donde ya se toco, pero puede persistir en otros modulos.

## Decisiones pendientes

- Definir el endpoint/contrato para completar el registro de Commerce
  con un sessionId de SQOP y vincularlo a un BusinessProfile.
- Confirmar si vendorCommissionReactor se re-conecta al evento correcto
  o se reemplaza.

## Roadmap

### Sprint actual
1. Google Login/Onboarding — cierre con E2E de 3 cuentas.
2. SQOP↔Merchant — convergencia (COMMERCE_CREATED + vinculo a Usuario).

### Sprint siguiente
3. Atribucion QR (conversion → comision de vendor, correctamente
   conectada).
4. Formalizacion del dominio Vendor.

### Largo plazo
5. Integracion de conocimiento comercial de G.I.A.
6. Motor de marketing automatizado.
7. Capa 5 del SOC (Jurisprudencia) — no iniciada.

## Proxima sesion

Arrancar con Discovery Pass sobre src/core/routes/commerce.js y
models/Commerce.js para mapear exactamente que falta antes de tocar
codigo (linkeo a Usuario, emision de JWT, evento SINAPSIS).
