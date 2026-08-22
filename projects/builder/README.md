# @n0n3br/ngx-dynamic-forms-builder

`<ngx-form-builder>` — WYSIWYG designer for form definitions: palette,
drag-and-drop canvas, property panel, graphical rule editor, live preview and
version history with one-click publish.

## Install

```bash
npm i @n0n3br/ngx-dynamic-forms-builder @n0n3br/ngx-dynamic-forms-core
```

## Usage

### Repository mode

```html
<ngx-form-builder
  [formId]="formId"
  [permissions]="perms"
  (definitionSaved)="refresh()"
  (published)="gotoAnswer($event)"
  (cancel)="back()"
/>
```

Loads (or creates) a draft working copy of `formId`. **Save** persists the
draft; **Publish** validates, freezes the version via
`NgxFormsService.publish()` and reopens the next draft so editing continues.

### Controlled mode

```html
<ngx-form-builder [definition]="def" (definitionSaved)="upsert($event)" />
```

No repositories → no persistence; save/publish hand the definition back.

## Inputs / outputs

| Input | Type | Notes |
|---|---|---|
| `formId` | `string` | Repository mode |
| `definition` | `FormDefinition` | Controlled mode — always edits a clone |
| `permissions` | `PermissionsInput` | Resolves `{ canDesign }`; blocked card otherwise |
| `allowedFieldTypes` | `FieldType[]` | Restricts the palette |

| Output | Payload |
|---|---|
| `definitionSaved` | `FormDefinition` (after every successful save) |
| `published` | `FormDefinition` (the frozen version) |
| `cancel` | `void` |

## Designer features

- **Palette** — 14 field types grouped in Input / Layout / Hidden sections.
- **Canvas** — one card per field; conditional fields indent under what they
  depend on (depth = longest chain) with a guide line naming the parents.
- **Hierarchy-safe reordering** — drag & drop AND arrow buttons only move a
  field among same-level positions inside its ancestor/descendant window;
  cross-level drops are refused (dimmed targets + native no-drop cursor), so a
  root field can never be visually nested under an unrelated father.
- **Rule editor** — graphical `when(condition).then(show/hide, required…)`
  builder producing engine `Dependency` objects; mirrored else-branch for
  show/hide pairs.
- **Property panel** — label, required, help text, columns, type options.
- **Preview** — renders through the real responder runtime.
- **Version history modal** — timeline of every version + publish button with
  pinned-response warnings.
- **Import/export** — copy JSON or download `.json`; imports get a fresh id so
  they never overwrite the source form.

## Publishing semantics

Publishing runs full validation first (`validateDefinition`), then freezes the
version. The header reports impact vs the previous published version
(`cosmetic` / `structural`) and how many historical responses stay pinned to
older versions.
