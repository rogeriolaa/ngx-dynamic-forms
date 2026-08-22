import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { FieldDefinition, FormDefinition, FormValues } from '../models/field-definition';

export interface BuiltForm {
  group: FormGroup;
  /** Fields disabled by design-time config — the engine must never enable these. */
  staticallyDisabled: Set<string>;
}

function validatorsFor(field: FieldDefinition): ValidatorFn[] {
  const validators: ValidatorFn[] = [];
  if (field.required) {
    if (field.type === 'checkbox') {
      validators.push(Validators.requiredTrue);
    } else {
      validators.push(Validators.required);
    }
  }
  switch (field.type) {
    case 'email':
      validators.push(Validators.email);
      break;
    case 'textarea':
      if (field.maxLength) validators.push(Validators.maxLength(field.maxLength));
      break;
    case 'text': {
      if (field.pattern) validators.push(Validators.pattern(field.pattern));
      if (field.maxLength) validators.push(Validators.maxLength(field.maxLength));
      break;
    }
    case 'number':
    case 'slider':
    case 'rating':
      if (field.min !== undefined) validators.push(Validators.min(field.min));
      if (field.max !== undefined) validators.push(Validators.max(field.max));
      break;
    default:
      break;
  }
  return validators;
}

/** Initial control value from configured default + per-type zero values. */
export function initialValueFor(field: FieldDefinition): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
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

/**
 * Builds a flat `FormGroup` keyed by field id. Section fields get no control
 * (they hold no value). Hidden fields DO get a control — their value can
 * drive dependency rules without ever being rendered.
 */
export function buildFormGroup(definition: FormDefinition): BuiltForm {
  const controls: Record<string, FormControl> = {};
  const staticallyDisabled = new Set<string>();

  for (const field of definition.fields) {
    if (field.type === 'section') continue;

    const control = new FormControl(
      { value: initialValueFor(field), disabled: !!field.disabled },
      validatorsFor(field),
    );
    if (field.disabled) staticallyDisabled.add(field.id);
    controls[field.id] = control;
  }

  return { group: new FormGroup(controls), staticallyDisabled };
}

const DATE_TYPES = new Set(['date']);

/**
 * Converts Date instances to ISO strings so values survive JSON persistence.
 * Empty values (`null`, `''`, `[]`) are omitted entirely — "no answer" must
 * not masquerade as data in drafts or merge reports.
 */
export function serializeValues(
  definition: FormDefinition,
  raw: FormValues,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of definition.fields) {
    const value = raw[field.id];
    if (value === undefined || field.type === 'section') continue;
    if (value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;

    out[field.id] = DATE_TYPES.has(field.type) && value instanceof Date
      ? value.toISOString()
      : value;
  }
  return out;
}

/** Inverse of {@link serializeValues} for drafts coming back from storage. */
export function deserializeValues(
  definition: FormDefinition,
  stored: FormValues | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of definition.fields) {
    const value = stored?.[field.id];
    if (value === undefined) continue;
    out[field.id] =
      DATE_TYPES.has(field.type) && typeof value === 'string' ? new Date(value) : value;
  }
  return out;
}
