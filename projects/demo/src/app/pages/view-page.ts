import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormViewer } from '@n0n3br/ngx-dynamic-forms-viewer';
import { DemoState } from '../demo-state';

@Component({
  selector: 'app-view-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .page-col { display: flex; flex-direction: column; gap: 1rem; }
    .back-row { align-self: flex-start; }
  `,
  imports: [RouterLink, FormViewer],
  template: `
    <div class="page-col">
      <a class="back-link" routerLink="/">← Back</a>
      @if (responseId(); as rid) {
        <ngx-form-viewer
          [responseId]="rid"
          [permissions]="state.permissions()"
        />
      }
    </div>
  `,
})
export class ViewPage {
  readonly state = inject(DemoState);
  readonly responseId = input<string>();
}
