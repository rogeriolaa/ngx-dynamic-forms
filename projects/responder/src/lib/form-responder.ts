import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import { FormDependencyEngine } from '@n0n3br/ngx-form-dependency-engine';
import { Subscription, debounceTime, merge } from 'rxjs';
import {
  FieldDefinition,
  FieldType,
  FormDefinition,
  FormResponse,
  FormResponseDraft,
  FormStep,
  FORM_DEFINITION_REPOSITORY,
  FORM_RESPONSE_REPOSITORY,
  FieldHost,
  NgxFormsService,
  PermissionsInput,
  ResolvedPermissions,
  DraftMergeReport,
  NDF_LOCALE,
  buildFormGroup,
  computeDependencyDepths,
  deserializeValues,
  fieldsOfStep,
  invalidStepFieldIds,
  isStepFieldsValid,
  mergeDraftValues,
  resolveFieldStepId,
  resolvePermissions,
  serializeValues,
  interpolate,
} from '@n0n3br/ngx-dynamic-forms-core';
import { NdfIcon } from '@n0n3br/ngx-dynamic-forms-core';

type ResponderStatus = 'loading' | 'ready' | 'blocked' | 'missing' | 'submitted';

/** Auto-save debounce window (ms). */
const AUTO_SAVE_DEBOUNCE_MS = 1200;

interface DraftPromptData {
  values: Record<string, unknown>;
  savedAt: string;
  report: DraftMergeReport;
  draftId: string;
}

/**
 * `<ngx-form-responder>` — renders a published form definition as an
 * interactive, validated form whose conditional behavior is driven by
 * `FormDependencyEngine` rules stored on the definition.
 *
 * Persistence modes:
 * - **Repository mode** — provide the repository tokens (e.g. via
 *   `provideNgxForms()`) and pass a `formId`; drafts and submissions are
 *   persisted for you (outputs still fire).
 * - **Controlled mode** — pass `[definition]` instead of `formId`; without
 *   response repositories nothing is written and you handle `(submitted)`
 *   / `(draftSaved)` yourself.
 */
@Component({
  selector: 'ngx-form-responder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldHost, NdfIcon],
  providers: [NgxFormsService],
  styles: `
    .responder-loading { display: flex; justify-content: center; padding: 2.5rem 0; }
    .responder-form { display: flex; flex-direction: column; gap: 1.25rem; }
    .form-head h2 { margin: 0; font-size: 1.25rem; }
    .form-desc { margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--ndf-text-muted); }
    .form-version { margin: 0.25rem 0 0; font-size: 0.75rem; color: var(--ndf-text-muted); }

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
    :host-context(.app-dark) .step-pill.active { color: var(--p-primary-400); }
    .step-pill.done { color: var(--ndf-success); }
    .step-num {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.125rem; height: 1.125rem;
      border-radius: 999px;
      background: var(--ndf-surface-alt);
      font-size: 0.6875rem; font-weight: 700;
    }

    .field-grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 1rem;
    }
    .field-cell { grid-column: span 12; }
    .section-cell {
      grid-column: 1 / -1;
      border-bottom: 1px solid var(--ndf-border);
      padding-top: 0.5rem;
      padding-bottom: 0.25rem;
    }
    :host-context(.app-dark) .section-cell { border-bottom-color: var(--ndf-border); }
    .section-title {
      margin: 0.25rem 0 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .form-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      border-top: 1px solid var(--ndf-border);
      padding-top: 1rem;
    }
    :host-context(.app-dark) .form-footer { border-top-color: var(--ndf-border); }
    .autosave-state { font-size: 0.75rem; color: var(--ndf-text-muted); }
    .footer-actions { display: flex; gap: 0.5rem; }

    .state-card { text-align: center; padding: 2rem 0; }
    .state-card i { font-size: 2.5rem; color: var(--p-surface-400); }
    .state-card h3 { margin: 0.75rem 0 0; font-size: 1.05rem; }
    .state-card p { margin: 0.5rem 0 0; font-size: 0.875rem; color: var(--ndf-text-muted); }
    .state-icon-success { color: var(--ndf-success) !important; font-size: 3rem !important; }

    .merge-warning {
      margin-top: 0.75rem;
      padding: 0.5rem 0.625rem;
      font-size: 0.75rem;
      border-radius: 6px;
      border: 1px solid var(var(--ndf-warning));
      background: var(var(--ndf-warning-soft));
      color: var(var(--ndf-warning));
    }
    :host-context(.app-dark) .merge-warning {
      background: color-mix(in srgb, var(var(--ndf-warning-soft)0) 12%, transparent);
      border-color: var(var(--ndf-warning));
      color: var(var(--ndf-warning));
    }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  `,
  templateUrl: './form-responder.html',
})
export class FormResponder {
  // ---------- inputs / outputs ----------

  /** Repository mode: load the latest published version of this form. */
  readonly formId = input<string | undefined>();
  /** Controlled mode: answer exactly this definition. */
  readonly definition = input<FormDefinition | undefined>();
  /** Opaque respondent identity — scopes drafts per user. */
  readonly respondentContext = input<unknown>(undefined);
  readonly permissions = input<PermissionsInput | undefined>();
  /** Field types that must not be rendered (their values still persist). */
  readonly excludeFieldTypes = input<FieldType[]>([]);

  readonly submitted = output<FormResponse>();
  readonly draftSaved = output<FormResponseDraft>();

  // ---------- DI ----------

  private readonly definitionsRepo = inject(FORM_DEFINITION_REPOSITORY, { optional: true });
  private readonly responsesRepo = inject(FORM_RESPONSE_REPOSITORY, { optional: true });
  private readonly service = inject(NgxFormsService);
  /** UI strings — override app-wide with `provideNdfLocale('pt-BR')`. */
  readonly t = inject(NDF_LOCALE);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- state ----------

  readonly status = signal<ResponderStatus>('loading');
  readonly definitionState = signal<FormDefinition | null>(null);
  readonly form = signal<FormGroup | null>(null);
  readonly validationErrors = signal<string[]>([]);
  readonly submittedVersion = signal<number | null>(null);
  readonly lastSavedAt = signal<string | null>(null);
  readonly draftPrompt = signal<DraftPromptData | null>(null);
  readonly saveState = signal<'idle' | 'saving' | 'saved' | 'pending'>('idle');
  /** Active wizard page (0-based). Ignored on single-page forms. */
  readonly currentStepIndex = signal(0);

  private engine: FormDependencyEngine | null = null;
  private engineSubscription: Subscription | null = null;
  private autoSaveSub: Subscription | null = null;
  private validitySub: Subscription | null = null;
  private staticallyDisabled = new Set<string>();
  private activeDraftId: string | null = null;
  /** Guards against redundant full re-initialization on input-reference churn. */
  private initializedKey: string | null = null;
  /** Assigned by setupDefinition — re-applies hide/disable + value resets. */
  private syncHiddenControls: () => void = () => {};
  /**
   * Bumped on every value/status change of the live FormGroup. Control
   * validity is NOT signal-tracked, so `canSubmit` needs this to stay
   * reactive under zoneless change detection.
   */
  private readonly validityTick = signal(0);

  constructor() {
    effect(() => void this.initialize());
    this.destroyRef.onDestroy(() => this.teardownEngine());
  }

  // ---------- lifecycle ----------

  private async initialize(): Promise<void> {
    const inputDef = this.definition();
    const perms = await resolvePermissions(this.permissions());

    if (!perms.canAnswer) {
      this.status.set('blocked');
      return;
    }

    this.status.set('loading');
    try {
      let resolved: FormDefinition | null = null;
      if (inputDef) {
        resolved = inputDef;
      } else if (this.formId()) {
        resolved = await this.service.getLatestPublished(this.formId()!);
      }

      if (!resolved) {
        this.status.set('missing');
        return;
      }

      // Same form+version already mounted → input churn (e.g. parent passing
      // a fresh object each CD pass); rebuilding would wipe user input.
      const key = `${resolved.id}@${resolved.version}`;
      if (this.status() === 'ready' && this.initializedKey === key) {
        this.definitionState.set(resolved);
        return;
      }

      this.setupDefinition(resolved);
      this.initializedKey = key;
      this.status.set('ready');
      await this.checkForDraft();
    } catch {
      this.status.set('missing');
    }
  }

  private setupDefinition(def: FormDefinition): void {
    const built = buildFormGroup(def);
    this.form.set(built.group);
    this.staticallyDisabled = built.staticallyDisabled;
    this.definitionState.set(structuredClone(def));
    this.currentStepIndex.set(0);

    this.teardownEngine();

    if (def.dependencies.length > 0) {
      // collapseHiddenChains: when the engine hides a control it resets it to
      // its initial value inside the same evaluation loop, so chained rules
      // (A→B→C) collapse without stale values leaking into drafts/responses.
      this.engine = new FormDependencyEngine(built.group, def.dependencies as Dependency[], {
        collapseHiddenChains: true,
      });
      this.engineSubscription = this.engine.activate();
    }

    const syncDisabledState = (): void => {
      const group = this.form();
      if (!group) return;
      // UI-only concern: hidden controls are disabled so they drop out of
      // validation and canSubmit. Value resets belong to the engine.
      for (const [fieldId, control] of Object.entries(group.controls)) {
        if (this.staticallyDisabled.has(fieldId)) continue;
        const hiddenByRule = this.engine?.isHidden(fieldId) ?? false;
        if (hiddenByRule && control.enabled) {
          control.disable({ emitEvent: false });
        } else if (!hiddenByRule && control.disabled) {
          control.enable({ emitEvent: false });
        }
      }
    };
    // exposed for post-patch flows (draft restore) that bypass valueChanges
    this.syncHiddenControls = syncDisabledState;
    syncDisabledState();

    this.autoSaveSub?.unsubscribe();
    this.autoSaveSub = built.group.valueChanges
      .pipe(debounceTime(AUTO_SAVE_DEBOUNCE_MS))
      .subscribe(() => {
        syncDisabledState();
        if (built.group.dirty) this.saveState.set('pending');
      });

    this.validitySub?.unsubscribe();
    this.validitySub = merge(built.group.valueChanges, built.group.statusChanges).subscribe(
      () => this.validityTick.update((v) => v + 1),
    );

    if (def.dependencies.length > 0) {
      setTimeout(syncDisabledState);
    }
  }

  private teardownEngine(): void {
    this.engineSubscription?.unsubscribe();
    this.autoSaveSub?.unsubscribe();
    this.validitySub?.unsubscribe();
    this.engine?.destroy();
    this.engine = null;
    this.engineSubscription = null;
    this.autoSaveSub = null;
    this.validitySub = null;
  }

  // ---------- derived ----------

  readonly renderableFields = computed<FieldDefinition[]>(() => {
    const def = this.definitionState();
    return def
      ? def.fields.filter(
          (f) => f.type !== 'hidden' && !this.excludeFieldTypes().includes(f.type),
        )
      : [];
  });

  readonly canPersist = computed(() => !!this.responsesRepo && !!this.definitionState());

  /** Wizard pages, or null when the form renders on a single page. */
  readonly steps = computed<FormStep[] | null>(() => {
    const def = this.definitionState();
    return def && def.steps && def.steps.length > 0 ? def.steps : null;
  });

  readonly currentStepId = computed<string | null>(() => {
    const steps = this.steps();
    if (!steps) return null;
    const i = this.currentStepIndex();
    return steps[Math.min(Math.max(i, 0), steps.length - 1)].id;
  });

  readonly isLastStep = computed(() => {
    const steps = this.steps();
    return !steps || this.currentStepIndex() >= steps.length - 1;
  });

  /**
   * Rows for the CURRENT wizard page only. Single-page forms pass through
   * untouched.
   */
  readonly visibleRows = computed(() => {
    const rows = this.layoutRows();
    const stepId = this.currentStepId();
    if (!stepId) return rows;
    return rows.filter((row) => resolveFieldStepId(row.field, this.steps() ?? undefined) === stepId);
  });

  // ---------- wizard navigation ----------

  /** Validates the current page; true when "Next" may advance. */
  canGoNext(): boolean {
    const def = this.definitionState();
    const group = this.form();
    const stepId = this.currentStepId();
    if (!def || !group || !stepId) return false;
    return isStepFieldsValid(def.fields, this.steps() ?? undefined, stepId, group);
  }

  goNext(): void {
    this.goToStep(this.currentStepIndex() + 1);
  }

  goBack(): void {
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update((i) => i - 1);
      this.validationErrors.set([]);
    }
  }

  /**
   * Jump to any earlier page freely; forward jumps walk every intermediate
   * page and stop at the first invalid one (marking its fields touched).
   */
  goToStep(target: number): void {
    const steps = this.steps();
    const def = this.definitionState();
    const group = this.form();
    if (!steps || !def || !group) return;
    if (target < 0 || target >= steps.length) return;

    let cursor = this.currentStepIndex();
    while (cursor < target) {
      const stepId = steps[cursor].id;
      if (!isStepFieldsValid(def.fields, steps ?? undefined, stepId, group)) {
        const badIds: string[] = invalidStepFieldIds(def.fields, steps ?? undefined, stepId, group);
        badIds.forEach((id) => group.controls[id]?.markAsTouched());
        this.validationErrors.set(
          badIds.map((id) => def.fields.find((f) => f.id === id)?.label ?? id),
        );
        this.currentStepIndex.set(cursor);
        return;
      }
      cursor += 1;
    }
    this.currentStepIndex.set(target);
    this.validationErrors.set([]);
  }

  /** Submit stays disabled while any visible field fails its validators. */
  readonly canSubmit = computed(() => {
    this.validityTick();
    const group = this.form();
    if (!group) return false;
    return Object.values(group.controls).every((control) => control.disabled || control.valid);
  });

  readonly saveStateLabel = computed(() => {
    switch (this.saveState()) {
      case 'saving':
        return this.t.saving;
      case 'saved':
        return interpolate(this.t.savedDraft, { time: this.lastSavedAt() ?? '' });
      case 'pending':
        return this.t.unsavedChanges;
      default:
        return '';
    }
  });

  /** Rendered validation summary line for the current invalid fields. */
  validationSummaryText(): string {
    return interpolate(this.t.validationSummary, {
      count: this.validationErrors().length,
      fields: this.validationErrors().join(', '),
    });
  }

  draftBodyText(prompt: DraftPromptData): string {
    return interpolate(this.t.draftBody, { savedAt: prompt.savedAt });
  }

  mergeWarningText(prompt: DraftPromptData): string {
    return interpolate(this.t.draftMergeWarning, {
      restored: prompt.report.restored.length,
      dropped: this.droppedList(prompt),
    });
  }

  submittedBodyText(): string {
    return interpolate(this.t.submittedBody, { version: this.submittedVersion() });
  }

  isHidden(fieldId: string): boolean {
    return this.engine?.isHidden(fieldId) ?? false;
  }

  /** Dependency-chain depth — drives the visual indentation of nested fields. */
  readonly fieldDepths = computed(() => {
    const def = this.definitionState();
    return def ? computeDependencyDepths(def.fields, def.dependencies) : new Map<string, number>();
  });

  depthOf(fieldId: string): number {
    return this.fieldDepths().get(fieldId) ?? 0;
  }

  columnSpan(field: FieldDefinition): number {
    return Math.min(12, Math.max(3, field.columns ?? 12));
  }

  /**
   * Layout rows: an independent field that FOLLOWS an indented chain is
   * forced to restart at grid column 1, so it realigns with the root
   * ("father") level instead of trailing the nested block.
   */
  readonly layoutRows = computed(() => {
    const def = this.definitionState();
    if (!def) return [];
    const excluded = this.excludeFieldTypes();
    const rows: Array<{
      field: FieldDefinition;
      depth: number;
      span: number;
      restartAtRoot: boolean;
    }> = [];
    let previousDepth = 0;
    for (const field of def.fields) {
      const depth = this.fieldDepths().get(field.id) ?? 0;
      const isSection = field.type === 'section';
      const excludedField = field.type === 'hidden' || excluded.includes(field.type);
      rows.push({
        field,
        depth,
        span: isSection ? 12 : this.columnSpan(field),
        restartAtRoot: !isSection && !excludedField && depth === 0 && previousDepth > 0,
      });
      previousDepth = isSection || excludedField ? 0 : depth;
    }
    return rows;
  });

  droppedList(prompt: DraftPromptData): string {
    return prompt.report.dropped.map((d) => d.fieldId).join(', ') || 'none';
  }

  // ---------- drafts ----------

  private async checkForDraft(): Promise<void> {
    const def = this.definitionState();
    if (!def || !this.responsesRepo) return;

    const draft = await this.service.getDraft(def.id, this.respondentContext());
    if (!draft) return;

    this.activeDraftId = draft.id;
    const { values, report } = mergeDraftValues(draft.values, def);
    this.draftPrompt.set({
      values,
      savedAt: new Date(draft.updatedAt).toLocaleString(),
      report,
      draftId: draft.id,
    });
  }

  loadDraft(): void {
    const prompt = this.draftPrompt();
    const def = this.definitionState();
    if (!prompt || !this.form() || !def) return;
    this.form()!.patchValue(deserializeValues(def, prompt.values), {
      emitEvent: false,
    });
    // patching silently skips valueChanges — re-run the engine + visibility
    // sync so conditional fields reflect the restored answers immediately.
    this.engine?.reevaluate();
    this.syncHiddenControls();
    this.validityTick.update((v) => v + 1);
    this.draftPrompt.set(null);
  }

  async startOver(): Promise<void> {
    const prompt = this.draftPrompt();
    if (prompt) {
      await this.service.discardDraft(prompt.draftId);
      this.activeDraftId = null;
    }
    this.draftPrompt.set(null);
  }

  saveDraftExplicit(): void {
    void this.persistDraft(true);
  }

  private async persistDraft(explicit: boolean): Promise<void> {
    const def = this.definitionState();
    const group = this.form();
    if (!def || !group || !this.responsesRepo) return;
    if (!explicit && !group.dirty) return;

    this.saveState.set('saving');
    try {
      const draft = await this.service.saveDraft({
        definition: def,
        values: serializeValues(def, group.getRawValue()),
        respondentContext: this.respondentContext(),
        existingDraftId: this.activeDraftId ?? undefined,
      });
      this.activeDraftId = draft.id;
      this.lastSavedAt.set(new Date().toLocaleTimeString());
      this.saveState.set('saved');
      group.markAsPristine();
      this.draftSaved.emit(draft);
    } catch {
      this.saveState.set('idle');
    }
  }

  // ---------- submit ----------

  submit(): void {
    const group = this.form();
    const def = this.definitionState();
    if (!group || !def) return;

    this.engine?.reevaluate();

    const invalidIds = Object.entries(group.controls)
      .filter(([, control]) => control.enabled && control.invalid)
      .map(([id]) => id);

    if (invalidIds.length > 0) {
      group.markAllAsTouched();
      this.validationErrors.set(
        invalidIds.map((id) => def.fields.find((f) => f.id === id)?.label ?? id),
      );
      return;
    }
    this.validationErrors.set([]);

    const values = serializeValues(def, group.getRawValue());

    const finalize = (response: FormResponse): void => {
      this.submittedVersion.set(response.formVersion);
      this.status.set('submitted');
      this.submitted.emit(response);
    };

    if (!this.responsesRepo) {
      finalize({
        id: crypto.randomUUID(),
        formId: def.id,
        formVersion: def.version,
        respondentContext: this.respondentContext(),
        values,
        submittedAt: new Date().toISOString(),
      });
      return;
    }

    void this.service
      .submitResponse({
        definition: def,
        values,
        respondentContext: this.respondentContext(),
      })
      .then((result) => {
        this.activeDraftId = null;
        finalize(result.response);
      });
  }
}
