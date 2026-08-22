# @n0n3br/ngx-dynamic-forms-viewer

`<ngx-form-viewer>` — read-only rendering of a submitted answer against the
exact definition version it was given on.

## Install

```bash
npm i @n0n3br/ngx-dynamic-forms-viewer @n0n3br/ngx-dynamic-forms-core
```

## Usage

```html
<!-- by stored response id (loads response + its pinned definition) -->
<ngx-form-viewer [responseId]="id" />

<!-- fully controlled -->
<ngx-form-viewer [response]="response" [definition]="def" />
```

| Input | Type | Notes |
|---|---|---|
| `responseId` | `string` | Repository mode |
| `response` | `FormResponse` | Controlled mode |
| `definition` | `FormDefinition` | Optional explicit definition override |
| `permissions` | `PermissionsInput` | Resolves `{ canView }`; blocked card otherwise |

## Behavior

- **Version pinning**: uses `response.formVersion`, never the latest draft —
  an answer from v2 renders as the respondent saw it even after you publish
  v7. A note appears if the shown version is no longer the latest.
- **Silent skipping**: hidden and excluded field types are omitted without
  placeholders — the answer reads exactly like the filled form did.
- **Layout parity**: same 12-column grid and dependency-depth indentation as
  the responder, so conditional structure stays readable.
- Values render type-aware: rating → stars, checkbox-group / multi-select →
  comma list, dates localized, empty values as `—`.
