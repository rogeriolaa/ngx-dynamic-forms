import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl } from '@angular/forms';
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
  styles: `
    .shell-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--p-text-color);
    }
    .shell-required {
      color: var(--p-red-500);
      margin-left: 2px;
    }
    .shell-control {
      margin-top: 0.375rem;
    }
    .shell-help {
      margin: 0.25rem 0 0;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }
    .shell-error {
      margin: 0.25rem 0 0;
      font-size: 0.75rem;
      color: var(--p-red-500);
    }
  `,
  template: `
    <label class="shell-label" [for]="field().id">
      {{ field().label || field().id }}
      @if (field().required && field().type !== 'checkbox') {
        <span class="shell-required">*</span>
      }
    </label>

    <div class="shell-control">
      <ng-content />
    </div>

    @if (help(); as helpText) {
      <p class="shell-help">{{ helpText }}</p>
    }

    @if (errorMessage(); as message) {
      <p class="shell-error" role="alert" [id]="field().id + '-error'">{{ message }}</p>
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
