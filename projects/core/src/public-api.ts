/*
 * Public API of @n0n3br/ngx-dynamic-forms-core
 */

// Schema models
export * from './lib/models/field-definition';
export * from './lib/models/permissions';

// Versioning
export * from './lib/versioning/fingerprint';

// Validation & dependency-graph logic
export * from './lib/validation/validate-definition';
export * from './lib/validation/dependency-depth';

// Draft merge
export * from './lib/draft/merge-draft';

// Field type catalog + registry
export * from './lib/registry/field-types';
export * from './lib/registry/field-type-registry';

// Shared field runtime (FormGroup build + PrimeNG renderers)
// Used by the responder AND the builder's live preview.
export * from './lib/runtime/form-group-builder';
export * from './lib/runtime/fields/field-shell';
export * from './lib/runtime/fields/text-fields';
export * from './lib/runtime/fields/number-fields';
export * from './lib/runtime/fields/selection-fields';
export * from './lib/runtime/fields/field-host';

// Persistence ports, default IndexedDB implementation, DI helpers
export * from './lib/persistence/repository';
export * from './lib/persistence/indexeddb-repository';
export * from './lib/persistence/provide';
export * from './lib/persistence/forms-service';
