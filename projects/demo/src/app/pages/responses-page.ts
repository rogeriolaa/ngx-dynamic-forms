import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FieldDefinition,
  FormDefinition,
  FormResponse,
  formatValue,
  NgxFormsService,
} from '@n0n3br/ngx-dynamic-forms-core';

interface DayBucket {
  day: string; // yyyy-mm-dd
  label: string; // MMM d
  count: number;
}

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
        <!-- submissions per day -->
        @if (dailyBuckets().length > 0) {
          <div class="ndf-card">
            <h2 class="card-title">Submissions — last 14 days</h2>
            <svg
              class="chart"
              viewBox="0 0 560 140"
              preserveAspectRatio="none"
              data-testid="submissions-chart"
              role="img"
              aria-label="Submissions per day"
            >
              @for (bucket of dailyBuckets(); track bucket.day; let i = $index) {
                <rect
                  class="bar"
                  [attr.x]="i * 40 + 8"
                  [attr.y]="138 - bucket.count * barHeight()"
                  [attr.width]="24"
                  [attr.height]="bucket.count * barHeight()"
                  rx="3"
                >
                  <title>{{ bucket.label }}: {{ bucket.count }}</title>
                </rect>
                <text class="bar-label" [attr.x]="i * 40 + 20" y="152" text-anchor="middle">
                  {{ bucket.label }}
                </text>
              }
            </svg>
            <p class="chart-total">{{ responses().length }} total</p>
          </div>
        }

        <div class="toolbar">
          <button type="button" class="ndf-btn ndf-btn--secondary" data-testid="export-csv-btn" (click)="exportCsv()">
            ⬇ Export CSV
          </button>
        </div>

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
    .toolbar { display: flex; justify-content: flex-end; }

    .card-title { margin: 0 0 0.5rem; font-size: 1rem; }
    .chart { width: 100%; height: 10rem; overflow: visible; }
    .bar { fill: var(--p-primary-400); }
    .bar-label { font-size: 9px; fill: var(--p-text-muted-color); }
    .chart-total { margin: 0.25rem 0 0; font-size: 0.75rem; color: var(--p-text-muted-color); }
  `,
})
export class ResponsesPage {
  private readonly service = inject(NgxFormsService);

  readonly responses = signal<FormResponse[]>([]);
  /** Column model gathered from every definition version present in answers. */
  private readonly definitions = signal<FormDefinition[]>([]);
  readonly id = input<string>();

  constructor() {
    effect(() => void this.load());
  }

  private async load(): Promise<void> {
    const formId = this.id();
    if (!formId) return;
    const list = await this.service.listResponses(formId);
    this.responses.set(list);

    const versions = [...new Set(list.map((r) => r.formVersion))];
    const defs = await Promise.all(
      versions.map((v) => this.service.getDefinition(formId, v)),
    );
    this.definitions.set(defs.filter((d): d is FormDefinition => !!d));
  }

  // ---------- chart ----------

  readonly dailyBuckets = computed<DayBucket[]>(() => {
    const responses = this.responses();
    if (responses.length === 0) return [];

    const days: string[] = [];
    const formatterDay = new Intl.DateTimeFormat('en-CA'); // yyyy-mm-dd
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(formatterDay.format(d));
    }
    const counts = new Map(days.map((day) => [day, 0]));
    for (const r of responses) {
      const key = formatterDay.format(new Date(r.submittedAt));
      if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
    }
    const labelFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
    return days.map((day) => ({
      day,
      label: labelFormat.format(new Date(`${day}T12:00:00`)),
      count: counts.get(day)!,
    }));
  });

  readonly maxCount = computed(() => Math.max(1, ...this.dailyBuckets().map((b) => b.count)));

  /** Pixel height of one submission inside the 120px plot area. */
  barHeight(): number {
    return Math.max(4, 110 / this.maxCount());
  }

  // ---------- CSV ----------

  exportCsv(): void {
    const csv = this.buildCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `responses-${this.id()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private columns(): FieldDefinition[] {
    const byId = new Map<string, FieldDefinition>();
    for (const def of this.definitions()) {
      for (const field of def.fields) {
        if (!byId.has(field.id)) byId.set(field.id, field);
      }
    }
    return [...byId.values()].filter((f) => f.type !== 'section' && f.type !== 'hidden');
  }

  private buildCsv(): string {
    const cols = this.columns();
    const header = ['respondent', 'submitted_at', 'version', ...cols.map((c) => c.label || c.id)];
    const rows = this.responses().map((response) => [
      this.respondentLabel(response),
      response.submittedAt,
      String(response.formVersion),
      ...cols.map((c) => this.cellText(c, response.values[c.id])),
    ]);
    return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  }

  private cellText(field: FieldDefinition, value: unknown): string {
    return formatValue(field, value);
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

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
