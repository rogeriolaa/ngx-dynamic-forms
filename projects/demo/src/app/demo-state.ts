import { Injectable, computed, effect, signal } from '@angular/core';
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
  private readonly accentColor = signal('#0284c7');

  /**
   * Stable reference per role — components receive this as an input, and a
   * fresh object on every change-detection pass would re-trigger their
   * initialization effects (form rebuilds, lost values).
   */
  readonly permissions = computed<FormPermissions>(() => permissionsForRole(this.role()));
  readonly accent = computed(() => this.accentColor());
  setAccent(color: string): void {
    this.accentColor.set(color);
  }

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('app-dark', this.darkMode());
    });
  }

  setRole(role: DemoRole): void {
    this.role.set(role);
  }
}
