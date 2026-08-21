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
import { Subscription, debounceTime } from 'rxjs';
import {
  FieldDefinition,
  FieldType,
  FormDefinition,
  FormResponse,
  FormResponseDraft,
  FORM_DEFINITION_REPOSITORY,
  FORM_RESPONSE_REPOSITORY,
  FieldHost,
  NgxFormsService,
  PermissionsInput,
  ResolvedPermissions,
  DraftMergeReport,
  buildFormGroup,
  deserializeValues,
  mergeDraftValues,
  resolvePermissions,
  serializeValues,
} from '@n0n3br/ngx-dynamic-forms-core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

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
  imports: [
    ReactiveFormsModule,
    FieldHost,
    ButtonModule,
    CardModule,
    DialogModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  providers: [NgxFormsService],
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

  private engine: FormDependencyEngine | null = null;
  private engineSubscription: Subscription | null = null;
  private autoSaveSub: Subscription | null = null;
  private staticallyDisabled = new Set<string>();
  private activeDraftId: string | null = null;

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

      this.setupDefinition(resolved);
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

    this.teardownEngine();

    if (def.dependencies.length > 0) {
      this.engine = new FormDependencyEngine(built.group, def.dependencies as Dependency[]);
      this.engineSubscription = this.engine.activate();
    }

    const syncDisabledState = (): void => {
      const group = this.form();
      if (!group) return;
      for (const [fieldId, control] of Object.entries(group.controls)) {
        if (this.staticallyDisabled.has(fieldId)) continue;
        const hiddenByRule = this.engine?.isHidden(fieldId) ?? false;
        if (hiddenByRule && control.enabled) control.disable({ emitEvent: false });
        else if (!hiddenByRule && control.disabled) control.enable({ emitEvent: false });
      }
    };
    syncDisabledState();

    this.autoSaveSub?.unsubscribe();
    this.autoSaveSub = built.group.valueChanges
      .pipe(debounceTime(AUTO_SAVE_DEBOUNCE_MS))
      .subscribe(() => {
        syncDisabledState();
        if (built.group.dirty) this.saveState.set('pending');
      });

    if (def.dependencies.length > 0) {
      setTimeout(syncDisabledState);
    }
  }

  private teardownEngine(): void {
    this.engineSubscription?.unsubscribe();
    this.autoSaveSub?.unsubscribe();
    this.engine?.destroy();
    this.engine = null;
    this.engineSubscription = null;
    this.autoSaveSub = null;
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

  readonly saveStateLabel = computed(() => {
    switch (this.saveState()) {
      case 'saving':
        return 'Saving…';
      case 'saved':
        return `Draft saved ${this.lastSavedAt() ?? ''}`;
      case 'pending':
        return 'Unsaved changes…';
      default:
        return '';
    }
  });

  isHidden(fieldId: string): boolean {
    return this.engine?.isHidden(fieldId) ?? false;
  }

  columnClass(field: FieldDefinition): string {
    return `col-span-${Math.min(12, Math.max(3, field.columns ?? 12))}`;
  }

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
