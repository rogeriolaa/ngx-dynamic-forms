import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  FieldDefinition,
  NdfIcon,
  FieldType,
  FormDefinition,
  FormResponse,
  FORM_DEFINITION_REPOSITORY,
  FORM_RESPONSE_REPOSITORY,
  NgxFormsService,
  PermissionsInput,
  computeDependencyDepths,
  formatValue,
  resolvePermissions,
} from '@n0n3br/ngx-dynamic-forms-core';

// Back-compat re-export — the canonical home is core's format-values module.
export { formatValue, labelFor } from '@n0n3br/ngx-dynamic-forms-core';


interface DisplayRow {
  field: FieldDefinition;
  depth: number;
  display: string;
  isStars: boolean;
  /** data:image URL to render inline (uploads/signatures) */
  image?: string;
}

/**
 * `<ngx-form-viewer>` — read-only rendering of a submitted answer against
 * the exact definition version it was given on. Hidden and excluded field
 * types are skipped silently; dependent fields indent under their parents.
 */
@Component({
  selector: 'ngx-form-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NdfIcon],
  providers: [NgxFormsService],
  styles: `
    .viewer { display: flex; flex-direction: column; gap: 1rem; }
    .viewer-head {
      border-bottom: 1px solid var(--ndf-border);
      padding-bottom: 0.75rem;
    }
    :host-context(.app-dark) .viewer-head { border-bottom-color: var(--ndf-border); }
    .head-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    .viewer-head h2 { margin: 0; font-size: 1.25rem; }
    .stale-note { font-size: 0.75rem; color: var(--ndf-warning); }
    :host-context(.app-dark) .stale-note { color: var(--ndf-warning); }
    .viewer-desc { margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--ndf-text-muted); }
    .submitted-at { margin: 0.25rem 0 0; font-size: 0.75rem; color: var(--ndf-text-muted); }

    .value-list { display: grid; grid-template-columns: 1fr; gap: 0.35rem 1rem; margin: 0; }
    @media (min-width: 40rem) {
      .value-list { grid-template-columns: minmax(9rem, 14rem) 1fr; }
    }
    .value-label { font-size: 0.875rem; color: var(--ndf-text-muted); }
    .value-text { margin: 0; font-size: 0.9375rem; }
    .stars-text { color: var(--p-amber-500); letter-spacing: 0.2em; font-size: 1rem; }
    .value-image {
      max-width: 16rem;
      max-height: 8rem;
      border: 1px solid var(--ndf-border);
      border-radius: 8px;
      background: #fff;
    }
    .viewer-empty { margin: 0; }
    .viewer-loading { display: flex; justify-content: center; padding: 2.5rem 0; }
    .state-card { text-align: center; padding: 2rem 0; }
    .state-card h3 { margin: 0.75rem 0 0; font-size: 1.05rem; color: var(--ndf-text); }
    .state-card p { margin: 0.5rem 0 0; font-size: 0.875rem; color: var(--ndf-text-muted); }
    .state-icon { color: var(--ndf-text-faint); --ndf-icon-size: 2.25rem; }
    .state-card h3 { margin: 0.75rem 0 0; font-size: 1.05rem; }
    .state-card p { margin: 0.5rem 0 0; font-size: 0.875rem; color: var(--ndf-text-muted); }
  `,
  templateUrl: './form-viewer.html',
})
export class FormViewer {
  readonly responseId = input<string | undefined>();
  readonly response = input<FormResponse | undefined>();
  readonly definition = input<FormDefinition | undefined>();
  readonly permissions = input<PermissionsInput | undefined>();
  readonly excludeFieldTypes = input<FieldType[]>([]);

  private readonly definitionsRepo = inject(FORM_DEFINITION_REPOSITORY, { optional: true });
  private readonly responsesRepo = inject(FORM_RESPONSE_REPOSITORY, { optional: true });
  private readonly service = inject(NgxFormsService);

  readonly status = signal<'loading' | 'ready' | 'blocked' | 'missing'>('loading');
  readonly responseData = signal<FormResponse | null>(null);
  readonly definitionState = signal<FormDefinition | null>(null);
  readonly latestPublishedVersion = signal<number | null>(null);

  constructor() {
    effect(() => void this.initialize());
  }

  private async initialize(): Promise<void> {
    const perms = await resolvePermissions(this.permissions());
    if (!perms.canView) {
      this.status.set('blocked');
      return;
    }

    this.status.set('loading');

    const directResponse = this.response();
    if (directResponse && this.definition()) {
      this.apply(directResponse, this.definition()!, null);
      return;
    }

    try {
      const loaded =
        directResponse ??
        (this.responseId() && this.responsesRepo
          ? await this.service.getResponse(this.responseId()!)
          : null);
      if (!loaded) {
        this.status.set('missing');
        return;
      }

      const def =
        this.definition() ??
        (this.definitionsRepo
          ? await this.service.getDefinition(loaded.formId, loaded.formVersion)
          : null);
      if (!def) {
        this.status.set('missing');
        return;
      }

      const latestPublished = this.definitionsRepo
        ? await this.service.getLatestPublished(def.id)
        : null;

      this.apply(loaded, def, latestPublished?.version ?? null);
    } catch {
      this.status.set('missing');
    }
  }

  private apply(
    response: FormResponse,
    definition: FormDefinition,
    latestPublished: number | null,
  ): void {
    this.responseData.set(response);
    this.definitionState.set(definition);
    this.latestPublishedVersion.set(latestPublished);
    this.status.set('ready');
  }

  readonly rows = computed<DisplayRow[]>(() => {
    const def = this.definitionState();
    const response = this.responseData();
    if (!def || !response) return [];

    const depths = computeDependencyDepths(def.fields, def.dependencies);
    const excluded = new Set(this.excludeFieldTypes());

    return def.fields
      .filter((f) => f.type !== 'section' && f.type !== 'hidden' && !excluded.has(f.type))
      .map((field) => {
        const value = response.values[field.id];
        const image = imageDataOf(field, value);
        return {
          field,
          depth: depths.get(field.id) ?? 0,
          display: image ? '' : formatValue(field, value),
          isStars: field.type === 'rating',
          image,
        };
      });
  });

  readonly staleVersion = computed(() => {
    const response = this.responseData();
    const latest = this.latestPublishedVersion();
    return response && latest !== null && response.formVersion < latest;
  });

  readonly submittedLabel = computed(() => {
    const response = this.responseData();
    return response ? new Date(response.submittedAt).toLocaleString() : '';
  });
}

/** Inline image for upload/signature answers; undefined → text rendering. */
function imageDataOf(field: FieldDefinition, value: unknown): string | undefined {
  const dataUrl =
    field.type === 'signature' && typeof value === 'string'
      ? value
      : field.type === 'file-upload' && value && typeof value === 'object'
        ? (value as { dataUrl?: unknown }).dataUrl
        : undefined;
  return typeof dataUrl === 'string' && dataUrl.startsWith('data:image') ? dataUrl : undefined;
}
