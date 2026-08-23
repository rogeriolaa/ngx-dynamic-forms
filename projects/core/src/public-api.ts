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
export * from './lib/validation/br-validators';

// Draft merge
export * from './lib/draft/merge-draft';

// Field type catalog + registry
export * from './lib/registry/field-types';
export * from './lib/registry/field-type-registry';

// Icon set (inline SVG, no icon-font dependency)
export * from './lib/icons/ndf-icon';

// i18n — locale dictionaries + DI wiring
export * from './lib/i18n/ndf-locale';

// Shared field runtime (FormGroup build + renderers)
// Used by the responder AND the builder's live preview.
export * from './lib/runtime/form-group-builder';
export * from './lib/runtime/wizard';
export * from './lib/runtime/fields/field-shell';
export * from './lib/runtime/fields/text-fields';
export * from './lib/runtime/fields/br-fields';
export * from './lib/runtime/fields/file-fields';
export * from './lib/runtime/format-values';
export * from './lib/runtime/fields/number-fields';
export * from './lib/runtime/fields/selection-fields';
export * from './lib/runtime/fields/field-host';

// Persistence ports, default IndexedDB implementation, DI helpers
export * from './lib/persistence/repository';
export * from './lib/persistence/indexeddb-repository';
export * from './lib/persistence/http-repositories';
export * from './lib/persistence/provide';
export * from './lib/persistence/forms-service';

// Test fixture builders (also handy for hosts writing their own specs)
export * from './testing/definition-fixtures';
