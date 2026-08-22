import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DemoRole, DemoState } from './demo-state';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, FormsModule],
  templateUrl: './app.html',
  styles: `
    .brand-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 6px;
      background: var(--ndf-primary);
      color: var(--ndf-primary-contrast);
      font-size: 0.8rem;
    }
    .accent-picker {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      color: var(--ndf-text-muted);
    }
    .accent-picker input[type='color'] {
      width: 1.5rem;
      height: 1.5rem;
      padding: 0;
      border: 1px solid var(--ndf-border);
      border-radius: 6px;
      background: none;
      cursor: pointer;
    }
    .icon-btn {
      display: inline-flex;
      align-items: center;
      border: none;
      background: transparent;
      padding: 0.35rem 0.5rem;
      border-radius: 6px;
      cursor: pointer;
      color: var(--ndf-text-muted);
      font-size: 1rem;
    }
    .icon-btn:hover {
      background: var(--ndf-surface-alt);
      color: var(--ndf-text);
    }
  `,
})
export class App {
  readonly state = inject(DemoState);
  private readonly router = inject(Router);

  readonly roles: Array<{ label: string; value: DemoRole }> = [
    { label: 'Admin (all permissions)', value: 'admin' },
    { label: 'Designer (design only)', value: 'designer' },
    { label: 'Respondent (answer only)', value: 'respondent' },
    { label: 'Viewer (view answers only)', value: 'viewer' },
    { label: 'None (no permissions)', value: 'none' },
  ];

  /** Live demonstration of theme customization via CSS variables. */
  readonly accent = computed(() => this.state.accent());

  setAccent(color: string): void {
    document.documentElement.style.setProperty('--ndf-primary', color);
    this.state.setAccent(color);
  }

  get selectedRole(): DemoRole {
    return this.state.role();
  }
  set selectedRole(role: DemoRole) {
    this.state.setRole(role);
  }

  goHome(): void {
    void this.router.navigate(['/']);
  }
}
