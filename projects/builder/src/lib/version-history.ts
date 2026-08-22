import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  FormVersionSummary,
  NgxFormsService,
} from '@n0n3br/ngx-dynamic-forms-core';

/**
 * Version timeline for the current form: every frozen publish plus the
 * working draft. Publishing runs through NgxFormsService so warnings about
 * pinned historical responses surface before the write happens.
 */
@Component({
  selector: 'ngx-version-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe],
  styles: `
    .vh { display: flex; flex-direction: column; gap: 0.5rem; }
    .vh-title {
      margin: 0;
      font-size: 0.6875rem; font-weight: 600;
      letter-spacing: 0.05em; text-transform: uppercase;
      color: var(--ndf-text-muted);
    }
    .version-row {
      display: flex; align-items: center; gap: 0.5rem;
      border-radius: 6px; padding: 0.35rem 0.625rem;
      font-size: 0.8125rem;
      border: 1px solid var(--ndf-border);
    }
    :host-context(.app-dark) .version-row { border-color: var(--ndf-border); }
    .version-row.current { border-color: var(--p-primary-300); }
    :host-context(.app-dark) .version-row.current { border-color: var(--p-primary-700); }
    .version-num { font-weight: 600; }
    .version-date { margin-left: auto; font-size: 0.6875rem; color: var(--ndf-text-muted); }
    .vh-empty { margin: 0; font-size: 0.6875rem; color: var(--ndf-text-muted); }
  `,
  template: `
    <div class="vh" data-testid="version-history">
      <p class="vh-title">Versions</p>

      @if (publishWarning(); as warning) {
        <div class="ndf-alert ndf-alert--warn" data-testid="publish-warning">{{ warning }}</div>
      }

      @for (version of versions(); track version.version) {
        <div
          class="version-row"
          [class.current]="version.version === currentVersion()"
          [attr.data-testid]="'version-' + version.version"
        >
          <span class="version-num">v{{ version.version }}</span>
          <span
            class="ndf-badge"
            [class]="severityFor(version.status) === 'success' ? 'ndf-badge--success' : 'ndf-badge--warning'"
          >{{ version.status }}</span>
          <span class="version-date">{{ version.updatedAt | date: 'MMM d, HH:mm' }}</span>
        </div>
      }
      @if (versions().length === 0) {
        <p class="vh-empty">No versions yet — save first.</p>
      }

      @if (publishWarning(); as warning) {
        <div class="ndf-alert ndf-alert--warn" data-testid="publish-warning">{{ warning }}</div>
      }
      @if (lastError(); as error) {
        <div class="ndf-alert ndf-alert--error" data-testid="publish-error">{{ error }}</div>
      }

      @if (draftVersion() !== null && canPublish()) {
        <button
          type="button"
          class="ndf-btn w-full-ndf"
          style="width:100%"
          [disabled]="!canPublish()"
          data-testid="publish-btn"
          (click)="publish()"
        >
          Publish v{{ draftVersion() }}
        </button>
      }
    </div>
  `,
})
export class VersionHistory {
  readonly formId = input.required<string>();
  readonly currentVersion = input.required<number>();
  /** Draft status of the version being edited — publishing allowed only then. */
  readonly isDraft = input(true);

  readonly published = output<void>();

  private readonly service = inject(NgxFormsService);

  readonly versions = signal<FormVersionSummary[]>([]);
  readonly publishing = signal(false);
  readonly publishWarning = signal<string | null>(null);
  readonly lastError = signal<string | null>(null);

  readonly draftVersion = signal<number | null>(null);

  readonly canPublish = computed(() => this.isDraft() && this.draftVersion() !== null && !this.publishing());

  constructor() {
    effect(() => void this.refresh());
  }

  async refresh(): Promise<void> {
    const id = this.formId();
    if (!id) return;
    const versions = await this.service.listVersions(id);
    this.versions.set(versions);
    const draft = [...versions].reverse().find((v) => v.status === 'draft');
    this.draftVersion.set(draft?.version ?? null);
  }

  severityFor(status: string): 'success' | 'warn' {
    return status === 'published' ? 'success' : 'warn';
  }

  async publish(): Promise<void> {
    const version = this.draftVersion();
    if (version === null || this.publishing()) return;

    // pre-flight warning: how many answers are pinned to older versions?
    try {
      const counts = await this.service.listResponses(this.formId());
      const pinnedOlder = counts.filter((r) => r.formVersion < version).length;
      this.publishWarning.set(
        pinnedOlder > 0
          ? `Publishing creates a new immutable version. ${pinnedOlder} existing answer(s) stay on their original version and are unaffected.`
          : 'Publishing freezes this version — future structural edits will create v' +
              (version + 1) +
              '.',
      );
    } catch {
      /* repository without list support — skip warning */
    }

    this.publishing.set(true);
    this.lastError.set(null);
    try {
      await this.service.publish(this.formId(), version);
      await this.refresh();
      this.published.emit();
    } catch (error) {
      this.lastError.set(error instanceof Error ? error.message : 'Publish failed.');
    } finally {
      this.publishing.set(false);
    }
  }
}
