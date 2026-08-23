import { FieldDefinition, FormDefinition, FormValues } from '../models/field-definition';

export interface DraftMergeReport {
  /** Field ids whose draft value was carried over. */
  restored: string[];
  /** New fields that received their configured default. */
  defaulted: string[];
  /** Values dropped because the field no longer exists (or type changed incompatibly). */
  dropped: Array<{ fieldId: string; value: unknown }>;
}

const NUMERIC_TYPES = new Set(['number', 'rating', 'slider']);
const MULTI_VALUE_TYPES = new Set(['multi-select', 'checkbox-group']);

function isCompatible(field: FieldDefinition, value: unknown): boolean {
  if (value === undefined) return false;
  if (NUMERIC_TYPES.has(field.type)) return typeof value === 'number' && Number.isFinite(value);
  if (MULTI_VALUE_TYPES.has(field.type)) return Array.isArray(value);
  if (field.type === 'checkbox') return typeof value === 'boolean';
  if (field.type === 'date') return typeof value === 'string' || value instanceof Date;
  if (field.type === 'file-upload') {
    return (
      !!value &&
      typeof value === 'object' &&
      typeof (value as { dataUrl?: unknown }).dataUrl === 'string'
    );
  }
  if (field.type === 'signature') {
    return typeof value === 'string' && value.startsWith('data:image');
  }
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Merges stored answer/draft values into a (possibly newer) definition,
 * matching strictly by stable field `id`:
 * - surviving fields keep their value when type-compatible
 * - new fields get their configured default
 * - anything else is reported as dropped so the UI can warn the user
 */
export function mergeDraftValues(
  values: FormValues | null | undefined,
  definition: FormDefinition,
): { values: FormValues; report: DraftMergeReport } {
  const report: DraftMergeReport = { restored: [], defaulted: [], dropped: [] };
  const merged: FormValues = {};

  for (const field of definition.fields) {
    const previous = values?.[field.id];

    if (
      field.type !== 'section' &&
      isCompatible(field, previous) &&
      !(previous === '' && field.required)
    ) {
      merged[field.id] = previous;
      report.restored.push(field.id);
    } else {
      if (previous !== undefined) {
        report.dropped.push({ fieldId: field.id, value: previous });
      }
      if (field.defaultValue !== undefined) {
        merged[field.id] = field.defaultValue;
        // only count as "defaulted" when it's genuinely a fresh fill-in
        if (!report.restored.includes(field.id) && previous === undefined) {
          report.defaulted.push(field.id);
        }
      } else if (field.type !== 'section') {
        merged[field.id] = multiDefault(field);
      }
    }
  }

  const knownIds = new Set(definition.fields.map((f) => f.id));

  // Values whose field no longer exists are reported as dropped.
  if (values) {
    for (const [key, value] of Object.entries(values)) {
      if (!knownIds.has(key)) {
        report.dropped.push({ fieldId: key, value });
      }
    }
  }

  return { values: merged, report };
}

function multiDefault(field: FieldDefinition): unknown {
  switch (field.type) {
    case 'checkbox':
      return false;
    case 'multi-select':
    case 'checkbox-group':
      return [];
    default:
      return null;
  }
}
