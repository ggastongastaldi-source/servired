# ServiRed OS — Identity & Trust Domain v1 (Especificacion)

status: ESPECIFICACION - PRIORIDAD SIN DECIDIR
version: 1.0
date: 2026-06-20
relacion_con_roadmap: NO reemplaza Fase 1+2 de roadmap-fases.md.
                       Es un dominio nuevo, compite por prioridad.

## Marco

Bounded Context separado para identidad y confianza. El estado de un
actor no es un booleano isVerified - es una escalera progresiva que
habilita capacidades distintas en el sistema.

## Escalera de confianza (Trust Ladder)

0. Explorador - solo navega
1. Registrado / Vecino - email + telefono + OTP
2. Verificado / Conocido - selfie + foto DNI
3. Biometrico / Confiable - validacion biometrica + AFIP/CUIT (comercios)
4. Comercial Certificado - puede cobrar dinero
5. Referente Territorial / Premium - ofertas dinamicas, boost

## TrustScore - PENDIENTE DE CONGELAR

Las dos propuestas de la mesa no coinciden en valores exactos. Antes
de implementar, definir una sola tabla:
- Telefono validado: +10
- Email validado: +10
- Selfie validada: +20
- DNI validado: +30
- Trabajo completado: +15 c/u (revisar - hay version con +20/+40 segun volumen)
- Resena 5 estrellas: +25
- Cancelacion injustificada / reporte validado: -10 a -30

## Correccion tecnica (patron repetido en sesion)

Snippet FaceScanScreen recibido usaba React Native (View, CameraView,
useState de 'react'). Va contra ux-constitution-v1.2.md (PWA vanilla,
no React Native). Tercera vez que aparece este patron en contenido de
mesa externa - anotado para que no se repita sin chequeo.

## Conflicto de prioridad sin resolver

Tres candidatos compiten por "que sigue", ninguno descarta a los otros
todavia:
1. Fase 1+2 (Captura -> Clasificacion) - YA congelado en roadmap-fases.md
2. Identity & Trust Domain (este documento) - nuevo
3. Consolidacion UX/Navegacion (Home, menu hamburguesa, Ayuda) - nuevo

Decision de producto pendiente, no arquitectonica. Definir antes de
la proxima sesion de codigo.
