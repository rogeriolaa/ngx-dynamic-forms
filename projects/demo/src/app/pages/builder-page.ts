import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder } from '@n0n3br/ngx-dynamic-forms-builder';
import type { FormDefinition } from '@n0n3br/ngx-dynamic-forms-core';
import { DemoState } from '../demo-state';

@Component({
  selector: 'app-builder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormBuilder],
  template: `
    @if (id) {
      <ngx-form-builder
        [formId]="id"
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

  /** Bound from the route param via withComponentInputBinding(). */
  id!: string;

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
