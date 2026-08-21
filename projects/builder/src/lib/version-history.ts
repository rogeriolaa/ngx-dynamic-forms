import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  FormVersionSummary,
  NgxFormsService,
} from '@n0n3br/ngx-dynamic-forms-core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';

/**
 * Version timeline for the current form: every frozen publish plus the
 * working draft. Publishing runs through NgxFormsService so warnings about
 * pinned historical responses surface before the write happens.
 */
@Component({
  selector: 'ngx-version-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, TagModule, MessageModule, DatePipe],
  template: `
    <div class="flex flex-col gap-2" data-testid="version-history">
      <p class="mb-0 mt-0 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
        Versions
      </p>

      @if (publishWarning(); as warning) {
        <p-message severity="warn" [closable]="false" data-testid="publish-warning">
          {{ warning }}
        </p-message>
      }

      @for (version of versions(); track version.version) {
        <div
          class="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
          [class]="
            version.version === currentVersion()
              ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-950'
              : 'border-surface-200 dark:border-surface-700'
          "
          [attr.data-testid]="'version-' + version.version"
        >
          <span class="font-semibold">v{{ version.version }}</span>
          <p-tag
            [value]="version.status"
            [severity]="severityFor(version.status)"
            [rounded]="true"
          />
          <span class="ml-auto text-xs text-surface-400">
            {{ version.updatedAt | date: 'MMM d, HH:mm' }}
          </span>
        </div>
      }
      @if (versions().length === 0) {
        <p class="m-0 text-xs text-surface-400">No versions yet — save first.</p>
      }

      @if (lastError(); as error) {
        <p-message severity="error" [closable]="false" data-testid="publish-error">
          {{ error }}
        </p-message>
      }

      @if (draftVersion() !== null && canPublish()) {
        <p-button
          label="Publish v{{ draftVersion() }}"
          icon="pi pi-cloud-upload"
          size="small"
          styleClass="w-full"
          [loading]="publishing()"
          data-testid="publish-btn"
          (onClick)="publish()"
        />
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
