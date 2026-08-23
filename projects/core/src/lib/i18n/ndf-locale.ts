import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';

/**
 * User-facing strings rendered by the libraries (responder + viewer).
 * Designer-facing builder strings stay English-only for now.
 * `{placeholder}` tokens are replaced via {@link interpolate}.
 */
export interface NdfLocale {
  // responder — state cards
  readonly blockedTitle: string;
  readonly blockedBody: string;
  readonly missingTitle: string;
  readonly missingBody: string;
  readonly submittedTitle: string;
  readonly submittedBody: string; // {version}
  // responder — draft dialog
  readonly draftTitle: string;
  readonly draftBody: string; // {savedAt}
  readonly draftMergeWarning: string; // {restored} {dropped}
  readonly draftStartOver: string;
  readonly draftLoad: string;
  // responder — footer
  readonly saveDraft: string;
  readonly submit: string;
  readonly next: string;
  readonly back: string;
  readonly saving: string;
  readonly savedDraft: string; // {time}
  readonly unsavedChanges: string;
  // responder — validation
  readonly validationSummary: string; // {count}
  // viewer
  readonly viewerBlockedTitle: string;
  readonly viewerBlockedBody: string;
  readonly viewerMissingTitle: string;
  readonly viewerMissingBody: string;
  readonly viewerSubmittedAt: string;
  readonly viewerStaleVersion: string; // {latest}
  readonly viewerEmpty: string;
}

export const NDF_LOCALE_EN: NdfLocale = {
  blockedTitle: 'Not authorized',
  blockedBody: "You don't have permission to answer this form.",
  missingTitle: 'Form not available',
  missingBody: 'This form has no published version yet.',
  submittedTitle: 'Answer submitted',
  submittedBody:
    'Thank you! Your answers were recorded against version {version} of this form.',
  draftTitle: 'Draft found',
  draftBody:
    'You have a saved draft for this form (saved {savedAt}). Load your previous answers or start over?',
  draftMergeWarning:
    'The form changed since your draft — {restored} value(s) restored, dropped: {dropped}.',
  draftStartOver: 'Start over',
  draftLoad: 'Load draft',
  saveDraft: 'Save & continue later',
  submit: 'Submit',
  next: 'Next',
  back: 'Back',
  saving: 'Saving…',
  savedDraft: 'Draft saved {time}',
  unsavedChanges: 'Unsaved changes…',
  validationSummary: 'Please fix {count} highlighted field(s): {fields}',
  viewerBlockedTitle: 'Not authorized',
  viewerBlockedBody: "You don't have permission to view this answer.",
  viewerMissingTitle: 'Answer not found',
  viewerMissingBody: 'It may have been deleted.',
  viewerSubmittedAt: 'Submitted',
  viewerStaleVersion: 'answered against an older version (latest: v{latest})',
  viewerEmpty: 'This answer is empty.',
};

export const NDF_LOCALE_PT_BR: NdfLocale = {
  blockedTitle: 'Não autorizado',
  blockedBody: 'Você não tem permissão para responder este formulário.',
  missingTitle: 'Formulário indisponível',
  missingBody: 'Este formulário ainda não possui versão publicada.',
  submittedTitle: 'Resposta enviada',
  submittedBody: 'Obrigado! Suas respostas foram registradas na versão {version} deste formulário.',
  draftTitle: 'Rascunho encontrado',
  draftBody:
    'Você tem um rascunho salvo deste formulário (salvo em {savedAt}). Carregar suas respostas anteriores ou começar de novo?',
  draftMergeWarning:
    'O formulário mudou desde o seu rascunho — {restored} valor(es) restaurado(s), descartados: {dropped}.',
  draftStartOver: 'Começar de novo',
  draftLoad: 'Carregar rascunho',
  saveDraft: 'Salvar e continuar depois',
  submit: 'Enviar',
  next: 'Próximo',
  back: 'Voltar',
  saving: 'Salvando…',
  savedDraft: 'Rascunho salvo {time}',
  unsavedChanges: 'Alterações não salvas…',
  validationSummary: 'Corrija {count} campo(s) destacado(s): {fields}',
  viewerBlockedTitle: 'Não autorizado',
  viewerBlockedBody: 'Você não tem permissão para ver esta resposta.',
  viewerMissingTitle: 'Resposta não encontrada',
  viewerMissingBody: 'Ela pode ter sido excluída.',
  viewerSubmittedAt: 'Enviado em',
  viewerStaleVersion: 'respondida numa versão mais antiga (atual: v{latest})',
  viewerEmpty: 'Esta resposta está vazia.',
};

/** Built-in dictionaries by locale code. */
export const NDF_LOCALES: Record<string, NdfLocale> = {
  en: NDF_LOCALE_EN,
  'pt-BR': NDF_LOCALE_PT_BR,
};

export const NDF_LOCALE = new InjectionToken<NdfLocale>(
  '@n0n3br/ngx-dynamic-forms-core NDF_LOCALE',
  { factory: () => NDF_LOCALE_EN },
);

/**
 * Locale wiring for apps:
 * ```ts
 * provideNdfLocale('pt-BR')
 * provideNdfLocale({ submit: 'Send it' })   // partial overrides on top of en
 * ```
 */
export function provideNdfLocale(
  locale: keyof typeof NDF_LOCALES | Partial<NdfLocale>,
): EnvironmentProviders {
  const resolved =
    typeof locale === 'string'
      ? (NDF_LOCALES[locale] ?? NDF_LOCALE_EN)
      : { ...NDF_LOCALE_EN, ...locale };
  return makeEnvironmentProviders([{ provide: NDF_LOCALE, useValue: resolved }]);
}

/** Replaces `{token}` occurrences with the given params. */
export function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`,
  );
}
