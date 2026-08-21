import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FormDefinition,
  NgxFormsService,
  ResolvedPermissions,
} from '@n0n3br/ngx-dynamic-forms-core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DemoState } from '../demo-state';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    InputTextModule,
    TagModule,
    TooltipModule,
  ],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  readonly state = inject(DemoState);
  private readonly service = inject(NgxFormsService);

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
    window.location.assign(`/builder/${created.id}`);
  }

  async duplicate(form: FormDefinition): Promise<void> {
    await this.service.duplicateForm(form.id, undefined, this.state.userName());
    await this.refresh();
  }

  async archive(form: FormDefinition): Promise<void> {
    await this.service.archive(form.id);
    await this.refresh();
  }

  statusSeverity(status: string): 'success' | 'warn' | 'secondary' {
    if (status === 'published') return 'success';
    if (status === 'draft') return 'warn';
    return 'secondary';
  }
}
