import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard-page';

export const routes: Routes = [
  { path: '', component: DashboardPage, title: 'Forms — dashboard' },
  {
    path: 'builder/:id',
    loadComponent: () => import('./pages/builder-page').then((m) => m.BuilderPage),
    title: 'Design form',
  },
  {
    path: 'answer/:id',
    loadComponent: () => import('./pages/answer-page').then((m) => m.AnswerPage),
    title: 'Answer form',
  },
  {
    path: 'responses/:id',
    loadComponent: () => import('./pages/responses-page').then((m) => m.ResponsesPage),
    title: 'Responses',
  },
  {
    path: 'view/:responseId',
    loadComponent: () => import('./pages/view-page').then((m) => m.ViewPage),
    title: 'View answer',
  },
  { path: '**', redirectTo: '' },
];
