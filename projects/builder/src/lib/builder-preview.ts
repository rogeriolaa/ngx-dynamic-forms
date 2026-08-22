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
  NdfIcon,
  computeDependencyDepths,
  buildFormGroup,
} from '@n0n3br/ngx-dynamic-forms-core';


/**
 * Live, interactive preview of the working copy. Runs the real
 * `FormDependencyEngine` over a throwaway FormGroup so designers can test
 * conditional chains before publishing — same runtime the responder uses.
 * No persistence, no validation gates: pure sandbox.
 */
@Component({
  selector: 'ngx-builder-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .preview { display: flex; flex-direction: column; gap: 1rem; }
    .preview-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      border-radius: 8px;
      background: var(--ndf-surface-alt);
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem; font-weight: 500; color: var(--ndf-text-muted);
    }
    :host-context(.app-dark) .preview-banner { background: var(--ndf-surface-alt); }
    .preview-banner i { margin-right: 0.375rem; }
    .preview-title { font-size: 1.25rem; font-weight: 600; margin: 0; }
    .preview-desc { margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--ndf-text-muted); }

    .field-grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 1rem;
    }
    .field-cell { grid-column: span 12; }
    .section-cell {
      grid-column: 1 / -1;
      border-bottom: 1px solid var(--ndf-border);
      padding-top: 0.5rem; padding-bottom: 0.25rem;
    }
    :host-context(.app-dark) .section-cell { border-bottom-color: var(--ndf-border); }
    .section-title { margin: 0.5rem 0 0; font-size: 1rem; font-weight: 600; }
  `,
  imports: [ReactiveFormsModule, FieldHost, NdfIcon],
  template: `
    @if (form(); as group) {
      <div class="preview" data-testid="builder-preview">
        <div class="preview-banner">
          <span>
            <i class="pi pi-eye"></i>
            Preview mode — rules are live, nothing is saved
          </span>
          <button type="button" class="ndf-btn ndf-btn--ghost ndf-btn--sm" (click)="reset()">
            <ndf-icon name="refresh" /> Reset values
          </button>
        </div>

        <header>
          <h2 class="preview-title">{{ definition()?.title }}</h2>
          @if (definition()?.description) {
            <p class="preview-desc">{{ definition()!.description }}</p>
          }
        </header>

        <div [formGroup]="group" class="field-grid">
          @for (row of rows(); track row.field.id) {
            @if (row.field.type === 'section') {
              <div
                class="section-cell"
                [style.marginLeft.rem]="row.depth * 1.5"
              >
                <h3 class="section-title">{{ row.field.label }}</h3>
                @if (row.field.helpText) {
                  <p class="preview-desc">{{ row.field.helpText }}</p>
                }
              </div>
            } @else if (!isHidden(row.field.id)) {
              <div
                class="field-cell"
                [style.gridColumn]="'span ' + columnSpan(row.field)"
                [style.marginLeft.rem]="row.depth * 1.5"
              >
                <ngx-field-host [field]="row.field" [control]="$any(group.controls[row.field.id])" />
              </div>
            }
          }
        </div>

        @if (hiddenCount() > 0) {
          <div class="ndf-alert" data-testid="preview-hidden-note">
            {{ hiddenCount() }} field(s) currently hidden by your rules.
          </div>
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

  columnSpan(field: FieldDefinition): number {
    return Math.min(12, Math.max(3, field.columns ?? 12));
  }

  reset(): void {
    this.rebuild(this.definition());
  }
}
