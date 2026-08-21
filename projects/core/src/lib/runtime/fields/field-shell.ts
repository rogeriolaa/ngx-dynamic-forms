import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../models/field-definition';

const MESSAGES: Record<string, string> = {
  required: 'This field is required.',
  email: 'Enter a valid email address.',
  maxlength: 'Value is too long.',
  minlength: 'Value is too short.',
  min: 'Value is below the minimum.',
  max: 'Value is above the maximum.',
  pattern: 'Value does not match the expected format.',
};

/**
 * Shared label / help / error chrome around every answer control.
 * The projected content is the actual input; error display reacts to the
 * control's touched+invalid state.
 */
@Component({
  selector: 'ngx-field-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <label [for]="field().id" class="block text-sm font-medium text-surface-700 dark:text-surface-200">
      {{ field().label || field().id }}
      @if (field().required && field().type !== 'checkbox') {
        <span class="text-red-500">*</span>
      }
    </label>

    <div class="mt-1.5">
      <ng-content />
    </div>

    @if (help()) {
      <p class="mt-1 text-xs text-surface-500">{{ help() }}</p>
    }

    @if (errorMessage(); as message) {
      <p class="mt-1 text-xs text-red-600" role="alert" [id]="field().id + '-error'">
        {{ message }}
      </p>
    }
  `,
})
export class FieldShell {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();

  readonly help = computed(() => this.field().helpText ?? '');

  readonly errorMessage = computed(() => {
    const control = this.control();
    if (!control.touched || !control.errors) return null;
    const firstKey = Object.keys(control.errors)[0];
    return (
      MESSAGES[firstKey] ??
      (typeof control.errors[firstKey] === 'string' ? control.errors[firstKey] : 'Invalid value.')
    );
  });
}

/** Convenience accessor used by every concrete field to grab its shell context. */
export function shellField(): FieldDefinition {
  return inject(FieldShell).field();
}
