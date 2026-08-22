import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  FormDefinition,
  NgxFormsService,
} from '@n0n3br/ngx-dynamic-forms-core';
import { DemoState } from '../demo-state';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, FormsModule],
  styles: `
    .new-form-btn { align-self: flex-start; }
    .form-icon { color: var(--ndf-primary); margin-top: 0.15rem; }
  `,
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  readonly state = inject(DemoState);
  private readonly service = inject(NgxFormsService);
  private readonly router = inject(Router);

  readonly forms = signal<FormDefinition[]>([]);
  readonly loading = signal(true);
  readonly showCreate = signal(false);
  readonly newTitle = signal('');

  readonly perms = computed(() => this.state.permissions());

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    const forms = await this.service.listForms();
    this.forms.set(forms);
    this.loading.set(false);
  }

  async create(): Promise<void> {
    const title = this.newTitle().trim() || 'Untitled form';
    const created = await this.service.createForm(title, this.state.userName());
    this.showCreate.set(false);
    this.newTitle.set('');
    await this.refresh();
    void this.router.navigate(['/builder', created.id]);
  }

  async duplicate(form: FormDefinition): Promise<void> {
    await this.service.duplicateForm(form.id, undefined, this.state.userName());
    await this.refresh();
  }

  async archive(form: FormDefinition): Promise<void> {
    await this.service.archive(form.id);
    await this.refresh();
  }

  statusSeverity(status: string): string {
    return status === 'published' ? 'ndf-badge--success' : 'ndf-badge--warning';
  }
}
