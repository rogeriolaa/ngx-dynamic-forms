import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import {
  createIndexedDbDefinitionRepository,
  createIndexedDbResponseRepository,
  IndexedDbFormsStore,
} from './indexeddb-repository';
import { FORM_DEFINITION_REPOSITORY, FORM_RESPONSE_REPOSITORY } from './repository';

export interface NgxFormsConfig {
  /** IndexedDB database name (defaults to `ngx-dynamic-forms`). */
  databaseName?: string;
}

/**
 * Wires the default IndexedDB-backed repositories. Swap any of them for your
 * own implementation by providing the raw tokens instead:
 *
 * ```ts
 * providers: [
 *   { provide: FORM_DEFINITION_REPOSITORY, useValue: myHttpRepo },
 *   { provide: FORM_RESPONSE_REPOSITORY, useValue: myHttpRepo },
 * ]
 * ```
 */
export function provideNgxForms(config?: NgxFormsConfig): EnvironmentProviders {
  const store = new IndexedDbFormsStore(config?.databaseName);
  return makeEnvironmentProviders([
    { provide: IndexedDbFormsStore, useValue: store },
    { provide: FORM_DEFINITION_REPOSITORY, useValue: createIndexedDbDefinitionRepository(store) },
    { provide: FORM_RESPONSE_REPOSITORY, useValue: createIndexedDbResponseRepository(store) },
  ]);
}

export { IndexedDbFormsStore };
