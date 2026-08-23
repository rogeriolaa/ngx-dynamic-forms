import { computed, signal } from '@angular/core';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import {
  FieldDefinition,
  FieldType,
  FormDefinition,
} from '@n0n3br/ngx-dynamic-forms-core';
import type { FormStep } from '@n0n3br/ngx-dynamic-forms-core';
import { validateDefinition, DefinitionIssue } from '@n0n3br/ngx-dynamic-forms-core';
import { computeDependencyDepths } from '@n0n3br/ngx-dynamic-forms-core';

let fieldCounter = 0;
let stepCounter = 0;

/**
 * Client-side editing state for the designer. Pure signals — no persistence
 * here; the shell component decides when to save/publish via repositories.
 */
export class FormBuilderStore {
  readonly definition = signal<FormDefinition | null>(null);
  readonly selectedFieldId = signal<string | null>(null);
  readonly previewMode = signal(false);
  /** Bumped whenever a structural edit happens — lets the canvas re-render. */
  private readonly revision = signal(0);

  // ---------- undo / redo ----------

  private static readonly HISTORY_CAP = 50;
  private undoStack: FormDefinition[] = [];
  private redoStack: FormDefinition[] = [];
  /** Bumped whenever the stacks change — drives canUndo/canRedo. */
  private readonly historyTick = signal(0);

  readonly canUndo = computed(() => {
    this.historyTick();
    return this.undoStack.length > 0;
  });
  readonly canRedo = computed(() => {
    this.historyTick();
    return this.redoStack.length > 0;
  });

  /** Records the current definition before a mutation. Call inside mutators. */
  private checkpoint(): void {
    const current = this.definition();
    if (!current) return;
    this.undoStack.push(structuredClone(current));
    if (this.undoStack.length > FormBuilderStore.HISTORY_CAP) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.historyTick.update((v) => v + 1);
  }

  undo(): void {
    const previous = this.undoStack.pop();
    const current = this.definition();
    if (!previous || !current) return;
    this.redoStack.push(structuredClone(current));
    this.definition.set(previous);
    this.revision.update((v) => v + 1);
    this.historyTick.update((v) => v + 1);
  }

  redo(): void {
    const next = this.redoStack.pop();
    const current = this.definition();
    if (!next || !current) return;
    this.undoStack.push(structuredClone(current));
    this.definition.set(next);
    this.revision.update((v) => v + 1);
    this.historyTick.update((v) => v + 1);
  }

  load(def: FormDefinition): void {
    this.undoStack = [];
    this.redoStack = [];
    this.historyTick.update((v) => v + 1);
    this.definition.set(structuredClone(def));
    this.selectedFieldId.set(null);
    this.previewMode.set(false);
    this.revision.update((v) => v + 1);
  }

  patchDefinition(patch: Partial<FormDefinition>): void {
    this.checkpoint();
    this.definition.update((def) => (def ? { ...def, ...patch } : def));
    this.revision.update((v) => v + 1);
  }

  readonly issues = computed<DefinitionIssue[]>(() => {
    this.revision();
    const def = this.definition();
    return def ? validateDefinition(def) : [];
  });

  readonly blockingErrorCount = computed(
    () => this.issues().filter((i) => i.severity === 'error').length,
  );

  readonly selectedField = computed<FieldDefinition | null>(() => {
    this.revision();
    const id = this.selectedFieldId();
    return this.definition()?.fields.find((f) => f.id === id) ?? null;
  });

  select(id: string | null): void {
    this.selectedFieldId.set(id);
    this.previewMode.set(false);
  }

  addField(type: FieldType, meta: { defaultConfig: Partial<FieldDefinition> }): void {
    this.checkpoint();
    fieldCounter += 1;
    const def = this.definition();
    const field: FieldDefinition = {
      id: `${type}_${Date.now().toString(36)}${fieldCounter}`,
      type,
      label: '',
      columns: 12,
      // new fields land on the first wizard page when the form is multi-step
      ...(def?.steps?.length ? { stepId: def.steps[0].id } : {}),
      ...meta.defaultConfig,
    };
    this.definition.update((def) =>
      def ? { ...def, fields: [...def.fields, field] } : def,
    );
    this.selectedFieldId.set(field.id);
    this.previewMode.set(false);
    this.revision.update((v) => v + 1);
  }

  updateField(id: string, patch: Partial<FieldDefinition>): void {
    this.checkpoint();
    this.definition.update((def) =>
      def
        ? {
            ...def,
            fields: def.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
          }
        : def,
    );
    this.revision.update((v) => v + 1);
  }

  removeField(id: string): void {
    this.checkpoint();
    this.definition.update((def) => {
      if (!def) return def;
      // drop rules referencing the removed field so validation stays clean
      const dependencies = def.dependencies.filter(
        (dep) =>
          dep.target !== id &&
          !JSON.stringify(dep.when).includes(`"${id}"`),
      );
      return { ...def, fields: def.fields.filter((f) => f.id !== id), dependencies };
    });
    if (this.selectedFieldId() === id) this.selectedFieldId.set(null);
    this.revision.update((v) => v + 1);
  }

  /**
   * A field may only swap with a neighbour at the SAME dependency depth —
   * arrows, like drag & drop, must never cross a conditional-chain boundary
   * (a dependent can't rise above its father or sink into another subtree).
   */
  canMove(id: string, direction: -1 | 1): boolean {
    const def = this.definition();
    if (!def) return false;
    const index = def.fields.findIndex((f) => f.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= def.fields.length) return false;
    const depths = computeDependencyDepths(def.fields, def.dependencies);
    return (
      (depths.get(def.fields[index].id) ?? 0) === (depths.get(def.fields[target].id) ?? 0)
    );
  }

  move(id: string, direction: -1 | 1): void {
    this.checkpoint();
    if (!this.canMove(id, direction)) return;
    this.definition.update((def) => {
      if (!def) return def;
      const index = def.fields.findIndex((f) => f.id === id);
      const target = index + direction;
      const fields = [...def.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...def, fields };
    });
    this.revision.update((v) => v + 1);
  }

  /** Drag-and-drop reorder: moves `id` so it ends up at `targetIndex`. */
  reorderField(id: string, targetIndex: number): void {
    this.checkpoint();
    this.definition.update((def) => {
      if (!def) return def;
      const from = def.fields.findIndex((f) => f.id === id);
      if (
        from < 0 ||
        from === targetIndex ||
        targetIndex < 0 ||
        targetIndex >= def.fields.length
      ) {
        return def;
      }
      const fields = [...def.fields];
      const [moved] = fields.splice(from, 1);
      fields.splice(targetIndex, 0, moved);
      return { ...def, fields };
    });
    this.revision.update((v) => v + 1);
  }

  duplicateField(id: string): void {
    this.checkpoint();
    this.definition.update((def) => {
      if (!def) return def;
      const index = def.fields.findIndex((f) => f.id === id);
      if (index < 0) return def;
      fieldCounter += 1;
      const source = def.fields[index];
      const copy: FieldDefinition = {
        ...structuredClone(source),
        id: `${source.type}_${Date.now().toString(36)}${fieldCounter}`,
        label: source.label ? `${source.label} (copy)` : source.id,
      };
      const fields = [...def.fields];
      fields.splice(index + 1, 0, copy);
      return { ...def, fields };
    });
    this.revision.update((v) => v + 1);
  }

  setDependencies(dependencies: Dependency[]): void {
    this.patchDefinition({ dependencies });
  }

  // ---------- wizard steps ----------

  readonly steps = computed<FormStep[]>(() => this.definition()?.steps ?? []);

  addStep(): void {
    this.checkpoint();
    stepCounter += 1;
    this.definition.update((def) => {
      if (!def) return def;
      const steps = def.steps ?? [];
      return {
        ...def,
        steps: [...steps, { id: `step_${Date.now().toString(36)}${stepCounter}`, title: `Step ${steps.length + 1}` }],
      };
    });
    this.revision.update((v) => v + 1);
  }

  renameStep(id: string, title: string): void {
    this.checkpoint();
    this.definition.update((def) =>
      def
        ? {
            ...def,
            steps: (def.steps ?? []).map((s) => (s.id === id ? { ...s, title } : s)),
          }
        : def,
    );
    this.revision.update((v) => v + 1);
  }

  moveStep(id: string, direction: -1 | 1): void {
    this.checkpoint();
    this.definition.update((def) => {
      if (!def?.steps) return def;
      const index = def.steps.findIndex((s) => s.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= def.steps.length) return def;
      const steps = [...def.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...def, steps };
    });
    this.revision.update((v) => v + 1);
  }

  /** Removing a step reassigns its fields to the new FIRST step; dropping the last step reverts the form to single-page. */
  removeStep(id: string): void {
    this.checkpoint();
    this.definition.update((def) => {
      if (!def) return def;
      const remaining = (def.steps ?? []).filter((s) => s.id !== id);
      if (remaining.length === (def.steps ?? []).length) return def;

      let fields = def.fields;
      let steps: FormStep[] | undefined = remaining;
      if (remaining.length === 0) {
        steps = undefined;
        fields = def.fields.map(({ stepId: _stepId, ...f }) => f);
      } else {
        fields = def.fields.map((f) =>
          f.stepId === id || !remaining.some((s) => s.id === f.stepId)
            ? { ...f, stepId: remaining[0].id }
            : f,
        );
      }
      return { ...def, steps, fields };
    });
    this.revision.update((v) => v + 1);
  }

  assignFieldToStep(fieldId: string, stepId: string | undefined): void {
    this.updateField(fieldId, { stepId });
  }
}
