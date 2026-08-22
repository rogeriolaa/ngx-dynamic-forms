# Backlog

## ngx-form-dependency-engine (npm package)

### ~~Chain-collapse on hide~~ — SHIPPED in v0.0.4
- Opt-in `{ collapseHiddenChains: true }` config resets newly-hidden controls
  to their constructor-time value inside the existing iteration loop, so
  A→B→C chains collapse in one pass. Default `false` preserves the contract.
- `reset()` effect builder ships too — express intent per dependency via
  `.otherwise(hide(), reset())`.
- Adopted by ngx-dynamic-forms responder (manual patch deleted).

### Engine — next ideas
- Rule trace/debug API: expose which rules fired per pass and why a condition
  passed/failed (actual vs expected value).
- Static rule linting at construction: warn on rules targeting missing
  controls or unreachable conditions (today only maxIterations warns late).
- Dependency-free subpath export for the condition evaluator → server-side
  re-validation without @angular/forms.

## ngx-dynamic-forms (this workspace)

- Wizard / multi-step forms (deferred v2)
- CPF/CNPJ/CEP + file-upload/signature field types (deferred v2)
- HTTP repository implementation alongside the IndexedDB default (v2)
