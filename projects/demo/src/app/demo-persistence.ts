import { inject } from '@angular/core';
import {
  FieldOption,
  IndexedDbFormsStore,
  provideNgxForms,
} from '@n0n3br/ngx-dynamic-forms-core';

/**
 * Demo persistence wiring + first-run seeding.
 * The same `provideNgxForms()` call is what production apps would use;
 * swapping to a real backend means providing the repository tokens with an
 * HTTP implementation instead.
 */
export function provideDemoPersistence() {
  const providers = provideNgxForms({ databaseName: 'demo-ngx-dynamic-forms' });
  void seedWhenEmpty();
  return providers;
}

async function seedWhenEmpty(): Promise<void> {
  // wait a tick so DI is ready
  await new Promise((resolve) => setTimeout(resolve, 50));
  try {
    const store = new IndexedDbFormsStore('demo-ngx-dynamic-forms');
    const existing = await store.listDefinitions();
    if (existing.length > 0) return;

    const now = new Date().toISOString();

    const opts = (...values: string[]): FieldOption[] =>
      values.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v }));

    // ---- Customer satisfaction form (published v1) with a dependency chain:
    // satisfied(radio) → reason(dropdown) → details(textarea, nested dep)
    const feedbackV1 = {
      id: 'seed-feedback',
      version: 1,
      status: 'published' as const,
      title: 'Customer satisfaction survey',
      description: 'Tell us how we are doing — takes about a minute.',
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed',
      publishedAt: now,
      dependencies: [
        {
          id: 'rule-reason',
          target: 'reason',
          when: {
            logic: 'AND' as const,
            conditions: [{ field: 'satisfied', operator: 'equals', value: 'no' }],
          },
          effects: [{ type: 'show' as const }, { type: 'setRequired' as const }],
          elseEffects: [{ type: 'unsetRequired' as const }],
        },
        {
          id: 'rule-details',
          target: 'details',
          when: {
            logic: 'AND' as const,
            conditions: [{ field: 'reason', operator: 'equals', value: 'support' }],
          },
          effects: [{ type: 'show' as const }],
        },
      ] as never[],
      fields: [
        {
          id: 'name',
          type: 'text' as const,
          label: 'Your name',
          placeholder: 'Jane Doe',
          columns: 6,
        },
        {
          id: 'email',
          type: 'email' as const,
          label: 'Email',
          placeholder: 'you@example.com',
          required: true,
          columns: 6,
        },
        {
          id: 'satisfied',
          type: 'radio' as const,
          label: 'Are you satisfied with our product?',
          required: true,
          defaultValue: 'yes',
          columns: 12,
          options: opts('yes', 'no'),
        },
        {
          id: 'reason',
          type: 'dropdown' as const,
          label: 'What fell short?',
          helpText: 'Shown when you are not satisfied.',
          columns: 6,
          options: opts('price', 'features', 'support', 'other'),
        },
        {
          id: 'details',
          type: 'textarea' as const,
          label: 'Support details',
          helpText: 'Shown when support is the issue.',
          rows: 3,
          columns: 8,
        },
        {
          id: 'rating',
          type: 'rating' as const,
          label: 'Overall score',
          max: 5,
          columns: 6,
        },
        {
          id: 'recommend',
          type: 'checkbox' as const,
          label: '',
          placeholder: 'I would recommend this product',
          columns: 12,
        },
        {
          id: 'newsletter-source',
          type: 'hidden' as const,
          label: 'Campaign source',
          defaultValue: 'direct',
        },
      ],
    };

    await store.seed(
      [feedbackV1],
      [
        {
          id: crypto.randomUUID(),
          formId: 'seed-feedback',
          formVersion: 1,
          respondentContext: 'seed-user',
          values: {
            name: 'Alice Seeded',
            email: 'alice@example.com',
            satisfied: 'no',
            reason: 'support',
            details: 'Waited two days for a reply.',
            rating: 3,
            recommend: false,
            'newsletter-source': 'direct',
          },
          submittedAt: now,
        },
      ],
    );
  } catch {
    /* seeding is best-effort */
  }
}
