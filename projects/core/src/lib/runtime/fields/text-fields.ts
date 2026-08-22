import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../models/field-definition';
import { FieldShell } from './field-shell';

/**
 * One component per field type. Every component:
 * - receives `field` + `control` inputs (no CVA boilerplate needed)
 * - delegates chrome to `ngx-field-shell` via projection
 * - binds native elements styled through the shared `ndf-*` classes
 */

@Component({
  selector: 'ngx-text-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <input
        class="ndf-input"
        [id]="field().id"
        type="text"
        [placeholder]="field().placeholder ?? ''"
        [formControl]="control()"
      />
    </ngx-field-shell>
  `,
})
export class TextField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}

@Component({
  selector: 'ngx-email-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <input
        class="ndf-input"
        [id]="field().id"
        type="email"
        placeholder="name@example.com"
        [formControl]="control()"
      />
    </ngx-field-shell>
  `,
})
export class EmailField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}

@Component({
  selector: 'ngx-textarea-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldShell, ReactiveFormsModule],
  template: `
    <ngx-field-shell [field]="field()" [control]="control()">
      <textarea
        class="ndf-textarea"
        [id]="field().id"
        [rows]="field().rows ?? 4"
        [placeholder]="field().placeholder ?? ''"
        [formControl]="control()"
      ></textarea>
    </ngx-field-shell>
  `,
})
export class TextareaField {
  readonly field = input.required<FieldDefinition>();
  readonly control = input.required<FormControl>();
}
