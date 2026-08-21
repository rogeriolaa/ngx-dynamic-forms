import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FieldTypeRegistry } from '@n0n3br/ngx-dynamic-forms-core';
import { TooltipModule } from 'primeng/tooltip';
import { FormBuilderStore } from './form-builder-store';

/** Palette grouped by category: Inputs / Layout / Hidden. */
@Component({
  selector: 'ngx-builder-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipModule],
  template: `
    @for (group of groups(); track group.category) {
      <div class="mb-4">
        <p class="mb-2 mt-0 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
          {{ group.title }}
        </p>
        <div class="grid grid-cols-1 gap-1.5">
          @for (meta of group.items; track meta.type) {
            <button
              type="button"
              class="flex cursor-pointer items-center gap-2 rounded-md border border-surface-200 bg-surface-0 px-2.5 py-2 text-left text-sm transition-colors hover:border-primary-400 hover:bg-primary-50 dark:border-surface-700 dark:bg-surface-900 dark:hover:border-primary-600 dark:hover:bg-primary-950"
              [pTooltip]="'Add ' + meta.label"
              tooltipPosition="right"
              [attr.data-testid]="'palette-' + meta.type"
              (click)="store.addField(meta.type, meta)"
            >
              <i [class]="meta.icon" class="w-4 text-center text-primary-500"></i>
              <span class="truncate">{{ meta.label }}</span>
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
