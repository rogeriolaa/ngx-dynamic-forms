import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FormResponse,
  NgxFormsService,
} from '@n0n3br/ngx-dynamic-forms-core';

@Component({
  selector: 'app-responses-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, RouterLink],
  template: `
    <div class="rsp">
      <div class="page-title-row">
        <h1>Responses</h1>
        <a class="back-link" routerLink="/">← Back</a>
      </div>

      @if (responses().length === 0) {
        <div class="ndf-card"><p class="muted-note" style="margin:0">No responses yet.</p></div>
      } @else {
        <div class="response-list" data-testid="response-list">
          @for (response of responses(); track response.id) {
            <a
              class="response-row"
              [routerLink]="['/view', response.id]"
              [attr.data-testid]="'response-' + response.id"
            >
              <span class="rsp-icon">👤</span>
              <span class="rsp-name">{{ respondentLabel(response) }}</span>
              <span class="ndf-badge ndf-badge--primary">v{{ response.formVersion }}</span>
              <span class="rsp-date">{{ response.submittedAt | date: 'MMM d, HH:mm' }}</span>
              <span class="rsp-chevron">›</span>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .rsp { display: flex; flex-direction: column; gap: 1rem; }
    .response-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .response-row {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--p-surface-200);
      text-decoration: none;
      color: var(--p-text-color);
      transition: border-color 0.15s ease;
    }
    :host-context(.app-dark) .response-row { border-color: var(--p-surface-700); }
    .response-row:hover { border-color: var(--p-primary-400); }
    .rsp-icon { color: var(--p-surface-400); }
    .rsp-name { font-size: 0.875rem; font-weight: 500; }
    .rsp-date { margin-left: auto; font-size: 0.75rem; color: var(--p-text-muted-color); }
    .rsp-chevron { font-size: 0.75rem; color: var(--p-surface-300); }
  `,
})
export class ResponsesPage {
  private readonly service = inject(NgxFormsService);

  readonly responses = signal<FormResponse[]>([]);
  readonly id = input<string>();

  constructor() {
    effect(() => void this.load());
  }

  private async load(): Promise<void> {
    const formId = this.id();
    if (!formId) return;
    const list = await this.service.listResponses(formId);
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
