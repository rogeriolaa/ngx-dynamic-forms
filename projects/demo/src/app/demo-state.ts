import { Injectable, effect, signal } from '@angular/core';
import {
  FormPermissions,
  permissionsForRole,
} from '@n0n3br/ngx-dynamic-forms-core';

export type DemoRole = 'admin' | 'designer' | 'respondent' | 'viewer' | 'none';

@Injectable({ providedIn: 'root' })
export class DemoState {
  readonly role = signal<DemoRole>('admin');
  readonly userName = signal<string>('demo-user');
  readonly darkMode = signal(false);

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('app-dark', this.darkMode());
    });
  }

  permissions(): FormPermissions {
    return permissionsForRole(this.role());
  }

  setRole(role: DemoRole): void {
    this.role.set(role);
  }
}
