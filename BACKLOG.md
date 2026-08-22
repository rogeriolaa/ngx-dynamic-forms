# Backlog

## ngx-form-dependency-engine (npm package)

### Chain-collapse on hide (proposed v0.0.4)
- Today: `hide` effects toggle visibility only — control values are preserved by contract.
- Gap: chained rules A→B→C misbehave when B is hidden while holding a value:
  C stays visible because its condition still reads B's stale answer.
- Consumers currently patch around it (ngx-dynamic-forms responder resets hidden
  controls to their initial value on hide).
- Proposal: opt-in engine config `{ collapseHiddenChains?: boolean }` — when true,
  the evaluation loop resets newly-hidden controls to their initial/default value
  (emit-free, inside the existing iteration cap) so downstream rules collapse in
  the same pass. Default stays `false` to preserve the documented contract.
- Also worth adding: a rule-builder DSL helper `.otherwise(hide(), reset())` so
  authors can express the intent explicitly per-dependency without the global flag.

## ngx-dynamic-forms (this workspace)

- Wizard / multi-step forms (deferred v2)
- CPF/CNPJ/CEP + file-upload/signature field types (deferred v2)
- HTTP repository implementation alongside the IndexedDB default (v2)
