'use strict';
function parseArgs(argv) {
  const result = { scenario: null, mode: 'stochastic', seed: null, dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') { result.dryRun = true; continue; }
    const match = arg.match(/^--([a-zA-Z]+)=(.+)$/);
    if (!match) continue;
    const [, key, val] = match;
    if (key === 'scenario') result.scenario = val;
    if (key === 'mode')     result.mode = val;
    if (key === 'seed')     result.seed = parseInt(val, 10);
  }
  if (!result.scenario) { console.error('[ChaosLab] Falta --scenario=<nombre>'); process.exit(1); }
  return result;
}
module.exports = { parseArgs };
