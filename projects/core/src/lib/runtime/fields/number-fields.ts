import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../models/field-definition';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { SliderModule } from 'primeng/slider';
import { FieldShell } from './field-shell';

@Component({
  selector: 'ngx-number-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule, InputNumberModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <p-inputnumber
        [inputId]="field().id"
        class="w-full"
        [min]="field().min"
        [max]="field().max"
        [step]="field().step ?? 1"
        [formControl]="control()"
        [useGrouping]="false"
      />
    </ngx-field-shell>
  `,
})
export class NumberField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}

@Component({
  selector: 'ngx-date-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule, DatePickerModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <p-datepicker
        [inputId]="field().id"
        class="w-full"
        [showIcon]="true"
        [dateFormat]="'yy-mm-dd'"
        [formControl]="control()"
        [placeholder]="field().placeholder ?? ''"
      />
    </ngx-field-shell>
  `,
})
export class DateField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}

@Component({
  selector: 'ngx-slider-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule, SliderModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div class="flex items-center gap-4">
        <p-slider
          class="w-full"
          [range]="false"
          [min]="field().min ?? 0"
          [max]="field().max ?? 100"
          [step]="field().step ?? 1"
          [formControl]="control()"
        />
        <span class="w-12 text-right text-sm tabular-nums text-surface-600">
          {{ control().value ?? '–' }}
        </span>
      </div>
    </ngx-field-shell>
  `,
})
export class SliderField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}

@Component({
  selector: 'ngx-rating-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div
        class="flex gap-1"
        role="radiogroup"
        [attr.aria-label]="field().label"
      >
        @for (star of stars(); track star) {
          <button
            type="button"
            class="border-none bg-transparent p-0 text-2xl leading-none cursor-pointer transition-colors"
            [class.text-amber-400]="(control().value ?? 0) >= star"
            [class.text-surface-300]="(control().value ?? 0) < star"
            (click)="select(star)"
            [attr.aria-checked]="control().value === star"
            role="radio"
          >
            ★
          </button>
        }
      </div>
    </ngx-field-shell>
  `,
})
export class RatingField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();

  readonly stars = computed(() => {
    const max = this.field().max ?? 5;
    return Array.from({ length: Math.max(1, max) }, (_, i) => i + 1);
  });

  select(star: number): void {
    if (this.control().disabled) return;
    // clicking the current value clears it
    this.control().setValue(this.control().value === star ? null : star);
    this.control().markAsTouched();
  }
}
