import {
  EnvironmentProviders,
  Provider,
  provideAppInitializer,
} from '@angular/core';
import {
  FORM_DEFINITION_REPOSITORY,
  FORM_RESPONSE_REPOSITORY,
  FormDefinition,
  FormResponse,
  FieldOption,
  IndexedDbFormsStore,
  createIndexedDbDefinitionRepository,
  createIndexedDbResponseRepository,
} from '@n0n3br/ngx-dynamic-forms-core';

const DEMO_DB = 'demo-ngx-dynamic-forms';

/**
 * Demo persistence wiring + first-run seeding.
 *
 * The repository tokens are exactly what production apps would provide
 * themselves (e.g. an HTTP implementation); swapping backends never touches
 * the library components.
 */
export function provideDemoPersistence(): Array<Provider | EnvironmentProviders> {
  const store = new IndexedDbFormsStore(DEMO_DB);
  return [
    { provide: IndexedDbFormsStore, useValue: store },
    { provide: FORM_DEFINITION_REPOSITORY, useValue: createIndexedDbDefinitionRepository(store) },
    { provide: FORM_RESPONSE_REPOSITORY, useValue: createIndexedDbResponseRepository(store) },
    // block first render until demo content exists so lists are populated
    provideAppInitializer(() => seedWhenEmpty(store)),
  ];
}

async function seedWhenEmpty(store: IndexedDbFormsStore): Promise<void> {
  try {
    const existing = await store.listDefinitions();
    if (existing.length > 0) return;
    await store.seed(buildSeedForms(), buildSeedResponses());
  } catch {
    /* seeding is best-effort */
  }
}

const opts = (...values: string[]): FieldOption[] =>
  values.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v }));

function buildSeedForms(): FormDefinition[] {
  const now = new Date().toISOString();

  // Published form with a dependency chain:
  // satisfied → reason → details (nested / multi-hop)
  return [
    {
      id: 'seed-feedback',
      version: 1,
      status: 'published',
      title: 'Customer satisfaction survey',
      description: 'Tell us how we are doing — takes about a minute.',
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed',
      publishedAt: now,
      fields: [
        { id: 'name', type: 'text', label: 'Your name', placeholder: 'Jane Doe', columns: 6 },
        {
          id: 'email',
          type: 'email',
          label: 'Email',
          placeholder: 'you@example.com',
          required: true,
          columns: 6,
        },
        {
          id: 'satisfied',
          type: 'radio',
          label: 'Are you satisfied with our product?',
          required: true,
          defaultValue: 'yes',
          columns: 12,
          options: opts('yes', 'no'),
        },
        {
          id: 'reason',
          type: 'dropdown',
          label: 'What fell short?',
          helpText: 'Shown when you are not satisfied.',
          columns: 6,
          options: opts('price', 'features', 'support', 'other'),
        },
        {
          id: 'details',
          type: 'textarea',
          label: 'Support details',
          helpText: 'Shown when support is the issue.',
          rows: 3,
          columns: 8,
        },
        { id: 'rating', type: 'rating', label: 'Overall score', max: 5, columns: 6 },
        {
          id: 'recommend',
          type: 'checkbox',
          label: '',
          placeholder: 'I would recommend this product',
          columns: 12,
        },
        {
          id: 'newsletter-source',
          type: 'hidden',
          label: 'Campaign source',
          defaultValue: 'direct',
        },
      ],
      dependencies: [
        {
          id: 'rule-reason',
          target: 'reason',
          when: {
            logic: 'AND',
            conditions: [{ field: 'satisfied', operator: 'equals', value: 'no' }],
          },
          effects: [{ type: 'show' }, { type: 'setRequired' }],
          elseEffects: [{ type: 'hide' }, { type: 'unsetRequired' }],
        },
        {
          id: 'rule-details',
          target: 'details',
          when: {
            logic: 'AND',
            conditions: [{ field: 'reason', operator: 'equals', value: 'support' }],
          },
          effects: [{ type: 'show' }],
          elseEffects: [{ type: 'hide' }],
        },
      ] as FormDefinition['dependencies'],
    },
  ];
}

function buildSeedResponses(): FormResponse[] {
  return [
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
      submittedAt: new Date().toISOString(),
    },
  ];
}
