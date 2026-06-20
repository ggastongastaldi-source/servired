'use strict';
/**
 * singleWriterGuard.js — ADR-005 enforcement
 * La integridad de la hash-chain de SINAPSIS (sinapsisBusAdapter.js)
 * depende de ejecucion monoproceso. Este guard falla rapido si detecta
 * una configuracion incompatible, en vez de corromper la cadena en
 * silencio.
 */

const cluster = require('cluster');

function assertSingleWriter() {
  const webConcurrency = process.env.WEB_CONCURRENCY;

  if (webConcurrency && webConcurrency !== '1') {
    throw new Error(
      'ADR-005 violado: WEB_CONCURRENCY=' + webConcurrency + ' detectado. ' +
      'La integridad de la hash-chain de SINAPSIS requiere ejecucion ' +
      'monoproceso. Ver docs/architecture/ADR_005_Single_Hash_Authority.md'
    );
  }

  if (cluster.isWorker) {
    throw new Error(
      'ADR-005 violado: proceso corriendo como worker de cluster. ' +
      'La integridad de la hash-chain de SINAPSIS requiere ejecucion ' +
      'monoproceso. Ver docs/architecture/ADR_005_Single_Hash_Authority.md'
    );
  }

  console.log('[ADR-005] Single Writer Guard OK - ejecucion monoproceso confirmada');
}

module.exports = { assertSingleWriter };
