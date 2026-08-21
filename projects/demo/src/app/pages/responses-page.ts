import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FormResponse,
  NgxFormsService,
} from '@n0n3br/ngx-dynamic-forms-core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-responses-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, ButtonModule, CardModule, TagModule],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="m-0 text-xl font-semibold">Responses</h1>
        <p-button
          label="Back"
          icon="pi pi-arrow-left"
          size="small"
          variant="text"
          routerLink="/"
        />
      </div>

      @if (responses().length === 0) {
        <p-card><p class="m-0 text-sm text-surface-400">No responses yet.</p></p-card>
      } @else {
        <div class="flex flex-col gap-2" data-testid="response-list">
          @for (response of responses(); track response.id) {
            <a
              class="flex items-center gap-3 rounded-lg border border-surface-200 p-3 no-underline transition-colors hover:border-primary-400 dark:border-surface-700"
              [routerLink]="['/view', response.id]"
              [attr.data-testid]="'response-' + response.id"
            >
              <i class="pi pi-user text-surface-400"></i>
              <span class="text-sm font-medium">
                {{ respondentLabel(response) }}
              </span>
              <p-tag
                [value]="'v' + response.formVersion"
                severity="info"
                [rounded]="true"
              />
              <span class="ml-auto text-xs text-surface-400">
                {{ response.submittedAt | date: 'MMM d, HH:mm' }}
              </span>
              <i class="pi pi-chevron-right text-xs text-surface-300"></i>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class ResponsesPage {
  private readonly service = inject(NgxFormsService);

  readonly responses = signal<FormResponse[]>([]);
  id!: string;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const list = await this.service.listResponses(this.id);
    this.responses.set(list);
  }

  respondentLabel(response: FormResponse): string {
    const ctx = response.respondentContext;
    if (typeof ctx === 'string') return ctx === 'seed-user' ? 'Alice Seeded' : ctx;
    if (ctx && typeof ctx === 'object' && 'name' in ctx) {
      return String((ctx as Record<string, unknown>)['name']);
    }
    return 'Anonymous';
  }
}
