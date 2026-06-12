const Ajv = require('ajv');
const schema = require('./event.schema.json');

const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

/**
 * Valida un evento contra event.schema.json
 * @param {object} event
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateEvent(event) {
  const valid = validate(event);
  if (valid) return { valid: true, errors: [] };

  const errors = (validate.errors || []).map((e) => {
    const path = e.instancePath && e.instancePath.length ? e.instancePath : '(root)';
    return `${path} ${e.message}`;
  });

  return { valid: false, errors };
}

module.exports = { validateEvent };
