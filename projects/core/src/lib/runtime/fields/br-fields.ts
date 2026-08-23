import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../models/field-definition';
import { formatCep, formatCnpj, formatCpf } from '../../validation/br-validators';
import { FieldShell } from './field-shell';

/**
 * Brazilian document/ZIP inputs. Values persist in DISPLAY form
 * (000.000.000-00 etc.) — human-readable everywhere, and the validators
 * strip punctuation before checking check-digits.
 */

@Component({
  selector: 'ngx-cpf-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <input
        class="ndf-input"
        [id]="field().id"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="14"
        placeholder="000.000.000-00"
        [formControl]="control()"
        (input)="mask(formatCpf($any($event.target).value))"
      />
    </ngx-field-shell>
  `,
})
export class CpfField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
  protected readonly formatCpf = formatCpf;

  mask(formatted: string): void {
    this.control().setValue(formatted);
  }
}

@Component({
  selector: 'ngx-cnpj-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <input
        class="ndf-input"
        [id]="field().id"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="18"
        placeholder="00.000.000/0000-00"
        [formControl]="control()"
        (input)="mask(formatCnpj($any($event.target).value))"
      />
    </ngx-field-shell>
  `,
})
export class CnpjField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
  protected readonly formatCnpj = formatCnpj;

  mask(formatted: string): void {
    this.control().setValue(formatted);
  }
}

@Component({
  selector: 'ngx-cep-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <input
        class="ndf-input"
        [id]="field().id"
        type="text"
        inputmode="numeric"
        autocomplete="postal-code"
        maxlength="9"
        placeholder="00000-000"
        [formControl]="control()"
        (input)="mask(formatCep($any($event.target).value))"
      />
    </ngx-field-shell>
  `,
})
export class CepField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
  protected readonly formatCep = formatCep;

  mask(formatted: string): void {
    this.control().setValue(formatted);
  }
}
