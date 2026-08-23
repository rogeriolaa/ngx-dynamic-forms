import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../models/field-definition';
import { EmailField, TextareaField, TextField } from './text-fields';
import {
  CheckboxField,
  CheckboxGroupField,
  DropdownField,
  MultiSelectField,
  RadioField,
} from './selection-fields';
import { DateField, NumberField, RatingField, SliderField } from './number-fields';
import { CepField, CnpjField, CpfField } from './br-fields';

/**
 * Renders the right control for a field definition. Layout (`section`)
 * fields render their header; unknown types render a safe placeholder so
 * historical definitions never break newer viewers.
 */
@Component({
  selector: 'ngx-field-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TextField,
    EmailField,
    TextareaField,
    NumberField,
    DateField,
    SliderField,
    RatingField,
    DropdownField,
    MultiSelectField,
    RadioField,
    CheckboxField,
    CheckboxGroupField,
    CpfField,
    CnpjField,
    CepField,
  ],
  template: `
    @switch (field().type) {
      @case ('text') {
        <ngx-text-field [field]="field()" [control]="control()" />
      }
      @case ('email') {
        <ngx-email-field [field]="field()" [control]="control()" />
      }
      @case ('textarea') {
        <ngx-textarea-field [field]="field()" [control]="control()" />
      }
      @case ('number') {
        <ngx-number-field [field]="field()" [control]="control()" />
      }
      @case ('date') {
        <ngx-date-field [field]="field()" [control]="control()" />
      }
      @case ('slider') {
        <ngx-slider-field [field]="field()" [control]="control()" />
      }
      @case ('rating') {
        <ngx-rating-field [field]="field()" [control]="control()" />
      }
      @case ('cpf') {
        <ngx-cpf-field [field]="field()" [control]="control()" />
      }
      @case ('cnpj') {
        <ngx-cnpj-field [field]="field()" [control]="control()" />
      }
      @case ('cep') {
        <ngx-cep-field [field]="field()" [control]="control()" />
      }
      @case ('dropdown') {
        <ngx-dropdown-field [field]="field()" [control]="control()" />
      }
      @case ('multi-select') {
        <ngx-multi-select-field [field]="field()" [control]="control()" />
      }
      @case ('radio') {
        <ngx-radio-field [field]="field()" [control]="control()" />
      }
      @case ('checkbox') {
        <ngx-checkbox-field [field]="field()" [control]="control()" />
      }
      @case ('checkbox-group') {
        <ngx-checkbox-group-field [field]="field()" [control]="control()" />
      }
      @default {
        <div class="unsupported">
          Field "{{ field().id }}" has unsupported type "{{ field().type }}". Its value is kept
          but cannot be edited here.
        </div>
      }
    }
  `,
  styles: `
    .unsupported {
      border: 1px solid var(--p-amber-300);
      background: var(--p-amber-50);
      color: var(--p-amber-700);
      border-radius: 6px;
      padding: 0.75rem;
      font-size: 0.875rem;
    }
    :host { display: block; }
  `,
})
export class FieldHost {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}
