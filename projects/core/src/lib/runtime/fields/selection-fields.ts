import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../models/field-definition';
import { FieldShell } from './field-shell';@Component({
  selector: 'ngx-dropdown-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <select class="ndf-select" [id]="field().id" [formControl]="control()">
        <option [ngValue]="null" disabled>{{ field().placeholder ?? 'Select…' }}</option>
        @for (option of field().options ?? []; track option.value) {
          <option [ngValue]="option.value">{{ option.label }}</option>
        }
      </select>
    </ngx-field-shell>
  `,
})
export class DropdownField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}

@Component({
  selector: 'ngx-multi-select-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <select
        class="ndf-select"
        multiple
        [id]="field().id"
        [formControl]="control()"
        [style.height.rem]="Math.min((field().options?.length ?? 3) + 1, 6)"
      >
        @for (option of field().options ?? []; track option.value) {
          <option [ngValue]="option.value">{{ option.label }}</option>
        }
      </select>
    </ngx-field-shell>
  `,
})
export class MultiSelectField {
  /** exposed for the template */
  readonly Math = Math;

  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}

@Component({
  selector: 'ngx-radio-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .choice-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .choice-row { display: flex; align-items: center; gap: 0.5rem; }
    .choice-input { accent-color: var(--ndf-primary); cursor: pointer; }
    .choice-label { font-size: 0.875rem; cursor: pointer; color: var(--ndf-text); }
  `,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div class="choice-list">
        @for (option of field().options ?? []; track option.value) {
          <div class="choice-row">
            <input
              class="choice-input"
              type="radio"
              [name]="field().id"
              [value]="option.value"
              [id]="field().id + '-' + option.value"
              [formControl]="control()"
            />
            <label class="choice-label" [for]="field().id + '-' + option.value">
              {{ option.label }}
            </label>
          </div>
        }
      </div>
    </ngx-field-shell>
  `,
})
export class RadioField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}

@Component({
  selector: 'ngx-checkbox-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .single-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .hint { font-size: 0.875rem; color: var(--ndf-text); }
  `,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div class="single-row">
        <input class="ndf-checkbox" type="checkbox" [id]="field().id" [formControl]="control()" />
        @if (field().placeholder) {
          <span class="hint">{{ field().placeholder }}</span>
        }
      </div>
    </ngx-field-shell>
  `,
})
export class CheckboxField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}

@Component({
  selector: 'ngx-checkbox-group-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .group-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .group-row { display: flex; align-items: center; gap: 0.5rem; }
    .group-label { font-size: 0.875rem; cursor: pointer; color: var(--ndf-text); }
  `,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div class="group-list">
        @for (option of field().options ?? []; track option.value) {
          <div class="group-row">
            <input
              #box
              class="ndf-checkbox"
              type="checkbox"
              [id]="field().id + '-' + option.value"
              [checked]="isChecked(option.value)"
              (change)="toggle(option.value, box.checked)"
            />
            <label class="group-label" [for]="field().id + '-' + option.value">
              {{ option.label }}
            </label>
          </div>
        }
      </div>
    </ngx-field-shell>
  `,
})
export class CheckboxGroupField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();

  isChecked(value: string | number): boolean {
    return ((this.control().value ?? []) as Array<string | number>).includes(value);
  }

  toggle(value: string | number, checked: boolean): void {
    const current = ((this.control().value ?? []) as Array<string | number>);
    const next = checked ? [...current, value] : current.filter((v) => v !== value);
    this.control().setValue(next);
    this.control().markAsTouched();
  }
}
