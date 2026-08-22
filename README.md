# ngx-dynamic-forms

Angular libraries for **schema-driven conditional forms**: design them visually,
publish immutable versions, answer with drafts & auto-save, and inspect every
submission against the exact version it was given on.

Built on [`@n0n3br/ngx-form-dependency-engine`](https://github.com/rogeriolaa/ngx-form-dependency-engine)
for rule evaluation.

## Packages

| Package | What it gives you |
|---|---|
| `@n0n3br/ngx-dynamic-forms-core` | Schema models, versioning + publish workflow, permissions, field-type registry, IndexedDB repositories (swap for HTTP), draft merge, shared field runtime, `--ndf-*` stylesheet |
| `@n0n3br/ngx-dynamic-forms-responder` | `<ngx-form-responder>` — interactive answering with drafts, auto-save, resume dialog, validity-gated submit |
| `@n0n3br/ngx-dynamic-forms-builder` | `<ngx-form-builder>` — WYSIWYG designer: palette, drag-and-drop canvas, property panel, graphical rule editor, version history, one-click publish |
| `@n0n3br/ngx-dynamic-forms-viewer` | `<ngx-form-viewer>` — read-only rendering of a submission pinned to its definition version |

## Quick start

```bash
npm i @n0n3br/ngx-dynamic-forms-core @n0n3br/ngx-dynamic-forms-builder \
      @n0n3br/ngx-dynamic-forms-responder @n0n3br/ngx-dynamic-forms-viewer
```

```ts
// app.config.ts
import { provideNgxForms } from '@n0n3br/ngx-dynamic-forms-core';

export const appConfig = {
  providers: [provideNgxForms()], // IndexedDB-backed repositories
};
```

```ts
// designer
<ngx-form-builder [formId]="id" (published)="onPublished($event)" />

// live form
<ngx-form-responder [formId]="id" [respondentContext]="user" />

// read-only answer
<ngx-form-viewer [responseId]="responseId" />
```

Import the stylesheet once (tokens + utilities):

```css
@import '@n0n3br/ngx-dynamic-forms-core/styles.css';
```

## Theming without forks

Every visual decision reads a CSS custom property. Override any of them on
`:root` or any container — no rebuild:

```css
:root {
  --ndf-primary: #7c3aed;
  --ndf-radius: 0.75rem;
}
.app-dark { /* toggle class on <html> for dark mode */ }
```

Tokens include surfaces (`--ndf-bg`, `--ndf-surface`, `--ndf-border*`),
text (`--ndf-text*`) and status colors (`--ndf-danger/warning/success*`).

## The versioning model

- A definition is edited as a **working copy** (`status: 'draft'`).
- **Publish** freezes that version — it becomes immutable.
- Further edits automatically open the next draft version (v+1).
- Every response stores the `formVersion` it answered; the viewer renders it
  against that exact version forever.

Rules are evaluated by the dependency engine with `collapseHiddenChains`
enabled: hiding a field resets it to its initial value in the same pass, so
conditional chains never leak stale answers into drafts or submissions.

## Field types (14)

`text · textarea · number · email · date · dropdown · multi-select · radio ·
checkbox · checkbox-group · rating · slider · section · hidden`

Restrict what a builder may use:

```html
<ngx-form-builder [allowedFieldTypes]="['text','radio','dropdown']" />
```

## Permissions

All three UI components accept `[permissions]` and resolve to
`{ canDesign, canAnswer, canView }`. Pass a static object or an async factory
(role lookup, JWT claims…). Without permission the components render a
blocked state instead of their body.

## Swapping persistence

Repositories are injection tokens — bring your own backend:

```ts
providers: [
  { provide: FORM_DEFINITION_REPOSITORY, useValue: myHttpDefinitionRepo },
  { provide: FORM_RESPONSE_REPOSITORY, useValue: myHttpResponseRepo },
]
```

The default `provideNgxForms()` wires IndexedDB (offline-first). Components
also work in *controlled mode*: pass `[definition]` / `[response]` inputs and
handle `(definitionSaved)` / `(submitted)` outputs yourself — nothing persists
without repositories.

## Development

```bash
npm start          # build libs once, then serve demo on :4200
npm test           # unit tests (Vitest) across all libs
npm run build:libs # ng-packagr x4 + compiled Tailwind stylesheet into dist/
```

See per-package READMEs under `projects/*/README.md` for full API tables.
