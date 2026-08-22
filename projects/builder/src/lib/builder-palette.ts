import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FieldTypeRegistry } from '@n0n3br/ngx-dynamic-forms-core';
import { NdfIcon } from '@n0n3br/ngx-dynamic-forms-core';
import { FormBuilderStore } from './form-builder-store';

/** Palette grouped by category: Inputs / Layout / Hidden. */
@Component({
  selector: 'ngx-builder-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .palette-group { margin-bottom: 1rem; }
    .palette-title {
      margin: 0 0 0.5rem;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--ndf-text-muted);
    }
    .palette-list { display: flex; flex-direction: column; gap: 0.375rem; }
    .palette-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      text-align: left;
      padding: 0.5rem 0.625rem;
      font-size: 0.875rem;
      border-radius: 6px;
      border: 1px solid var(--ndf-border);
      background: var(--p-surface-0);
      color: var(--ndf-text);
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    :host-context(.app-dark) .palette-item {
      background: var(--ndf-surface);
      border-color: var(--ndf-border);
    }
    .palette-item:hover {
      border-color: var(--p-primary-400);
      background: color-mix(in srgb, var(--p-primary-500) 8%, transparent);
    }
    .palette-icon { width: 1rem; text-align: center; color: var(--p-primary-500); }
    .palette-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
  imports: [NdfIcon],
  template: `
    @for (group of groups(); track group.category) {
      <div class="palette-group">
        <p class="palette-title">{{ group.title }}</p>
        <div class="palette-list">
          @for (meta of group.items; track meta.type) {
            <button
              type="button"
              class="palette-item"
              [title]="'Add ' + meta.label"
              [attr.data-testid]="'palette-' + meta.type"
              (click)="store.addField(meta.type, meta)"
            >
              <ndf-icon class="palette-icon" [name]="meta.icon" />
              <span class="palette-label">{{ meta.label }}</span>
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class BuilderPalette {
  readonly store = inject(FormBuilderStore);
  private readonly registry = inject(FieldTypeRegistry);

  readonly groups = computed(() => {
    const all = this.registry.all();
    const byCategory = new Map<string, typeof all>();
    for (const meta of all) {
      if (!byCategory.has(meta.category)) byCategory.set(meta.category, []);
      byCategory.get(meta.category)!.push(meta);
    }
    const titles: Record<string, string> = {
      input: 'Input fields',
      layout: 'Layout',
      static: 'Static content',
      hidden: 'Hidden fields',
    };
    return [...byCategory.entries()].map(([category, items]) => ({
      category,
      title: titles[category] ?? category,
      items,
    }));
  });
}
