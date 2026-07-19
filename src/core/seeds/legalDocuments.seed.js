'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const crypto   = require('crypto');
const { LegalDocument } = require('../models/LegalDocument');

const DOCS = [
  {
    type: 'terms_of_use', version: 'v1.0',
    title: 'Terminos y Condiciones de Uso - ServiRed',
    requiredFor: ['cliente','trabajador','comercio'],
    content: `# Terminos y Condiciones de Uso - ServiRed v1.0

## 1. Identificacion de la plataforma
ServiRed es una plataforma tecnologica destinada a facilitar la conexion entre usuarios, comercios, proveedores de servicios y clientes mediante herramientas digitales de busqueda, publicacion, comunicacion, contratacion, reputacion, analisis y gestion comercial. ServiRed no constituye una relacion laboral, sociedad, franquicia, representacion comercial ni asociacion entre la plataforma y los usuarios independientes que participan del ecosistema.

## 2. Naturaleza del servicio
El usuario reconoce que ServiRed proporciona infraestructura tecnologica; facilita la interaccion entre actores economicos; permite publicar ofertas, solicitudes y perfiles; y puede utilizar sistemas automatizados e inteligencia artificial para mejorar coincidencias, recomendaciones, seguridad y experiencia. La plataforma no garantiza resultados economicos especificos ni la contratacion efectiva de servicios.

## 3. Relacion entre las partes
Trabajadores: actuan bajo su propia responsabilidad; cuentan con conocimientos y habilitaciones necesarias; cumplen normativa aplicable; responden por la calidad del servicio ofrecido. Comercios: responsables de la legalidad de sus productos; respetan normas de defensa del consumidor; garantizan informacion correcta; cumplen obligaciones fiscales propias. Clientes: brindan informacion correcta; utilizan la plataforma de buena fe; respetan a otros participantes.

## 4. Sistema de confianza y reputacion
ServiRed puede implementar mecanismos automatizados de TrustScore, analisis de comportamiento, prevencion de fraude y clasificacion de riesgos. Estos sistemas tienen finalidad preventiva. La existencia de una puntuacion no constituye una garantia absoluta sobre una persona, comercio o servicio.

## 5. Inteligencia Artificial
El usuario acepta que ServiRed puede utilizar inteligencia artificial para recomendar servicios, ordenar resultados, detectar patrones y asistir en presupuestos. Los sistemas automatizados no sustituyen las obligaciones legales de las partes.

## 6. Pagos y comisiones
Las condiciones economicas seran informadas previamente; las comisiones aplicables seran aceptadas por las partes; los medios de pago externos estaran sujetos a sus propios terminos.

## 7. Limitacion de responsabilidad
ServiRed no sera responsable por incumplimientos entre usuarios; danos derivados de servicios contratados entre terceros; informacion falsa proporcionada por usuarios; ni interrupciones temporales por causas tecnicas externas.

## 8. Conductas prohibidas
Se prohibe: fraude, suplantacion de identidad, publicaciones enganosas, manipulacion de reputacion y actividades contrarias a la legislacion vigente. ServiRed podra suspender cuentas o limitar funcionalidades.

## 9. Evidencia digital y auditoria
El usuario acepta que determinados eventos puedan ser registrados: fecha y hora, aceptacion de documentos, cambios de perfil, operaciones relevantes y eventos de seguridad.

## 10. Legislacion aplicable
La utilizacion de ServiRed se regira por la legislacion de la Republica Argentina: Codigo Civil y Comercial, Ley de Defensa del Consumidor, normativa de proteccion de datos personales.`,
  },
  {
    type: 'privacy_policy', version: 'v1.0',
    title: 'Politica de Privacidad - ServiRed',
    requiredFor: ['cliente','trabajador','comercio'],
    content: `# Politica de Privacidad - ServiRed v1.0

## 1. Responsable del tratamiento
ServiRed opera como responsable del tratamiento de datos personales conforme a la Ley 25.326 de Proteccion de Datos Personales de la Republica Argentina.

## 2. Datos que recopilamos
Datos de identificacion: nombre, correo electronico, telefono. Datos de perfil: rol, zona, rubros, experiencia. Datos de actividad: busquedas, solicitudes, contrataciones, resenas. Datos tecnicos: IP, dispositivo, navegador, sesion. Datos de geolocalizacion aproximada. Datos de comportamiento con fines analiticos.

## 3. Finalidad del tratamiento
Operar y mejorar la plataforma; conectar clientes con trabajadores y comercios; calcular metricas de confianza; prevenir fraude; cumplir obligaciones legales; enviar comunicaciones del servicio.

## 4. Base legal
Ejecucion del contrato con el usuario; consentimiento explicito cuando corresponda; interes legitimo en seguridad y mejora; cumplimiento de obligaciones legales.

## 5. Conservacion
Los datos se conservan durante la vigencia de la cuenta y por el periodo adicional que requieran las obligaciones legales. Los registros de auditoria se conservan indefinidamente.

## 6. Uso de Inteligencia Artificial
ServiRed utiliza sistemas de IA para mejorar recomendaciones, clasificar servicios y detectar anomalias. Los datos agregados y anonimizados pueden utilizarse para mejorar estos sistemas.

## 7. Compartir datos con terceros
Proveedores de infraestructura; procesadores de pago (Mercado Pago); servicios de autenticacion (Google); autoridades competentes cuando la ley lo requiera. No vendemos datos personales a terceros.

## 8. Derechos del usuario
Acceder a sus datos; rectificar informacion inexacta; solicitar eliminacion cuando proceda; oponerse al tratamiento; revocar consentimientos. Contacto: privacidad@servired.online

## 9. Seguridad
Cifrado en transito, control de accesos, registros de auditoria y monitoreo de seguridad.

## 10. Cookies y analitica
ServiRed puede utilizar cookies y herramientas de analitica para mejorar la experiencia. El usuario puede gestionar preferencias desde la configuracion del navegador.`,
  },
  {
    type: 'ai_policy', version: 'v1.0',
    title: 'Politica de Inteligencia Artificial - ServiRed',
    requiredFor: ['cliente','trabajador','comercio'],
    content: `# Politica de Inteligencia Artificial - ServiRed v1.0

## 1. Uso de IA en ServiRed
ServiRed utiliza sistemas de inteligencia artificial como parte de su infraestructura operativa. El usuario reconoce y acepta este uso como condicion de la plataforma.

## 2. Aplicaciones especificas
Recomendaciones: algoritmos sugieren servicios segun historial, zona y preferencias. Clasificacion: sistemas categorizan publicaciones y solicitudes automaticamente. Presupuestos: la IA puede generar estimaciones basadas en datos historicos. Deteccion de fraude: analisis de patrones para identificar comportamientos anomalos. TrustScore: puntuacion calculada automaticamente mediante multiples senales. Asignacion: algoritmos priorizan solicitudes segun disponibilidad, zona y perfil.

## 3. Limitaciones
Los sistemas de IA son herramientas de apoyo. Las decisiones finales con impacto economico o legal significativo pueden requerir revision humana. ServiRed no garantiza la exactitud absoluta de las estimaciones generadas por IA.

## 4. Datos utilizados
Los sistemas de IA utilizan datos agregados y anonimizados del comportamiento de la plataforma. No se utilizan datos personales identificables en procesos de entrenamiento sin consentimiento explicito.

## 5. Transparencia y apelacion
El usuario puede solicitar informacion sobre como una decision automatizada lo afecta directamente. Contacto: ia@servired.online

## 6. Gobernanza algoritmica
Las politicas que gobiernan los algoritmos de ServiRed son versionadas y auditables. Los cambios significativos en los parametros de los sistemas automatizados seran comunicados a los usuarios.`,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado a MongoDB');
  for (const doc of DOCS) {
    const contentHash = crypto.createHash('sha256').update(doc.content).digest('hex');
    const existing = await LegalDocument.findOne({ type: doc.type, version: doc.version });
    if (existing) { console.log(`SKIP ${doc.type} ${doc.version} ya existe`); continue; }
    const prev = await LegalDocument.findOne({ type: doc.type, status: 'active' });
    const created = await LegalDocument.create({
      ...doc, contentHash, status: 'active', effectiveAt: new Date(),
    });
    if (prev) {
      await mongoose.connection.collection('legal_documents').updateOne(
        { _id: prev._id }, { $set: { status: 'superseded', supersededBy: created._id } }
      );
    }
    console.log(`OK ${doc.type} ${doc.version} hash:${contentHash.slice(0,12)}...`);
  }
  await mongoose.disconnect();
  console.log('Seed completado');
}
seed().catch(e => { console.error(e); process.exit(1); });
