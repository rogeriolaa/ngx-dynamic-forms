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
import { FormsModule } from '@angular/forms';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import {
  FieldType,
  FormDefinition,
  NdfIcon,
  FORM_DEFINITION_REPOSITORY,
  NgxFormsService,
  PermissionsInput,
  ResolvedPermissions,
  FieldTypeRegistry,
  validateDefinition,
  resolvePermissions,
} from '@n0n3br/ngx-dynamic-forms-core';
import { FormBuilderStore } from './form-builder-store';
import { BuilderPalette } from './builder-palette';
import { BuilderCanvas } from './builder-canvas';
import { PropertyPanel } from './property-panel';
import { BuilderPreview } from './builder-preview';
import { VersionHistory } from './version-history';

type BuilderStatus = 'loading' | 'ready' | 'blocked' | 'missing';

/**
 * `<ngx-form-builder>` — WYSIWYG designer.
 *
 * Repository mode: pass `formId` (+ `provideNgxForms()` in the host) and the
 * component manages loading, saving and publishing versions itself.
 * Controlled mode: pass `[definition]` instead; save/publish buttons emit
 * `(definitionSaved)` / `(publishRequested)` and skip persistence entirely
 * when no definition repository is provided.
 */
@Component({
  selector: 'ngx-form-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NdfIcon,
    BuilderPalette,
    BuilderCanvas,
    PropertyPanel,
    BuilderPreview,
    VersionHistory,
  ],
  providers: [FormBuilderStore, NgxFormsService],
  styles: `
    .builder { display: flex; flex-direction: column; }
    .builder-header {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--ndf-border);
    }
    :host-context(.app-dark) .builder-header { border-bottom-color: var(--ndf-border); }
    .title-input { flex: 1; min-width: 12rem; font-weight: 600; }
    .version-chip {
      border-radius: 999px;
      background: var(--ndf-border);
      padding: 0.25rem 0.625rem;
      font-size: 0.6875rem; font-weight: 500;
    }
    :host-context(.app-dark) .version-chip { background: var(--ndf-border); }
    .header-actions { display: flex; align-items: center; gap: 0.375rem; }

    .feedback { margin-top: 0.5rem; }

    .issues-panel {
      margin-top: 0.5rem;
      padding: 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--ndf-border);
    }
    :host-context(.app-dark) .issues-panel { border-color: var(--ndf-border); }
    .issues-title {
      margin: 0 0 0.5rem;
      font-size: 0.6875rem; font-weight: 600;
      letter-spacing: 0.05em; text-transform: uppercase;
      color: var(--ndf-text-muted);
    }
    .issue-row { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.25rem; font-size: 0.875rem; }
    .issue-row i { margin-top: 0.125rem; font-size: 0.75rem; }
    .issue-error i, .issue-error span { color: var(--ndf-danger); }
    .issue-warn i { color: var(--p-amber-500); }

    .builder-body {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-top: 0.75rem;
    }
    @media (min-width: 48rem) {
      .builder-body.design { grid-template-columns: 13rem minmax(0, 1fr) 18rem; }
      .builder-body.previewing { grid-template-columns: minmax(0, 1fr); }
    }

    .empty-properties {
      border: 1px dashed var(--ndf-border-strong);
      border-radius: 12px;
      text-align: center;
      padding: 1.5rem 1rem;
    }
    :host-context(.app-dark) .empty-properties { border-color: var(--ndf-border); }
    .empty-properties i { font-size: 1.5rem; color: var(--ndf-border-strong); }
    .empty-properties p { margin: 0.5rem 0 0; font-size: 0.8125rem; }
    .empty-properties p + p { margin-top: 0; font-size: 0.6875rem; color: var(--ndf-text-muted); }

    .properties-frame {
      border: 1px solid var(--ndf-border);
      border-radius: 12px;
      overflow: hidden;
    }
    :host-context(.app-dark) .properties-frame { border-color: var(--ndf-border); }
    .state-card { text-align: center; padding: 2rem 0; color: var(--ndf-text); }
    .state-card h3 { margin: 0.75rem 0 0; font-size: 1.05rem; }
    .state-card p { margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--ndf-text-muted); }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgb(0 0 0 / 45%);
    }
    .modal {
      width: min(24rem, 92vw);
      max-height: 86vh;
      overflow: auto;
      border-radius: 12px;
      padding: 1.25rem;
      background: var(--ndf-surface);
      border: 1px solid var(--ndf-border);
    }
    .modal.wide { width: min(34rem, 94vw); }
    .modal h3 { margin: 0 0 0.75rem; font-size: 1.05rem; color: var(--ndf-text); }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    .dialog-actions.split { justify-content: space-between; }
    .json-area { font-family: ui-monospace, monospace; font-size: 0.7rem; }

    .icon-btn {
      display: inline-flex;
      border: none;
      background: transparent;
      padding: 0.375rem;
      border-radius: 6px;
      cursor: pointer;
      color: var(--ndf-text-muted);
    }
    .icon-btn:hover { background: var(--ndf-surface-alt); color: var(--ndf-text); }
  `,
  templateUrl: './form-builder.html',
})
export class FormBuilder {
  readonly formId = input<string | undefined>();
  readonly definition = input<FormDefinition | undefined>();
  readonly permissions = input<PermissionsInput | undefined>();
  /** Restrict palette to these field types. */
  readonly allowedFieldTypes = input<FieldType[] | undefined>();

  readonly definitionSaved = output<FormDefinition>();
  readonly published = output<FormDefinition>();
  readonly cancel = output<void>();

  readonly store = inject(FormBuilderStore);
  private readonly registry = inject(FieldTypeRegistry);
  private readonly definitionsRepo = inject(FORM_DEFINITION_REPOSITORY, { optional: true });
  private readonly service = inject(NgxFormsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<BuilderStatus>('loading');
  readonly permissionsResolved = signal<ResolvedPermissions>({
    canDesign: false,
    canAnswer: false,
    canView: false,
  });
  readonly saving = signal(false);
  readonly lastSaveInfo = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly showIssues = signal(false);
  readonly showVersions = signal(false);
  readonly showImportExport = signal(false);

  constructor() {
    effect(() => void this.initialize());
    this.destroyRef.onDestroy(() => this.store.definition.set(null));
  }

  private async initialize(): Promise<void> {
    if (this.allowedFieldTypes()) {
      this.registry.setAllowed(this.allowedFieldTypes()!);
    }

    const perms = await resolvePermissions(this.permissions());
    this.permissionsResolved.set(perms);
    if (!perms.canDesign) {
      this.status.set('blocked');
      return;
    }

    this.status.set('loading');
    try {
      let resolved: FormDefinition | null = null;
      if (this.definition()) {
        resolved = structuredClone(this.definition()!);
      } else if (this.formId()) {
        // always edit a working copy — never mutate published versions
        resolved = await this.service.getOrCreateWorkingCopy(this.formId()!);
      }
      if (!resolved) {
        this.status.set('missing');
        return;
      }
      this.store.load(resolved);
      this.status.set('ready');
    } catch {
      this.status.set('missing');
    }
  }

  readonly canPersist = computed(() => !!this.definitionsRepo && !!this.formId());

  readonly issues = computed(() => this.store.issues());
  readonly errors = computed(() => this.issues().filter((i) => i.severity === 'error'));
  readonly warnings = computed(() => this.issues().filter((i) => i.severity === 'warning'));

  onDependenciesChange(deps: Dependency[]): void {
    this.store.setDependencies(deps);
  }

  async save(): Promise<void> {
    const def = this.store.definition();
    if (!def) return;

    const blocking = validateDefinition(def).filter((i) => i.severity === 'error');
    if (blocking.length > 0) {
      this.saveError.set(
        `${blocking.length} blocking issue(s): ${blocking.map((e) => e.message).join(' ')}`,
      );
      this.showIssues.set(true);
      return;
    }

    if (!this.canPersist()) {
      // controlled mode — hand the edited definition back to the host app
      this.definitionSaved.emit(def);
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    try {
      const { saved } = await this.service.saveWorkingCopy(def);
      this.store.load(saved);
      this.lastSaveInfo.set(`Draft saved ${new Date().toLocaleTimeString()}`);
      this.definitionSaved.emit(saved);
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      this.saving.set(false);
    }
  }

  importJson(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as FormDefinition;
      // fresh identity so imports never overwrite an existing form
      parsed.id = crypto.randomUUID();
      parsed.version = 1;
      parsed.status = 'draft';
      this.store.load(parsed);
      this.showImportExport.set(false);
    } catch {
      this.saveError.set('Invalid JSON.');
    }
  }

  exportJson(): string {
    const def = this.store.definition();
    return JSON.stringify(def, null, 2);
  }

  downloadJson(): void {
    const blob = new Blob([this.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(this.store.definition()?.title ?? 'form').replace(/\s+/g, '-').toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  togglePreview(): void {
    this.store.previewMode.update((v) => !v);
  }

  doCancel(): void {
    this.cancel.emit();
  }
}
