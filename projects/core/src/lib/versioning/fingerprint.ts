import { FormDefinition } from '../models/field-definition';

/** Keys that influence how an answer is produced or validated — everything else is cosmetic. */
const STRUCTURAL_FIELD_KEYS = [
  'id',
  'type',
  'required',
  'disabled',
  'defaultValue',
  'options',
  'min',
  'max',
  'step',
  'maxLength',
  'pattern',
] as const;

interface StructuralField {
  id: string;
  type: string;
  [key: string]: unknown;
}

function pickStructural(field: Record<string, unknown>): StructuralField {
  const out: Record<string, unknown> = {
    id: field['id'],
    type: field['type'],
  };
  for (const key of STRUCTURAL_FIELD_KEYS) {
    if (key === 'id' || key === 'type') continue;
    if (field[key] !== undefined) out[key] = field[key];
  }
  return out as StructuralField;
}

/** Deterministic JSON stringify — object keys sorted, arrays kept in order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function hash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (((h2 >>> 0) * 4294967296 + (h1 >>> 0)) >>> 0).toString(36);
}

/**
 * Semantic fingerprint of a definition: a stable hash over every property
 * that changes how answers are captured or validated.
 *
 * Excluded on purpose: label, placeholder, helpText, columns (layout width),
 * rows, title/description, timestamps, status, version.
 */
export function semanticFingerprint(def: FormDefinition): string {
  const fields = [...def.fields]
    .map((f) => f as unknown as Record<string, unknown>)
    .map(pickStructural)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return hash(
    stableStringify({
      fields,
      dependencies: def.dependencies,
    }),
  );
}

export type ChangeImpact = 'none' | 'cosmetic' | 'structural';

/** Hash over the non-semantic, user-visible surface (labels, help text, layout). */
function presentationFingerprint(def: FormDefinition): string {
  return hash(
    stableStringify({
      title: def.title,
      description: def.description,
      fields: [...def.fields]
        .map((f) => f as unknown as Record<string, unknown>)
        .sort((a, b) => String(a['id']).localeCompare(String(b['id']))),
      fieldOrder: def.fields.map((f) => f.id),
    }),
  );
}

/** Compares two definitions by fingerprint and classifies the difference. */
export function classifyChange(base: FormDefinition, next: FormDefinition): ChangeImpact {
  const structuralSame = semanticFingerprint(base) === semanticFingerprint(next);
  if (!structuralSame) return 'structural';
  return presentationFingerprint(base) === presentationFingerprint(next) ? 'none' : 'cosmetic';
}
