import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormResponder } from '@n0n3br/ngx-dynamic-forms-responder';
import { ButtonModule } from 'primeng/button';
import { DemoState } from '../demo-state';

@Component({
  selector: 'app-answer-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormResponder, ButtonModule],
  template: `
    <div class="flex flex-col gap-4">
      <p-button
        label="Back"
        icon="pi pi-arrow-left"
        size="small"
        variant="text"
        routerLink="/"
      />
      @if (id) {
        <div class="mx-auto w-full max-w-3xl">
          <ngx-form-responder
            [formId]="id"
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
  id!: string;

}
