import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import { FieldDefinition, FormDefinition } from '../models/field-definition';

export interface DefinitionIssue {
  severity: 'error' | 'warning';
  message: string;
  fieldId?: string;
}

/** Fields that hold no answer value — dependencies may not target them. */
const VALUELESS_TYPES = new Set(['section', 'hidden']);

export function isValuelessField(field: FieldDefinition): boolean {
  return VALUELESS_TYPES.has(field.type);
}

/**
 * Collects every field id used inside a dependency's condition tree
 * (`condition.field` values, including nested groups).
 */
export function collectConditionFields(condition: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (typeof n['field'] === 'string') out.push(n['field']);
    if (Array.isArray(n['conditions'])) n['conditions'].forEach(walk);
  };
  walk(condition);
  return out;
}

/** Collects the target fields an effect applies to (effect.target ?? dependency.target). */
export function collectEffectTargets(dependency: Dependency): string[] {
  const targets = new Set<string>();
  const readTarget = (effect: unknown): void => {
    const e = effect as { target?: unknown };
    targets.add(String(e.target ?? dependency.target));
  };
  for (const effect of dependency.effects ?? []) {
    readTarget(effect);
  }
  for (const effect of dependency.elseEffects ?? []) {
    readTarget(effect);
  }
  return [...targets];
}

interface GraphResult {
  order: string[];
  cycle: string[] | null;
}

/**
 * Kahn topological sort over edges `condition.field -> dep.target`.
 * Conservative by design: it treats any dependency as a value-flow edge so
 * genuine cycles are always caught, at the cost of flagging some harmless
 * rule pairs (documented behavior).
 */
export function topologicalSort(
  fieldIds: string[],
  dependencies: Dependency[],
): GraphResult {
  const indegree = new Map<string, number>(fieldIds.map((id) => [id, 0]));
  const adjacency = new Map<string, Set<string>>(fieldIds.map((id) => [id, new Set<string>()]));

  for (const dep of dependencies) {
    for (const source of collectConditionFields(dep.when)) {
      if (!indegree.has(source) || !indegree.has(dep.target)) continue;
      if (source === dep.target) {
        return { order: [], cycle: [source, source] };
      }
      const set = adjacency.get(source)!;
      if (!set.has(dep.target)) {
        set.add(dep.target);
        indegree.set(dep.target, indegree.get(dep.target)! + 1);
      }
    }
  }

  const queue = fieldIds.filter((id) => indegree.get(id) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const remaining = indegree.get(next)! - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  if (order.length !== fieldIds.length) {
    const cyclic = fieldIds.filter((id) => indegree.get(id)! > 0);
    return { order, cycle: cyclic };
  }
  return { order, cycle: null };
}

/** Full validation pass run before every save/publish. */
export function validateDefinition(def: FormDefinition): DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];

  if (!def.title?.trim()) {
    issues.push({ severity: 'error', message: 'Form title is required.' });
  }

  // duplicate ids / invalid ids
  const seen = new Set<string>();
  for (const field of def.fields) {
    if (!field.id?.trim()) {
      issues.push({ severity: 'error', message: 'Every field needs an id.', fieldId: field.id });
      continue;
    }
    if (seen.has(field.id)) {
      issues.push({
        severity: 'error',
        message: `Duplicate field id "${field.id}".`,
        fieldId: field.id,
      });
    }
    seen.add(field.id);
  }

  // option-driven types must have options
  const OPTION_TYPES = new Set(['dropdown', 'multi-select', 'radio', 'checkbox-group']);
  for (const field of def.fields) {
    if (OPTION_TYPES.has(field.type) && !(field.options?.length)) {
      issues.push({
        severity: 'error',
        message: `"${field.label || field.id}" (${field.type}) needs at least one option.`,
        fieldId: field.id,
      });
    }
  }

  if (def.dependencies.length > 0) {
    const byId = new Map(def.fields.map((f) => [f.id, f]));

    for (const dep of def.dependencies) {
      const label = dep.id || '(unnamed rule)';
      // target must exist and hold a value
      const targetField = byId.get(dep.target);
      if (!targetField) {
        issues.push({
          severity: 'error',
          message: `Rule "${label}" targets missing field "${dep.target}".`,
          fieldId: dep.target,
        });
      } else if (isValuelessField(targetField)) {
        issues.push({
          severity: 'error',
          message: `Rule "${label}" targets "${dep.target}", which cannot hold a value.`,
          fieldId: dep.target,
        });
      }

      // condition sources must exist
      for (const source of collectConditionFields(dep.when)) {
        if (!byId.has(source)) {
          issues.push({
            severity: 'error',
            message: `Rule "${label}" reads from missing field "${source}".`,
            fieldId: source,
          });
        }
      }

      // self-referencing rule
      const sources = collectConditionFields(dep.when);
      if (sources.includes(dep.target)) {
        issues.push({
          severity: 'error',
          message: `Rule "${label}" both reads and writes "${dep.target}" — circular.`,
          fieldId: dep.target,
        });
      }
    }

    const { cycle } = topologicalSort(
      def.fields.map((f) => f.id),
      def.dependencies,
    );
    if (cycle) {
      issues.push({
        severity: 'error',
        message: `Circular dependency detected between fields: ${cycle.join(' → ')}.`,
      });
    }
  }

  // warnings
  const referenced = new Set<string>();
  for (const dep of def.dependencies) {
    referenced.add(dep.target);
    collectEffectTargets(dep).forEach((t) => referenced.add(t));
    collectConditionFields(dep.when).forEach((s) => referenced.add(s));
  }
  const answerable = def.fields.filter((f) => f.type !== 'section');
  if (answerable.length > 2 && referenced.size === 0) {
    issues.push({
      severity: 'warning',
      message: 'No conditional rules configured — form is fully static.',
    });
  }

  return issues;
}
