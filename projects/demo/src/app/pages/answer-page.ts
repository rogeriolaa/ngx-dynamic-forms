import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormResponder } from '@n0n3br/ngx-dynamic-forms-responder';
import { DemoState } from '../demo-state';

@Component({
  selector: 'app-answer-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .page-col { display: flex; flex-direction: column; gap: 1rem; }
    .answer-wrap { width: 100%; max-width: 48rem; margin: 0 auto; }
    .back-link {
      align-self: flex-start;
      color: var(--ndf-primary);
      text-decoration: none;
      font-size: 0.875rem;
    }
    .back-link:hover { text-decoration: underline; }
  `,
  imports: [RouterLink, FormResponder],
  template: `
    <div class="page-col">
      <a class="back-link" routerLink="/">← Back</a>
      @if (id(); as formId) {
        <div class="answer-wrap">
          <ngx-form-responder
            [formId]="formId"
            [respondentContext]="state.userName()"
            [permissions]="state.permissions()"
            data-testid="responder-host"
          />
        </div>
      }
    </div>
  `,
})
export class AnswerPage {
  readonly state = inject(DemoState);
  readonly id = input<string>();
}
