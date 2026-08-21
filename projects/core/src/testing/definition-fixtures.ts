import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import { FieldDefinition, FieldType, FormDefinition } from '../lib/models/field-definition';

let seq = 0;

/** Builds a fully-populated field with sensible defaults per type. */
export function makeField(
  id: string,
  type: FieldType = 'text',
  overrides: Partial<FieldDefinition> = {},
): FieldDefinition {
  seq++;
  const base: FieldDefinition = {
    id,
    type,
    label: `${id} label`,
    required: false,
    columns: 12,
  };
  switch (type) {
    case 'dropdown':
    case 'multi-select':
    case 'radio':
    case 'checkbox-group':
      return {
        ...base,
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
          { label: 'C', value: 'c' },
        ],
        ...overrides,
      };
    case 'rating':
      return { ...base, max: 5, ...overrides };
    case 'slider':
      return { ...base, min: 0, max: 100, step: 1, ...overrides };
    default:
      return { ...base, ...overrides };
  }
}

/** Minimal valid form around the given fields. */
export function makeForm(
  fields: FieldDefinition[],
  dependencies: Dependency[] = [],
  overrides: Partial<FormDefinition> = {},
): FormDefinition {
  const now = new Date().toISOString();
  return {
    id: 'form-1',
    version: 1,
    status: 'draft',
    title: 'Test form',
    fields,
    dependencies,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** when(field).equals(value) → show(target) rule in raw JSON shape. */
export function showWhen(
  source: string,
  equals: unknown,
  target: string,
  ruleId = 'rule-1',
): Dependency {
  return {
    id: ruleId,
    target,
    when: {
      logic: 'AND',
      conditions: [{ field: source, operator: 'equals', value: equals }],
    },
    effects: [{ type: 'show' }],
  } as unknown as Dependency;
}

export function resetSeq(): void {
  seq = 0;
}
