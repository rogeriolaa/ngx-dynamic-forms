import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder } from '@n0n3br/ngx-dynamic-forms-builder';
import type { FormDefinition } from '@n0n3br/ngx-dynamic-forms-core';
import { DemoState } from '../demo-state';

@Component({
  selector: 'app-builder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormBuilder],
  template: `
    @if (id(); as formId) {
      <ngx-form-builder
        [formId]="formId"
        [permissions]="state.permissions()"
        (definitionSaved)="onSaved()"
        (published)="onPublished($event)"
        (cancel)="goHome()"
      />
    }
  `,
})
export class BuilderPage {
  readonly state = inject(DemoState);
  private readonly router = inject(Router);

  readonly id = input<string>();

  onSaved(): void {
    // repository already persisted the working copy — nothing else to do here
  }

  onPublished(def: FormDefinition): void {
    void this.router.navigate(['/answer', def.id]);
  }

  goHome(): void {
    void this.router.navigate(['/']);
  }
}
