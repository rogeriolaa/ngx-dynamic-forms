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

import { NdfIcon } from '@n0n3br/ngx-dynamic-forms-core';
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
    imports: [FormsModule, RuleEditor, NdfIcon],
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; }
    .panel-head {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.625rem 0.75rem;
      border-bottom: 1px solid var(--ndf-border);
    }
    :host-context(.app-dark) .panel-head { border-bottom-color: var(--ndf-border); }

    .panel-title { min-width: 0; flex: 1; }
    .panel-type { font-size: 0.8125rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .panel-id { font-size: 0.6875rem; color: var(--ndf-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .tab-row {
      display: flex; gap: 0.25rem;
      padding: 0.5rem 0.75rem 0;
      border-bottom: 1px solid var(--ndf-border);
    }
    :host-context(.app-dark) .tab-row { border-bottom-color: var(--ndf-border); }
    .tab-btn {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 4px 4px 0 0;
      padding: 0.35rem 0.75rem;
      font-size: 0.8125rem;
      cursor: pointer;
      color: var(--ndf-text-muted);
      transition: color 0.15s ease, border-color 0.15s ease;
    }
    .tab-btn:hover { color: var(--ndf-text); }
    .tab-btn.active {
      border-bottom-color: var(--p-primary-500);
      font-weight: 500;
      color: var(--p-primary-600);
    }
    :host-context(.app-dark) .tab-btn.active { color: var(--p-primary-400); }

    .panel-body { flex: 1; overflow-y: auto; padding: 0.75rem; }

    .prop-form { display: flex; flex-direction: column; gap: 0.75rem; }
    .field-label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--ndf-text-muted);
      margin-bottom: 0.25rem;
    }
    .flag-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; }
    .num-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
    .options-list { display: flex; flex-direction: column; gap: 0.375rem; }
    .mono { font-family: var(--p-font-mono, ui-monospace, monospace); }

    .options-block { margin-top: 0.25rem; }
    .options-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem; }
    .options-row { display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.375rem; }
  `,
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

  toNumber(value: unknown): number {
    return Number(value);
  }

  numOrNull(raw: string): number | undefined {
    if (raw === '' || raw === null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
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
