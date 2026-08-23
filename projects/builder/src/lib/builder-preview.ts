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
import { Subscription } from 'rxjs';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import { FormDependencyEngine } from '@n0n3br/ngx-form-dependency-engine';
import {
  FieldDefinition,
  FieldHost,
  FormDefinition,
  FormStep,
  NdfIcon,
  buildFormGroup,
  computeDependencyDepths,
  invalidStepFieldIds,
  isStepFieldsValid,
  resolveFieldStepId,
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
    .trace {
      border: 1px solid var(--ndf-border);
      border-radius: 8px;
      padding: 0.625rem 0.75rem;
      font-size: 0.75rem;
    }
    .trace-title {
      margin: 0 0 0.375rem;
      font-size: 0.6875rem; font-weight: 600;
      letter-spacing: 0.05em; text-transform: uppercase;
      color: var(--ndf-text-muted);
    }
    .trace-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.125rem 0; color: var(--ndf-text); }
    .trace-id { font-family: ui-monospace, monospace; }
    .trace-badge {
      border-radius: 999px; padding: 0 0.4rem; font-weight: 600;
      background: var(--ndf-surface-alt);
      color: var(--ndf-text-muted);
    }
    .trace-cond { color: var(--ndf-text-muted); font-family: ui-monospace, monospace; }
    .trace-cond--fail { color: var(--ndf-danger); }
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

    .stepper {
      display: flex; flex-wrap: wrap; gap: 0.375rem;
      list-style: none; margin: 0; padding: 0;
    }
    .step-pill {
      display: inline-flex; align-items: center; gap: 0.4rem;
      border: 1px solid var(--ndf-border);
      border-radius: 999px;
      background: transparent;
      padding: 0.3rem 0.75rem;
      font-size: 0.8125rem;
      cursor: pointer;
      color: var(--ndf-text-muted);
    }
    .step-pill:hover { color: var(--ndf-text); }
    .step-pill.active {
      border-color: var(--p-primary-500);
      color: var(--p-primary-600);
      font-weight: 600;
    }
    .step-pill.done { color: var(--ndf-success); }
    .step-num {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.125rem; height: 1.125rem;
      border-radius: 999px;
      background: var(--ndf-surface-alt);
      font-size: 0.6875rem; font-weight: 700;
    }
    .wizard-nav { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; }
    .wizard-hint { margin-right: auto; font-size: 0.75rem; color: var(--ndf-text-muted); }
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

        <!-- wizard stepper -->
        @if (isWizard()) {
          <ol class="stepper" data-testid="preview-stepper">
            @for (s of steps(); track s.id; let i = $index) {
              <li>
                <button
                  type="button"
                  class="step-pill"
                  [class.active]="i === currentStep()"
                  [class.done]="i < currentStep()"
                  [attr.data-testid]="'preview-step-pill-' + i"
                  (click)="goToStep(i)"
                >
                  <span class="step-num">{{ i < currentStep() ? '✓' : i + 1 }}</span>
                  {{ s.title || s.id }}
                </button>
              </li>
            }
          </ol>
        }

        <div [formGroup]="group" class="field-grid">
          @for (row of visibleRows(); track row.field.id) {
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

        @if (isWizard()) {
          @if (stepErrors().length > 0) {
            <div class="ndf-alert ndf-alert--error" data-testid="preview-step-errors" role="alert">
              Fill this step before advancing: {{ stepErrors().join(', ') }}
            </div>
          }
          <div class="wizard-nav">
            <span class="wizard-hint">Step {{ currentStep() + 1 }} of {{ steps().length }} — preview only, nothing is saved</span>
            <button
              type="button"
              class="ndf-btn ndf-btn--secondary ndf-btn--sm"
              [disabled]="currentStep() === 0"
              data-testid="preview-back-btn"
              (click)="goBack()"
            >
              Back
            </button>
            @if (!isLastStep()) {
              <button
                type="button"
                class="ndf-btn ndf-btn--sm"
                data-testid="preview-next-btn"
                (click)="goNext()"
              >
                Next <ndf-icon name="arrow-right" />
              </button>
            } @else {
              <span class="wizard-hint">End of form</span>
            }
          </div>
        }

        @if (definition().dependencies.length > 0 && engineState(); as engine) {
          <section class="trace" data-testid="rule-trace">
            <p class="trace-title">Rule inspector</p>
            @for (rule of engine.lastTrace(); track rule.ruleId) {
              <div class="trace-row">
                <ndf-icon
                  [name]="rule.passed ? 'check' : 'x'"
                  [style.color]="rule.passed ? 'var(--ndf-success)' : 'var(--ndf-danger)'"
                />
                <span class="trace-id">{{ rule.ruleId }}</span>
                <span class="trace-badge">{{ rule.branch }}</span>
                @for (cond of rule.conditions; track $index) {
                  <span class="trace-cond" [class.trace-cond--fail]="!cond.ok">{{ condLabel(cond) }}</span>
                }
              </div>
            }
          </section>
        }
      </div>
    }
  `,
})
export class BuilderPreview {
  readonly definition = input.required<FormDefinition>();

  /** Plain field — reading the signal inside rebuild()'s effect would make
   * the effect track itself and loop forever. */
  private engine: FormDependencyEngine | null = null;
  /** Signal mirror for the template (rule inspector reads lastTrace()). */
  protected readonly engineState = signal<FormDependencyEngine | null>(null);
  /**
   * Bumped on every answer change. The engine mutates its hidden-set in
   * place (no signal emission), so visibility needs an explicit trigger
   * that fires AFTER the engine's own valueChanges subscriber ran.
   */
  private readonly evalTick = signal(0);
  private valueSub: Subscription | null = null;
  private staticDisabled = new Set<string>();
  private destroyRef = inject(DestroyRef);

  /** Active wizard page in preview (0-based). */
  readonly currentStep = signal(0);
  readonly stepErrors = signal<string[]>([]);

  readonly form = signal<FormGroup | null>(null);

  readonly rows = computed(() => {
    const def = this.definition();
    const depths = computeDependencyDepths(def.fields, def.dependencies);
    return def.fields.map((field) => ({ field, depth: depths.get(field.id) ?? 0 }));
  });

  // ---------- wizard (preview) ----------

  readonly steps = computed<FormStep[]>(() => this.definition().steps ?? []);
  readonly isWizard = computed(() => this.steps().length > 0);

  readonly currentStepId = computed<string | null>(() => {
    const steps = this.steps();
    if (steps.length === 0) return null;
    const i = this.currentStep();
    return steps[Math.min(Math.max(i, 0), steps.length - 1)].id;
  });

  readonly isLastStep = computed(() => {
    const steps = this.steps();
    return steps.length === 0 || this.currentStep() >= steps.length - 1;
  });

  /** Rows for the active wizard page; single-page forms pass through. */
  readonly visibleRows = computed(() => {
    const allRows = this.rows();
    const stepId = this.currentStepId();
    if (!stepId) return allRows;
    const steps = this.steps() ?? undefined;
    return allRows.filter((row) => resolveFieldStepId(row.field, steps) === stepId);
  });

  readonly hiddenCount = computed(() => {
    this.evalTick(); // stay live across engine passes
    const engine = this.engineState();
    if (!engine) return 0;
    return this.definition().fields.filter(
      (f) => f.type !== 'section' && engine.hiddenFields().has(f.id),
    ).length;
  });

  constructor() {
    effect(() => this.rebuild(this.definition()));
    this.destroyRef.onDestroy(() => {
      this.valueSub?.unsubscribe();
      this.engine?.destroy();
    });
  }

  private rebuild(def: FormDefinition): void {
    this.valueSub?.unsubscribe();
    this.engine?.destroy();
    const built = buildFormGroup(def);
    this.form.set(built.group);
    this.staticDisabled = built.staticallyDisabled;
    // structural edits restart the wizard
    this.currentStep.set(0);
    this.stepErrors.set([]);
    // trace: true powers the live "Rule inspector" panel below the form
    const engine = new FormDependencyEngine(built.group, def.dependencies as Dependency[], {
      trace: true,
    });
    engine.activate();
    // subscribed AFTER engine.activate() → runs post-evaluation.
    // statusChanges too: setRequired effects change validity without a value event.
    const tick = () => this.evalTick.update((v) => v + 1);
    this.valueSub = built.group.valueChanges.subscribe(tick);
    const statusSub = built.group.statusChanges.subscribe(tick);
    this.destroyRef.onDestroy(() => statusSub.unsubscribe());
    this.engine = engine;
    this.engineState.set(engine);
  }

  // ---------- wizard navigation ----------

  goNext(): void {
    this.goToStep(this.currentStep() + 1);
  }

  goBack(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((i) => i - 1);
      this.stepErrors.set([]);
    }
  }

  /** Free backward jumps; forward jumps stop at the first invalid page. */
  goToStep(target: number): void {
    const steps = this.steps();
    const group = this.form();
    if (steps.length === 0 || !group) return;
    if (target < 0 || target >= steps.length) return;

    let cursor = this.currentStep();
    while (cursor < target) {
      const stepId = steps[cursor].id;
      if (!isStepFieldsValid(this.definition().fields, steps, stepId, group)) {
        const badIds = invalidStepFieldIds(this.definition().fields, steps, stepId, group);
        badIds.forEach((id) => group.controls[id]?.markAsTouched());
        this.stepErrors.set(
          badIds.map((id) => this.definition().fields.find((f) => f.id === id)?.label ?? id),
        );
        this.currentStep.set(cursor);
        return;
      }
      cursor += 1;
    }
    this.currentStep.set(target);
    this.stepErrors.set([]);
  }

  isHidden(fieldId: string): boolean {
    this.evalTick();
    return this.engineState()?.hiddenFields().has(fieldId) ?? false;
  }

  hiddenByRule(field: FieldDefinition): boolean {
    return this.engineState()?.isHidden(field.id) ?? false;
  }

  columnSpan(field: FieldDefinition): number {
    return Math.min(12, Math.max(3, field.columns ?? 12));
  }

  reset(): void {
    this.rebuild(this.definition());
  }

  condLabel(cond: { field: string; operator: string; expected?: unknown; actual: unknown; ok: boolean }): string {
    const base = `${cond.field} ${cond.operator}`;
    if (cond.ok) return base;
    let actual = cond.actual;
    if (actual === undefined) actual = 'undefined';
    else if (actual === null) actual = 'null';
    else if (actual === '') actual = "''";
    return `${base} — expected ${JSON.stringify(cond.expected)}, got ${JSON.stringify(actual)}`;
  }

  stringify(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (value === '') return "''";
    return String(value);
  }
}
