import type { AbstractControl, FormGroup } from '@angular/forms';
import type { FieldDefinition, FormStep } from '../models/field-definition';

/**
 * Wizard helpers shared by the responder (stepper navigation) and the
 * builder (step management). All pure — no component state.
 */

/**
  * The step a field renders on: its explicit `stepId` when it matches one of
 * the form's steps, otherwise the FIRST step. Returns null when the form is
 * single-page (no steps) or the id list is empty.
 */
export function resolveFieldStepId(field: FieldDefinition, steps: FormStep[] | undefined): string | null {
  if (!steps || steps.length === 0) return null;
  return steps.some((s) => s.id === field.stepId) ? field.stepId! : steps[0].id;
}

/** Fields that render on `stepId`, preserving definition order. */
export function fieldsOfStep(
  fields: readonly FieldDefinition[],
  steps: FormStep[] | undefined,
  stepId: string,
): FieldDefinition[] {
  return fields.filter((f) => resolveFieldStepId(f, steps) === stepId);
}

/**
 * Visible + enabled controls of a step are all valid?
 * Sections hold no control; rule-hidden/disabled controls don't block.
 */
export function isStepFieldsValid(
  fields: readonly FieldDefinition[],
  steps: FormStep[] | undefined,
  stepId: string,
  group: FormGroup | null,
): boolean {
  if (!group) return false;
  const controls = collectStepControls(fields, steps, stepId, group);
  return controls.every((entry) => entry.control.disabled || entry.control.valid);
}

/** Marks every enabled control of the step touched; returns invalid labels' ids. */
export function invalidStepFieldIds(
  fields: readonly FieldDefinition[],
  steps: FormStep[] | undefined,
  stepId: string,
  group: FormGroup,
): string[] {
  return collectStepControls(fields, steps, stepId, group)
    .filter((entry) => entry.control.enabled && entry.control.invalid)
    .map((entry) => entry.field.id);
}

function collectStepControls(
  fields: readonly FieldDefinition[],
  steps: FormStep[] | undefined,
  stepId: string,
  group: FormGroup,
): Array<{ field: FieldDefinition; control: AbstractControl }> {
  const out: Array<{ field: FieldDefinition; control: AbstractControl }> = [];
  for (const field of fieldsOfStep(fields, steps, stepId)) {
    if (field.type === 'section') continue;
    const control = group.controls[field.id];
    if (control) out.push({ field, control });
  }
  return out;
}
