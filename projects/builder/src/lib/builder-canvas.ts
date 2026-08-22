import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  FieldDefinition,
  FieldTypeRegistry,
  computeDependencyDepths,
} from '@n0n3br/ngx-dynamic-forms-core';
import { NdfIcon } from '@n0n3br/ngx-dynamic-forms-core';
import { FormBuilderStore } from './form-builder-store';

interface CanvasRow {
  field: FieldDefinition;
  icon: string;
  typeLabel: string;
  depth: number;
}

/**
 * Design surface: one card per field, ordered top-to-bottom.
 * Dependent fields are indented under the fields they depend on
 * (depth = longest dependency chain) with a guide line, so conditional
 * structure is visible at a glance.
 */
@Component({
  selector: 'ngx-builder-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: block; }
    .canvas { display: flex; flex-direction: column; gap: 0.5rem; }
    .canvas-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      text-align: center;
      padding: 2.5rem 1rem;
      border: 2px dashed var(--ndf-border-strong);
      border-radius: 12px;
    }
    :host-context(.app-dark) .canvas-empty { border-color: var(--ndf-border); }
    .canvas-empty i { font-size: 1.75rem; color: var(--ndf-border-strong); }
    .canvas-empty p { margin: 0; }

    .field-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--ndf-border);
      background: var(--p-surface-0);
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    :host-context(.app-dark) .field-card {
      background: var(--ndf-surface);
      border-color: var(--ndf-border);
    }
    .field-card:hover {
      border-color: var(--p-primary-300);
      background: color-mix(in srgb, var(--p-primary-500) 5%, transparent);
    }
    .field-card.selected {
      border: 2px solid var(--p-primary-400);
      background: color-mix(in srgb, var(--p-primary-500) 10%, transparent);
    }
    .field-card.is-hidden { border-style: dashed; opacity: 0.8; }

    .depth-guide {
      width: 4px;
      min-height: 2rem;
      border-radius: 2px;
      flex-shrink: 0;
      background: color-mix(in srgb, var(--p-primary-500) 45%, transparent);
    }

    .field-icon { font-size: 1rem; color: var(--p-primary-500); }
    .field-main { min-width: 0; flex: 1; }
    .field-name {
      font-size: 0.875rem;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .field-name .untitled { font-weight: 400; font-style: italic; color: var(--ndf-text-faint); }
    .field-required-star { color: var(--ndf-danger); }
    .field-sub { font-size: 0.6875rem; color: var(--ndf-text-muted); display: flex; align-items: center; gap: 0.375rem; }

    .badge {
      display: inline-block;
      padding: 0 0.4rem;
      border-radius: 999px;
      font-size: 0.625rem;
      font-weight: 600;
    }
    .badge-conditional {
      background: color-mix(in srgb, var(--p-primary-500) 15%, transparent);
      color: var(--p-primary-600);
    }
    :host-context(.app-dark) .badge-conditional { color: var(--p-primary-300); }
    .badge-hidden {
      background: var(--ndf-border);
      color: var(--ndf-text-muted);
    }
    :host-context(.app-dark) .badge-hidden { background: var(--ndf-border); }

    .card-tools { display: flex; gap: 0.125rem; opacity: 0; transition: opacity 0.15s ease; }
    .field-card:hover .card-tools { opacity: 1; }
    .card-tool {
      display: inline-flex;
      border: none;
      background: transparent;
      padding: 0.25rem;
      border-radius: 6px;
      cursor: pointer;
      color: var(--ndf-text-muted);
    }
    .card-tool:hover { background: var(--ndf-surface-alt); color: var(--ndf-text); }
  `,
  imports: [NdfIcon],
  template: `
    @if (store.definition(); as def) {
      <div class="canvas" data-testid="builder-canvas">
        @if (rows().length === 0) {
          <div class="canvas-empty">
            <ndf-icon name="plus" style="--ndf-icon-size:1.75rem" />
            <p style="font-size: 0.875rem; font-weight: 500">Empty canvas</p>
            <p style="font-size: 0.75rem; color: var(--ndf-text-muted)">
              Add fields from the palette to start designing your form.
            </p>
          </div>
        }

        @for (row of rows(); track row.field.id) {
          <div
            class="field-card"
            [class.selected]="isSelected(row.field.id)"
            [class.is-hidden]="row.field.type === 'hidden'"
            [style.marginLeft.rem]="row.depth * 1.5"
            [attr.data-testid]="'canvas-field-' + row.field.id"
            [attr.data-depth]="row.depth"
            (click)="store.select(row.field.id)"
          >
            @if (row.depth > 0) {
              <div
                class="depth-guide"
                [title]="'Depends on: ' + parentsOf(row.field.id)"
              ></div>
            }

            <ndf-icon class="field-icon" [name]="iconName(row.icon)" />

            <div class="field-main">
              <div class="field-name">
                {{ row.field.label || row.field.id }}
                @if (!row.field.label) {
                  <span class="untitled">(untitled)</span>
                }
                @if (row.field.required) {
                  <span class="field-required-star">*</span>
                }
              </div>
              <div class="field-sub">
                {{ row.typeLabel }}
                @if (row.depth > 0) {
                  <span class="badge badge-conditional">conditional</span>
                }
                @if (row.field.type === 'hidden') {
                  <span class="badge badge-hidden">hidden</span>
                }
              </div>
            </div>

            <div class="card-tools">
              <button type="button" class="card-tool" title="Move up" (click)="store.move(row.field.id, -1); $event.stopPropagation()">
                <ndf-icon name="arrow-up" />
              </button>
              <button type="button" class="card-tool" title="Move down" (click)="store.move(row.field.id, 1); $event.stopPropagation()">
                <ndf-icon name="arrow-down" />
              </button>
              <button type="button" class="card-tool" title="Duplicate" (click)="store.duplicateField(row.field.id); $event.stopPropagation()">
                <ndf-icon name="copy" />
              </button>
              <button type="button" class="card-tool" title="Delete field" (click)="store.removeField(row.field.id); $event.stopPropagation()">
                <ndf-icon name="trash" />
              </button>
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

  readonly rows = computed<CanvasRow[]>(() => {
    const def = this.store.definition();
    if (!def) return [];
    const depths = computeDependencyDepths(def.fields, def.dependencies);
    return def.fields.map((field) => ({
      field,
      icon: this.registry.get(field.type)?.icon ?? 'pi pi-question',
      typeLabel: this.registry.get(field.type)?.label ?? field.type,
      depth: depths.get(field.id) ?? 0,
    }));
  });

  /** Registry stores bare icon names; strip legacy "pi pi-" prefixes if present */
  iconName(iconClass: string): string {
    return iconClass.replace('pi pi-', '');
  }

  isSelected(id: string): boolean {
    return this.store.selectedFieldId() === id;
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
