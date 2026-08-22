import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import {
  FieldDefinition,
  FieldTypeRegistry,
  computeDependencyDepths,
  collectConditionFields,
  collectEffectTargets,
} from '@n0n3br/ngx-dynamic-forms-core';
import { NdfIcon } from '@n0n3br/ngx-dynamic-forms-core';
import { FormBuilderStore } from './form-builder-store';

interface CanvasRow {
  field: FieldDefinition;
  icon: string;
  typeLabel: string;
  depth: number;
}

/** Inclusive range of legal landing indices (in the field list WITHOUT the
 * dragged field) for a drag of `dragId`. */
export interface DropWindow {
  lo: number;
  hi: number;
}

function edge(map: Map<string, Set<string>>, from: string, to: string): void {
  if (from === to) return;
  const set = map.get(to);
  if (set) set.add(from);
  else map.set(to, new Set([from]));
}

function transitive(start: string, edges: Map<string, Set<string>>): Set<string> {
  const seen = new Set<string>();
  const queue = [...(edges.get(start) ?? [])];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(edges.get(current) ?? []));
  }
  return seen;
}

/**
 * Pure helper (unit-tested): where may `dragId` legally land?
 *
 * Rules:
 * - only positions whose field has the SAME dependency depth as the dragged
 *   field are candidates (a level-0 field may never be dropped into a
 *   conditional chain and vice versa);
 * - a field may never land above any of its ancestors nor below any of its
 *   descendants, so reorderings can never visually detach a rule chain.
 *
 * Returned indices refer to the array WITHOUT the dragged field already
 * removed — exactly what `FormBuilderStore.reorderField` expects.
 */
export function computeDropWindow(
  fields: FieldDefinition[],
  dependencies: Dependency[],
  dragId: string,
): DropWindow {
  const parents = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();
  for (const dep of dependencies) {
    const targets = new Set([dep.target]);
    collectEffectTargets(dep).forEach((t) => targets.add(t));
    for (const source of collectConditionFields(dep.when)) {
      for (const target of targets) {
        edge(parents, source, target);
        edge(children, target, source);
      }
    }
  }

  const remaining = fields.filter((f) => f.id !== dragId);
  const postIndex = new Map(remaining.map((f, i) => [f.id, i]));

  let lo = 0;
  let hi = remaining.length - 1;
  for (const ancestor of transitive(dragId, parents)) {
    const at = postIndex.get(ancestor);
    if (at !== undefined && at >= lo) lo = at + 1;
  }
  for (const descendant of transitive(dragId, children)) {
    const at = postIndex.get(descendant);
    if (at !== undefined && at <= hi) hi = at - 1;
  }

  return { lo, hi };
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
    .field-card:hover .card-tools, .field-card.dragging .card-tools { opacity: 1; }
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
    .card-tool:disabled { opacity: 0.3; cursor: not-allowed; }

    /* drag & drop */
    .drag-hint { display: inline-flex; align-self: center; color: var(--ndf-text-faint); }
    .field-card[draggable='true'] { cursor: grab; }
    .field-card.dragging { opacity: 0.4; cursor: grabbing; }
    /* while dragging, cards that are not legal same-level targets dim out */
    .field-card.drop-invalid { opacity: 0.45; }
    .field-card.drop-target {
      border-color: var(--ndf-primary);
      box-shadow: inset 0 2px 0 var(--ndf-primary);
    }
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
            [class.dragging]="draggingId() === row.field.id"
            [class.drop-invalid]="draggingId() !== null && !canDropOn(row)"
            [class.drop-target]="dropIndex() === $index && draggingId() !== null && draggingId() !== row.field.id"
            [style.marginLeft.rem]="row.depth * 1.5"
            [attr.data-testid]="'canvas-field-' + row.field.id"
            [attr.data-depth]="row.depth"
            draggable="true"
            (click)="store.select(row.field.id)"
            (dragstart)="onDragStart($event, row.field.id)"
            (dragover)="onDragOver($event, row, $index)"
            (drop)="onDrop($event, row)"
            (dragend)="onDragEnd()"
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
              <span class="drag-hint" title="Drag to reorder"><ndf-icon name="arrows-h" /></span>
              <button
                type="button"
                class="card-tool"
                title="Move up"
                [disabled]="!store.canMove(row.field.id, -1)"
                (click)="store.move(row.field.id, -1); $event.stopPropagation()"
              >
                <ndf-icon name="arrow-up" />
              </button>
              <button
                type="button"
                class="card-tool"
                title="Move down"
                [disabled]="!store.canMove(row.field.id, 1)"
                (click)="store.move(row.field.id, 1); $event.stopPropagation()"
              >
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

  /** Field currently being dragged (native HTML5 DnD). */
  readonly draggingId = signal<string | null>(null);
  /** Canvas index the drop would land on — drives the insertion indicator. */
  readonly dropIndex = signal<number | null>(null);

  private readonly depthById = computed(() => {
    const map = new Map<string, number>();
    for (const row of this.rows()) map.set(row.field.id, row.depth);
    return map;
  });

  onDragStart(event: DragEvent, id: string): void {
    this.draggingId.set(id);
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', id);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  /** Index of `fieldId` once the dragged field is removed from the list. */
  private postRemovalIndex(fieldId: string): number {
    const def = this.store.definition();
    const dragId = this.draggingId();
    if (!def) return -1;
    const at = def.fields.findIndex((f) => f.id === fieldId);
    if (at < 0) return -1;
    const from = def.fields.findIndex((f) => f.id === dragId);
    return from !== -1 && from < at ? at - 1 : at;
  }

  /**
   * A card is a legal target only when it sits at the SAME dependency level
   * as the dragged field AND inside the ancestor/descendant drop window —
   * dragging a root field must never nest it inside a conditional chain.
   */
  canDropOn(row: CanvasRow): boolean {
    const dragId = this.draggingId();
    const def = this.store.definition();
    if (!dragId || !def || row.field.id === dragId) return false;
    if (row.depth !== (this.depthById().get(dragId) ?? -1)) return false;
    const { lo, hi } = computeDropWindow(def.fields, def.dependencies, dragId);
    const at = this.postRemovalIndex(row.field.id);
    return at >= lo && at <= hi;
  }

  onDragOver(event: DragEvent, row: CanvasRow, index: number): void {
    if (!this.canDropOn(row)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropIndex.set(index);
  }

  onDrop(event: DragEvent, row: CanvasRow): void {
    if (!this.canDropOn(row)) return;
    event.preventDefault();
    const id = this.draggingId() ?? event.dataTransfer?.getData('text/plain');
    if (!id) return;
    // reorderField expects the index in the list WITHOUT the dragged field
    this.store.reorderField(id, this.postRemovalIndex(row.field.id));
    this.draggingId.set(null);
    this.dropIndex.set(null);
  }

  onDragEnd(): void {
    this.draggingId.set(null);
    this.dropIndex.set(null);
  }

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
