import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormViewer } from '@n0n3br/ngx-dynamic-forms-viewer';
import { ButtonModule } from 'primeng/button';
import { DemoState } from '../demo-state';

@Component({
  selector: 'app-view-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormViewer, ButtonModule],
  template: `
    <div class="flex flex-col gap-4">
      <p-button
        label="Back"
        icon="pi pi-arrow-left"
        size="small"
        variant="text"
        routerLink="/"
      />
      @if (responseId) {
        <ngx-form-viewer
          [responseId]="responseId"
          [permissions]="state.permissions()"
        />
      }
    </div>
  `,
})
export class ViewPage {
  readonly state = inject(DemoState);
  responseId!: string;
}
