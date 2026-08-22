# @n0n3br/ngx-dynamic-forms-responder

`<ngx-form-responder>` renders a published form definition as an interactive,
validated form. Conditional behavior comes from the dependency engine (running
with `collapseHiddenChains: true`, so hidden fields never leak stale values
into drafts or submissions).

## Install

```bash
npm i @n0n3br/ngx-dynamic-forms-responder @n0n3br/ngx-dynamic-forms-core
```

Provide repositories once (`provideNgxForms()` or your own tokens — see core).

## Usage

### Repository mode (persistence handled for you)

```html
<ngx-form-responder
  [formId]="formId"
  [respondentContext]="user"          <!-- scopes drafts per respondent -->
  (submitted)="onSubmitted($event)"
  (draftSaved)="onDraftSaved($event)"
/>
```

Loads the latest **published** version, auto-saves drafts 1.2 s after typing,
offers "resume draft?" on return, gates submit on visible-field validity and
discards the draft on successful submission.

### Controlled mode (you own persistence)

```html
<ngx-form-responder
  [definition]="def"
  (submitted)="save($event)"
/>
```

Without response repositories nothing is written; `submitted` emits a complete
`FormResponse` you persist anywhere.

## Inputs / outputs

| Input | Type | Notes |
|---|---|---|
| `formId` | `string` | Repository mode |
| `definition` | `FormDefinition` | Controlled mode (takes precedence) |
| `respondentContext` | `unknown` | Opaque identity scoping drafts |
| `permissions` | `PermissionsInput` | Object or async factory → `{ canAnswer }`; blocked state otherwise |
| `excludeFieldTypes` | `FieldType[]` | Hide types from rendering; values still persist |

| Output | Payload |
|---|---|
| `submitted` | `FormResponse` |
| `draftSaved` | `FormResponseDraft` |

## Behavior details

- **Draft merge with warnings**: restoring a draft runs `mergeDraftValues`;
  answers whose field changed schema are dropped and surfaced in the resume
  dialog instead of corrupting the form.
- **Hidden ≠ submitted**: hidden controls are disabled (excluded from
  validation) and their values are omitted from serialization.
- **Chain collapse**: hiding a field resets it to its initial value inside the
  engine's evaluation pass, so nested conditionals (`A→B→C`) close correctly.
- **Layout**: fields render on a 12-column grid honoring `field.columns`;
  dependent fields indent by dependency depth and realign to root after a
  chain ends.
