import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import {
  FieldDefinition,
  FieldOption,
  FieldTypeRegistry,
} from '@n0n3br/ngx-dynamic-forms-core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { FormBuilderStore } from './form-builder-store';
import { RuleEditor } from './rule-editor';

const COLUMN_CHOICES = [
  { label: 'Full width', value: 12 },
  { label: '3/4', value: 9 },
  { label: 'Half', value: 6 },
  { label: 'Third', value: 4 },
  { label: 'Quarter', value: 3 },
];

/**
 * Right-hand inspector for the selected field.
 * Two tabs: "Properties" (type-aware config) and "Rules" (scoped
 * graphical rule editor — only rules that target this field).
 */
@Component({
  selector: 'ngx-property-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    SelectModule,
    CheckboxModule,
    TooltipModule,
    RuleEditor,
  ],
  templateUrl: './property-panel.html',
})
export class PropertyPanel {
  readonly store = inject(FormBuilderStore);
  private readonly registry = inject(FieldTypeRegistry);

  /** All rules of the form — the panel edits them through the scoped editor.
   * The model's generated `dependenciesChange` output propagates edits upward. */
  readonly dependencies = model.required<Dependency[]>();

  readonly tab = signal<'properties' | 'rules'>('properties');
  readonly columnChoices = COLUMN_CHOICES;

  readonly field = computed(() => this.store.selectedField());
  readonly meta = computed(() => {
    const f = this.field();
    return f ? this.registry.get(f.type) : undefined;
  });

  readonly supportsOptions = computed(() => this.meta()?.supportsOptions ?? false);
  readonly isNumeric = computed(
    () => !!this.field() && ['number', 'slider', 'rating'].includes(this.field()!.type),
  );
  readonly isTextual = computed(
    () => !!this.field() && ['text', 'textarea'].includes(this.field()!.type),
  );

  update(patch: Partial<FieldDefinition>): void {
    const id = this.field()?.id;
    if (id) this.store.updateField(id, patch);
  }

  addOption(): void {
    const current = this.field()?.options ?? [];
    this.update({
      options: [...current, { label: `Option ${current.length + 1}`, value: `opt${current.length + 1}` }],
    });
  }

  removeOption(index: number): void {
    const current = this.field()?.options ?? [];
    this.update({ options: current.filter((_, i) => i !== index) });
  }

  updateOptionLabel(index: number, label: string): void {
    const options = [...(this.field()?.options ?? [])];
    if (options[index]) {
      options[index] = { ...options[index], label };
      this.update({ options });
    }
  }

  updateOptionValue(index: number, rawValue: string): void {
    const options = [...(this.field()?.options ?? [])];
    if (options[index]) {
      const asNumber = Number(rawValue);
      const value =
        rawValue !== '' && Number.isFinite(asNumber) ? asNumber : rawValue;
      options[index] = { ...options[index], value };
      this.update({ options });
    }
  }

  onDependenciesChange(deps: Dependency[]): void {
    this.dependencies.set(deps);
  }
}
