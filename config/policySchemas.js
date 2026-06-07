/**
 * B19 Policy Engine — Zod Schemas
 * Validación en runtime antes de insertar o activar políticas.
 * Requiere: npm install zod
 */
const { z } = require('zod');

const ConditionSchema = z.object({
  field:    z.string().min(1),
  operator: z.enum(['gt','gte','lt','lte','eq','in','between']),
  value:    z.union([z.number(), z.string(), z.array(z.number()), z.array(z.string())]),
});

const ActionSchema = z.object({
  type: z.enum([
    'multiply_price',
    'cap_price',
    'floor_price',
    'freeze_dispatch',
    'rollback_policy',
    'emit_event',
    'adjust_factor',
  ]),
  params: z.record(z.unknown()),
});

const ScopeSchema = z.object({
  rubros: z.array(z.string()).default([]),
  zonas:  z.array(z.string()).default([]),
  hours: z.object({
    from: z.number().min(0).max(23),
    to:   z.number().min(0).max(23),
  }).optional(),
});

const PolicyRuleCreateSchema = z.object({
  ruleId:      z.string().min(1).regex(/^[a-z_]+$/, 'Solo lowercase y underscores'),
  version:     z.string().regex(/^\d+\.\d+\.\d+$/, 'Formato semver requerido'),
  description: z.string().min(10),
  status:      z.enum(['active','shadow','frozen','deprecated']).default('shadow'),
  scope:       ScopeSchema.default({ rubros: [], zonas: [] }),
  conditions:  z.array(ConditionSchema).default([]),
  actions:     z.array(ActionSchema).min(1, 'Al menos una acción requerida'),
  priority:    z.number().int().min(1).max(1000).default(100),
  rollbackable:z.boolean().default(true),
  createdBy:   z.string().min(1),
});

const PolicyActivateSchema = z.object({
  ruleId:  z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  activatedBy: z.string().min(1),
});

module.exports = {
  PolicyRuleCreateSchema,
  PolicyActivateSchema,
  ConditionSchema,
  ActionSchema,
};
