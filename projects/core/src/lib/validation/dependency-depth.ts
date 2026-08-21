import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import { FieldDefinition, FormDefinition } from '../models/field-definition';

/**
 * Depth of every field in the dependency hierarchy:
 * - `0` — independent field (no rules target it)
 * - `1` — depends directly on an independent field
 * - `2` — depends on a depth-1 field (nested chain), and so on
 *
 * Used by the builder canvas, responder and viewer to *indent* dependent
 * fields under the fields they depend on, making conditional structure
 * visible without extra chrome. Cycles are guarded: any field inside a
 * cycle gets depth 1 relative to itself.
 */
export function computeDependencyDepths(
  fields: FieldDefinition[],
  dependencies: Dependency[],
): Map<string, number> {
  const depths = new Map<string, number>(fields.map((f) => [f.id, 0]));

  // incoming edges: sourceFieldId -> [targets that depend on it]
  const dependents = new Map<string, Set<string>>();
  for (const dep of dependencies) {
    for (const source of collectSources(dep.when)) {
      if (!depths.has(dep.target) || !depths.has(source)) continue;
      if (!dependents.has(source)) dependents.set(source, new Set());
      dependents.get(source)!.add(dep.target);
    }
  }

  // longest-path via DFS with cycle guard (visiting set)
  const resolve = (id: string, visiting: Set<string>): number => {
    const cached = depths.get(id);
    if (cached === undefined) return 0;
    if (visiting.has(id)) return 0; // cycle — treat as top level

    let maxParent = -1;
    visiting.add(id);
    for (const parent of parentsOf(id, dependencies)) {
      if (!depths.has(parent)) continue;
      maxParent = Math.max(maxParent, resolve(parent, visiting));
    }
    visiting.delete(id);

    const depth = maxParent + 1;
    depths.set(id, Math.max(cached, depth));
    return depth;
  };

  for (const field of fields) {
    resolve(field.id, new Set());
  }

  return depths;
}

function parentsOf(target: string, dependencies: Dependency[]): string[] {
  const out = new Set<string>();
  for (const dep of dependencies) {
    if (dep.target !== target) continue;
    for (const source of collectSources(dep.when)) out.add(source);
  }
  return [...out];
}

/** Collects condition.field values including nested groups. */
export function collectSources(condition: unknown): string[] {
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

/** Human-readable chains like "Account type → Company name" for the rule editor's map panel. */
export function describeChains(def: FormDefinition): string[] {
  const labelOf = (id: string): string => {
    const field = def.fields.find((f) => f.id === id);
    return field ? field.label || field.id : id;
  };

  const parentsOf = (targetId: string): string[] => {
    const out = new Set<string>();
    for (const dep of def.dependencies) {
      if (dep.target !== targetId) continue;
      for (const source of collectSources(dep.when)) {
        if (def.fields.some((f) => f.id === source)) out.add(source);
      }
    }
    return [...out];
  };

  /** Longest ancestor path ending at `id` (cycle-safe). */
  const longestPath = (id: string, visiting: Set<string>): string[] => {
    if (visiting.has(id)) return [id];
    visiting.add(id);
    let best: string[] = [id];
    for (const parent of parentsOf(id)) {
      const prefix = longestPath(parent, visiting);
      if (prefix.length + 1 > best.length) best = [...prefix, id];
    }
    visiting.delete(id);
    return best;
  };

  const chains: string[] = [];
  const seenTexts = new Set<string>();
  for (const dep of def.dependencies) {
    const path = longestPath(dep.target, new Set());
    if (path.length < 2) continue;
    const text = path.map(labelOf).join(' → ');
    if (!seenTexts.has(text)) {
      seenTexts.add(text);
      chains.push(text);
    }
  }
  return chains;
}

