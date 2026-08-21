import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  FieldDefinition,
  FieldOption,
  FieldType,
  FormDefinition,
  FormResponse,
  FORM_DEFINITION_REPOSITORY,
  FORM_RESPONSE_REPOSITORY,
  NgxFormsService,
  PermissionsInput,
  ResolvedPermissions,
  computeDependencyDepths,
  resolvePermissions,
} from '@n0n3br/ngx-dynamic-forms-core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

interface DisplayRow {
  field: FieldDefinition;
  depth: number;
  /** Pre-formatted value ready for display. */
  display: string;
  isStars: boolean;
}

/**
 * `<ngx-form-viewer>` — read-only rendering of a submitted answer against
 * the exact definition version it was given on.
 *
 * - Repository mode: pass `responseId`; definition+response load through DI.
 * - Controlled mode: pass `[response]` and (for version pinning) let the
 *   repository resolve the definition, or pass nothing extra when you also
 *   provide `[definition]`.
 *
 * Hidden and excluded field types are skipped silently. Dependent fields
 * are indented under their parents so conditional structure stays visible.
 */
@Component({
  selector: 'ngx-form-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, CardModule, TagModule, ProgressSpinnerModule, MessageModule],
  providers: [NgxFormsService],
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

  // ---------- presentation ----------

  readonly rows = computed<DisplayRow[]>(() => {
    const def = this.definitionState();
    const response = this.responseData();
    if (!def || !response) return [];

    const depths = computeDependencyDepths(def.fields, def.dependencies);
    const excluded = new Set(this.excludeFieldTypes());

    return def.fields
      .filter((f) => f.type !== 'section' && f.type !== 'hidden' && !excluded.has(f.type))
      .map((field) => ({
        field,
        depth: depths.get(field.id) ?? 0,
        display: formatValue(field, response.values[field.id]),
        isStars: field.type === 'rating',
      }));
  });

  readonly staleVersion = computed(() => {
    const response = this.responseData();
    const latest = this.latestPublishedVersion();
    return response && latest !== null && response.formVersion < latest;
  });

  readonly submittedLabel = computed(() => {
    const response = this.responseData();
    return response
      ? new Date(response.submittedAt).toLocaleString()
      : '';
  });
}

function formatValue(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';

  switch (field.type) {
    case 'checkbox':
      return value === true ? 'Yes' : 'No';
    case 'multi-select':
    case 'checkbox-group': {
      const selected = Array.isArray(value) ? value : [];
      if (selected.length === 0) return '—';
      return selected
        .map((v) => labelFor(field, v))
        .join(', ');
    }
    case 'radio':
    case 'dropdown':
      return labelFor(field, value);
    case 'rating': {
      const n = Math.max(0, Math.min(Number(value), field.max ?? 5));
      return '★'.repeat(n) + '☆'.repeat(Math.max(0, (field.max ?? 5) - n));
    }
    case 'date':
      return typeof value === 'string'
        ? new Date(value).toLocaleDateString()
        : String(value);
    default:
      return String(value);
  }
}

function labelFor(field: FieldDefinition, rawValue: unknown): string {
  const option = (field.options ?? []).find((o: FieldOption) => o.value === rawValue);
  return option?.label ?? String(rawValue);
}
