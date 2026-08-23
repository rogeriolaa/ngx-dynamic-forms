import type { FieldDefinition, FieldOption } from '../models/field-definition';

/**
 * Human-readable rendering of an answer value — shared by the demo
 * responses table, CSV export and the form viewer.
 */
export function formatValue(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';

  switch (field.type) {
    case 'checkbox':
      return value === true ? 'Yes' : 'No';
    case 'multi-select':
    case 'checkbox-group': {
      const selected = Array.isArray(value) ? value : [];
      if (selected.length === 0) return '—';
      return selected.map((v) => labelFor(field, v)).join(', ');
    }
    case 'radio':
    case 'dropdown':
      return labelFor(field, value);
    case 'rating': {
      const n = Math.max(0, Math.min(Number(value), field.max ?? 5));
      return '★'.repeat(n) + '☆'.repeat(Math.max(0, (field.max ?? 5) - n));
    }
    case 'date':
      return typeof value === 'string' ? new Date(value).toLocaleDateString() : String(value);
    case 'signature':
      return typeof value === 'string' && value.startsWith('data:image') ? 'Signed' : '—';
    case 'file-upload':
      return (value as { name?: string } | null)?.name ?? 'Attached file';
    default:
      return String(value);
  }
}

/** Option label when the value matches one, else the raw value as text. */
export function labelFor(field: FieldDefinition, rawValue: unknown): string {
  const option = (field.options ?? []).find((o: FieldOption) => o.value === rawValue);
  return option?.label ?? String(rawValue);
}
