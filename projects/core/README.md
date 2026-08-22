# @n0n3br/ngx-dynamic-forms-core

Shared foundation for the ngx-dynamic-forms suite: schema models, versioning +
publish workflow, permissions, field-type registry, persistence ports (with a
default IndexedDB implementation), draft merging and the field runtime used by
both the responder and the builder's live preview.

## Install

```bash
npm i @n0n3br/ngx-dynamic-forms-core
```

Peer deps: `@angular/core`, `@angular/forms`, `@angular/common`,
`@n0n3br/ngx-form-dependency-engine` (peer range `^0.0.4`).

## Stylesheet

```css
@import '@n0n3br/ngx-dynamic-forms-core/styles.css';
```

Ships the `--ndf-*` design-token sheet (light defaults + `.app-dark`
overrides) plus the compiled Tailwind utilities the components use. Hosts
retheme by overriding variables — see root README.

## Schema model

```ts
interface FormDefinition {
  id: string;
  version: number;
  status: 'draft' | 'published';
  title: string;
  description?: string;
  fields: FieldDefinition[];
  dependencies: Dependency[]; // engine rules
  createdAt / updatedAt / createdBy? / publishedAt?
}

interface FieldDefinition {
  id: string;            // unique, referenced by rules
  type: FieldType;       // 14 built-ins
  label: string;
  required?: boolean;
  columns?: 3|4|6|8|12;  // grid width
  helpText?, placeholder?, options?, max?, rows?, disabled?
}
```

## Persistence ports

```ts
provideNgxForms()                       // default IndexedDB repositories
{ provide: FORM_DEFINITION_REPOSITORY, useValue: ... } // your backend
{ provide: FORM_RESPONSE_REPOSITORY,   useValue: ... }
```

`FormDefinitionRepository`: `saveWorkingCopy · getOrCreateWorkingCopy · publish ·
getLatestPublished · listVersions · list · archive`.
`FormResponseRepository`: `save · listByForm · delete · saveDraft · getDraft · discardDraft`.

The IndexedDB store keeps every version as a row keyed `[id, version]`;
publish flips status immutably, edits always go through a fresh working copy.

## NgxFormsService

Thin orchestration used by all UI packages — useful directly:

```ts
service.createForm(title)                    → FormDefinition (draft v1)
service.saveWorkingCopy(def)                 → validates first, throws on errors
service.publish(id, version)                 → PublishReport { published, impact, responsesPerVersion }
service.getLatestPublished(id)
service.getOrCreateWorkingCopy(id)
service.submitResponse({ definition, values, respondentContext })
service.saveDraft(...) / getDraft(...) / discardDraft(...)
```

`impact` comes from structural fingerprinting (`classifyChange`):
`'none' | 'cosmetic' | 'structural'`.

## Validation & graph helpers

```ts
validateDefinition(def)      → DefinitionIssue[] { severity, message }
topologicalSort(fields, deps)→ cycle detection (powers the circular-rule error)
computeDependencyDepths(fields, deps) → Map<fieldId, depth> // visual nesting
collectConditionFields / collectEffectTargets
```

## Draft merge

```ts
mergeDraftValues(storedValues, def)
// → { values, report } — drops answers for fields that no longer exist,
//   resets schema-mismatched types, reports what was dropped so the
//   responder can warn instead of silently corrupting data.
serializeValues / deserializeValues // omit hidden-field noise
buildFormGroup(def) // reactive group with per-type initial values + validators
initialValueFor(field)
```

## Field registry

```ts
FieldTypeRegistry.get(type)  → { label, icon, defaultConfig, ... }
registry.setAllowed([...])   // restrict palette in embedded scenarios
```

Register custom types by extending the registry before the components boot.
