const tools = new Map();

function register(tool) {
  if (!tool.name || !tool.canHandle || !tool.execute) {
    throw new Error(`Herramienta inválida: debe tener name, canHandle y execute`);
  }
  tools.set(tool.name, tool);
}

function getRelevant(context) {
  return [...tools.values()].filter(t => {
    try { return t.canHandle(context); } catch(e) { return false; }
  });
}

register(require('./tools/ActivityLogTool'));
register(require('./tools/AladdinTool'));
register(require('./tools/PulseTool'));

module.exports = { register, getRelevant };
