import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FieldDefinition } from '../../models/field-definition';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { FieldShell } from './field-shell';

@Component({
  selector: 'ngx-dropdown-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule, SelectModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <p-select
        [inputId]="field().id"
        class="w-full"
        [options]="field().options ?? []"
        optionLabel="label"
        optionValue="value"
        [placeholder]="field().placeholder ?? 'Select…'"
        [formControl]="control()"
      />
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
  imports: [FieldShell, ReactiveFormsModule, MultiSelectModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <p-multiselect
        [inputId]="field().id"
        class="w-full"
        [options]="field().options ?? []"
        optionLabel="label"
        optionValue="value"
        [placeholder]="field().placeholder ?? 'Choose…'"
        [formControl]="control()"
        [showToggleAll]="true"
      />
    </ngx-field-shell>
  `,
})
export class MultiSelectField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}

@Component({
  selector: 'ngx-radio-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule, RadioButtonModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div class="flex flex-col gap-2">
        @for (option of field().options ?? []; track option.value) {
          <div class="flex items-center gap-2">
            <p-radiobutton
              [name]="field().id"
              [value]="option.value"
              [inputId]="field().id + '-' + option.value"
              [formControl]="control()"
            />
            <label [for]="field().id + '-' + option.value" class="text-sm cursor-pointer">
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
  imports: [FieldShell, ReactiveFormsModule, CheckboxModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div class="flex items-center gap-2">
        <p-checkbox [binary]="true" [inputId]="field().id" [formControl]="control()" />
        @if (field().placeholder) {
          <span class="text-sm">{{ field().placeholder }}</span>
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
  imports: [FieldShell, ReactiveFormsModule, FormsModule, CheckboxModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div class="flex flex-col gap-2">
        @for (option of field().options ?? []; track option.value) {
          <div class="flex items-center gap-2">
            <p-checkbox
              [binary]="true"
              [inputId]="field().id + '-' + option.value"
              [ngModel]="isChecked(option.value)"
              [ngModelOptions]="{ standalone: true }"
              (ngModelChange)="toggle(option.value, $event)"
            />
            <label
              [for]="field().id + '-' + option.value"
              class="text-sm cursor-pointer"
            >
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
