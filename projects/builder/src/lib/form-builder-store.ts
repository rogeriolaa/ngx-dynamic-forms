import { computed, signal } from '@angular/core';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import {
  FieldDefinition,
  FieldType,
  FormDefinition,
} from '@n0n3br/ngx-dynamic-forms-core';
import { validateDefinition, DefinitionIssue } from '@n0n3br/ngx-dynamic-forms-core';

let fieldCounter = 0;

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

  load(def: FormDefinition): void {
    this.definition.set(structuredClone(def));
    this.selectedFieldId.set(null);
    this.previewMode.set(false);
    this.revision.update((v) => v + 1);
  }

  patchDefinition(patch: Partial<FormDefinition>): void {
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
    fieldCounter += 1;
    const field: FieldDefinition = {
      id: `${type}_${Date.now().toString(36)}${fieldCounter}`,
      type,
      label: '',
      columns: 12,
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

  move(id: string, direction: -1 | 1): void {
    this.definition.update((def) => {
      if (!def) return def;
      const index = def.fields.findIndex((f) => f.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= def.fields.length) return def;
      const fields = [...def.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...def, fields };
    });
    this.revision.update((v) => v + 1);
  }

  duplicateField(id: string): void {
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
}
