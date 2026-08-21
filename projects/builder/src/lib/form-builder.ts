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
  FORM_DEFINITION_REPOSITORY,
  NgxFormsService,
  PermissionsInput,
  ResolvedPermissions,
  FieldTypeRegistry,
  validateDefinition,
  resolvePermissions,
} from '@n0n3br/ngx-dynamic-forms-core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
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
    ButtonModule,
    InputTextModule,
    CardModule,
    DialogModule,
    MessageModule,
    ProgressSpinnerModule,
    TooltipModule,
    BuilderPalette,
    BuilderCanvas,
    PropertyPanel,
    BuilderPreview,
    VersionHistory,
  ],
  providers: [FormBuilderStore, NgxFormsService],
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
