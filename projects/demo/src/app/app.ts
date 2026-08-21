import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DemoRole, DemoState } from './demo-state';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, FormsModule, ButtonModule, SelectModule, TagModule, TooltipModule],
  templateUrl: './app.html',
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

  goHome(): void {
    void this.router.navigate(['/']);
  }

  get selectedRole(): DemoRole {
    return this.state.role();
  }
  set selectedRole(role: DemoRole) {
    this.state.setRole(role);
  }
}
