import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import { FormDependencyEngine } from '@n0n3br/ngx-form-dependency-engine';
import {
  FieldDefinition,
  FieldHost,
  FormDefinition,
  computeDependencyDepths,
  buildFormGroup,
} from '@n0n3br/ngx-dynamic-forms-core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

/**
 * Live, interactive preview of the working copy. Runs the real
 * `FormDependencyEngine` over a throwaway FormGroup so designers can test
 * conditional chains before publishing — same runtime the responder uses.
 * No persistence, no validation gates: pure sandbox.
 */
@Component({
  selector: 'ngx-builder-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldHost, ButtonModule, MessageModule],
  template: `
    @if (form(); as group) {
      <div class="flex flex-col gap-4" data-testid="builder-preview">
        <div class="flex items-center justify-between gap-2 rounded-lg bg-surface-100 px-3 py-2 dark:bg-surface-800">
          <span class="flex items-center gap-2 text-xs font-medium text-surface-500">
            <i class="pi pi-eye"></i>
            Preview mode — rules are live, nothing is saved
          </span>
          <p-button
            label="Reset values"
            icon="pi pi-refresh"
            size="small"
            variant="text"
            (onClick)="reset()"
          />
        </div>

        <header>
          <h2 class="m-0 text-xl font-semibold">{{ definition()?.title }}</h2>
          @if (definition()?.description) {
            <p class="mb-0 mt-1 text-sm text-surface-500">{{ definition()!.description }}</p>
          }
        </header>

        <div [formGroup]="group" class="grid grid-cols-12 gap-4">
          @for (row of rows(); track row.field.id) {
            @if (row.field.type === 'section') {
              <div [class]="columnClass(row.field)" [style.marginLeft.rem]="row.depth * 1.5">
                <h3 class="mb-0 mt-2 border-b border-surface-200 pb-1 text-base font-semibold dark:border-surface-700">
                  {{ row.field.label }}
                </h3>
                @if (row.field.helpText) {
                  <p class="mb-0 mt-1 text-xs text-surface-500">{{ row.field.helpText }}</p>
                }
              </div>
            } @else if (!isHidden(row.field.id)) {
              <div [class]="columnClass(row.field)" [style.marginLeft.rem]="row.depth * 1.5">
                <ngx-field-host [field]="row.field" [control]="$any(group.controls[row.field.id])" />
              </div>
            }
          }
        </div>

        @if (hiddenCount() > 0) {
          <p-message severity="info" [closable]="false" data-testid="preview-hidden-note">
            {{ hiddenCount() }} field(s) currently hidden by your rules.
          </p-message>
        }
      </div>
    }
  `,
})
export class BuilderPreview {
  readonly definition = input.required<FormDefinition>();

  private engine: FormDependencyEngine | null = null;
  private staticDisabled = new Set<string>();
  private destroyRef = inject(DestroyRef);

  readonly form = signal<FormGroup | null>(null);

  readonly rows = computed(() => {
    const def = this.definition();
    const depths = computeDependencyDepths(def.fields, def.dependencies);
    return def.fields.map((field) => ({ field, depth: depths.get(field.id) ?? 0 }));
  });

  readonly hiddenCount = computed(() => {
    if (!this.engine) return 0;
    return this.definition().fields.filter(
      (f) => f.type !== 'section' && this.engine!.isHidden(f.id),
    ).length;
  });

  constructor() {
    effect(() => this.rebuild(this.definition()));
    this.destroyRef.onDestroy(() => this.engine?.destroy());
  }

  private rebuild(def: FormDefinition): void {
    this.engine?.destroy();
    const built = buildFormGroup(def);
    this.form.set(built.group);
    this.staticDisabled = built.staticallyDisabled;
    this.engine = new FormDependencyEngine(built.group, def.dependencies as Dependency[]);
    this.engine.activate();
  }

  isHidden(fieldId: string): boolean {
    return this.engine?.isHidden(fieldId) ?? false;
  }

  hiddenByRule(field: FieldDefinition): boolean {
    return this.engine?.isHidden(field.id) ?? false;
  }

  columnClass(field: FieldDefinition): string {
    return `col-span-12 md:col-span-${Math.min(12, Math.max(3, field.columns ?? 12))}`;
  }

  reset(): void {
    this.rebuild(this.definition());
  }
}
