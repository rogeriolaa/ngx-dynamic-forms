import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../models/field-definition';
import { FieldShell } from './field-shell';

@Component({
  selector: 'ngx-number-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <input
        class="ndf-input"
        [id]="field().id"
        type="number"
        [min]="field().min ?? null"
        [max]="field().max ?? null"
        [step]="field().step ?? 1"
        [formControl]="control()"
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
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <input
        class="ndf-input"
        [id]="field().id"
        type="date"
        [formControl]="control()"
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
  styles: `
    .slider-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 0.5rem;
    }
    input[type='range'] {
      flex: 1;
      accent-color: var(--ndf-primary);
    }
    .slider-value {
      min-width: 3rem;
      text-align: right;
      font-size: 0.875rem;
      font-variant-numeric: tabular-nums;
      color: var(--ndf-text-muted);
    }
  `,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div class="slider-row">
        <input
          type="range"
          [id]="field().id"
          [min]="field().min ?? 0"
          [max]="field().max ?? 100"
          [step]="field().step ?? 1"
          [formControl]="control()"
        />
        <span class="slider-value">{{ control().value ?? '–' }}</span>
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
  styles: `
    :host { display: block; }
    .stars {
      display: flex;
      gap: 0.25rem;
      margin-top: 0.5rem;
    }
    .star-btn {
      border: none;
      background: transparent;
      padding: 0;
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
      color: var(--ndf-border-strong);
      transition: color 0.15s ease;
    }
    .star-btn.on {
      color: var(--ndf-warning);
    }
    .star-btn:disabled { cursor: default; }
  `,
  imports: [FieldShell],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <div class="stars" role="radiogroup" [attr.aria-label]="field().label">
        @for (star of stars(); track star) {
          <button
            type="button"
            class="star-btn"
            [class.on]="(control().value ?? 0) >= star"
            (click)="select(star)"
            role="radio"
            [attr.aria-checked]="control().value === star"
            [disabled]="control().disabled"
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
