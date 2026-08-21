import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FieldDefinition,
  FieldTypeRegistry,
  computeDependencyDepths,
} from '@n0n3br/ngx-dynamic-forms-core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormBuilderStore } from './form-builder-store';

/**
 * Design surface: one card per field, ordered top-to-bottom.
 * Dependent fields are indented under the fields they depend on
 * (depth = longest dependency chain), so conditional structure is visible
 * at a glance without reading any rules.
 */
@Component({
  selector: 'ngx-builder-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonModule, TooltipModule],
  template: `
    @if (store.definition(); as def) {
      <div class="flex flex-col gap-2" data-testid="builder-canvas">
        @if (rows().length === 0) {
          <div class="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-surface-300 p-10 text-center dark:border-surface-700">
            <i class="pi pi-plus-circle text-3xl text-surface-300"></i>
            <p class="mb-0 mt-0 text-sm font-medium">Empty canvas</p>
            <p class="m-0 text-xs text-surface-500">
              Add fields from the palette to start designing your form.
            </p>
          </div>
        }

        @for (row of rows(); track row.field.id) {
          <div
            class="group flex items-center gap-3 rounded-lg border p-3 transition-colors"
            [class]="cardClasses(row)"
            [style.marginLeft.rem]="row.depth * 1.5"
            [attr.data-testid]="'canvas-field-' + row.field.id"
            [attr.data-depth]="row.depth"
            (click)="store.select(row.field.id)"
          >
            <!-- indent guide line for dependent fields -->
            @if (row.depth > 0) {
              <div class="h-full min-h-8 w-1 shrink-0 rounded bg-primary-300 dark:bg-primary-600"
                   pTooltip="Depends on: {{ parentsOf(row.field.id) }}"
                   tooltipPosition="top"></div>
            }

            <i [class]="row.meta.icon + ' text-lg'" [class.text-surface-400]="!isSelected(row.field.id)"></i>

            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">
                {{ row.field.label || row.field.id }}
                @if (!row.field.label) {
                  <span class="font-normal italic text-surface-400">(untitled)</span>
                }
                @if (row.field.required) {
                  <span class="text-red-500">*</span>
                }
              </div>
              <div class="text-xs text-surface-400">
                {{ row.meta.label }}
                @if (row.depth > 0) {
                  <span class="ml-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                    conditional
                  </span>
                }
                @if (row.field.type === 'hidden') {
                  <span class="ml-1 rounded-full bg-surface-200 px-1.5 py-0.5 text-[10px] dark:bg-surface-700">
                    hidden
                  </span>
                }
              </div>
            </div>

            <div class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <p-button
                icon="pi pi-arrow-up"
                variant="text"
                size="small"
                severity="secondary"
                [rounded]="true"
                pTooltip="Move up"
                (onClick)="store.move(row.field.id, -1); $event.stopPropagation()"
              />
              <p-button
                icon="pi pi-arrow-down"
                variant="text"
                size="small"
                severity="secondary"
                [rounded]="true"
                pTooltip="Move down"
                (onClick)="store.move(row.field.id, 1); $event.stopPropagation()"
              />
              <p-button
                icon="pi pi-copy"
                variant="text"
                size="small"
                severity="secondary"
                [rounded]="true"
                pTooltip="Duplicate"
                (onClick)="store.duplicateField(row.field.id); $event.stopPropagation()"
              />
              <p-button
                icon="pi pi-trash"
                variant="text"
                size="small"
                severity="danger"
                [rounded]="true"
                pTooltip="Delete field"
                [attr.data-testid]="'delete-' + row.field.id"
                (onClick)="store.removeField(row.field.id); $event.stopPropagation()"
              />
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class BuilderCanvas {
  readonly store = inject(FormBuilderStore);
  private readonly registry = inject(FieldTypeRegistry);

  /** Canvas rows sorted by definition order with computed dependency depth. */
  readonly rows = computed<
    Array<{ field: FieldDefinition; meta: { icon: string; label: string }; depth: number }>
  >(() => {
    const def = this.store.definition();
    if (!def) return [];
    const depths = computeDependencyDepths(def.fields, def.dependencies);
    return def.fields.map((field) => ({
      field,
      meta:
        this.registry.get(field.type) ??
        { icon: 'pi pi-question', label: field.type },
      depth: depths.get(field.id) ?? 0,
    }));
  });

  isSelected(id: string): boolean {
    return this.store.selectedFieldId() === id;
  }

  cardClasses(row: {
    field: FieldDefinition;
    depth: number;
  }): Record<string, boolean> {
    const selected = this.isSelected(row.field.id);
    return {
      'cursor-pointer border-surface-200 hover:border-primary-300 hover:bg-primary-50/40 dark:border-surface-700 dark:hover:border-primary-600 dark:hover:bg-primary-950/40':
        !selected,
      'border-2 border-primary-400 bg-primary-50/60 dark:border-primary-500 dark:bg-primary-950/40':
        selected,
      'border border-dashed opacity-75': row.field.type === 'hidden',
    };
  }

  parentsOf(fieldId: string): string {
    const def = this.store.definition();
    if (!def) return '';
    const names = new Set<string>();
    for (const dep of def.dependencies) {
      if (dep.target !== fieldId) continue;
      JSON.stringify(dep.when, (key, value) => {
        if (key === 'field' && typeof value === 'string') {
          const f = def.fields.find((x) => x.id === value);
          names.add(f?.label || value);
        }
        return value;
      });
    }
    return [...names].join(', ');
  }
}
