import { ChangeDetectionStrategy, Component, computed, effect, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import {
  FieldDefinition,
  FormDefinition,
  NdfIcon,
  describeChains,
} from '@n0n3br/ngx-dynamic-forms-core';


/** Friendly operator catalog — keys match the engine's ConditionOperator union. */
export const RULE_OPERATORS: Array<{ value: string; label: string; needsValue: boolean }> = [
  { value: 'equals', label: 'equals', needsValue: true },
  { value: 'notEquals', label: 'does not equal', needsValue: true },
  { value: 'in', label: 'is any of', needsValue: true },
  { value: 'notIn', label: 'is none of', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'greaterThan', label: 'is greater than', needsValue: true },
  { value: 'greaterOrEqual', label: 'is at least', needsValue: true },
  { value: 'lessThan', label: 'is less than', needsValue: true },
  { value: 'lessOrEqual', label: 'is at most', needsValue: true },
  { value: 'isEmpty', label: 'is empty', needsValue: false },
  { value: 'isNotEmpty', label: 'is not empty', needsValue: false },
];

type RuleAction = 'show' | 'hide' | 'enable' | 'disable';

export const RULE_ACTIONS: Array<{ value: RuleAction; label: string; icon: string }> = [
  { value: 'show', label: 'Show', icon: 'pi pi-eye' },
  { value: 'hide', label: 'Hide', icon: 'pi pi-eye-slash' },
  { value: 'enable', label: 'Enable', icon: 'pi pi-lock-open' },
  { value: 'disable', label: 'Disable', icon: 'pi pi-lock' },
] as const;

interface UiCondition {
  field: string;
  operator: string;
  /** String form while editing; serialized per source-field type. */
  value: string;
}

interface UiRule {
  id: string;
  action: RuleAction;
  target: string;
  requireIt: boolean;
  logic: 'AND' | 'OR';
  conditions: UiCondition[];
}

let ruleSeq = 0;

function nextRuleId(): string {
  ruleSeq += 1;
  return `rule-${Date.now().toString(36)}-${ruleSeq}`;
}

const VALUELESS = new Set(['section']);

/**
 * Graphical dependency editor. Non-technical users build rules as sentences:
 * "Show [field] when [field] [operator] [value]" — AND/OR between condition
 * rows, optional "and make it required". Output is standard engine
 * `Dependency[]` JSON, so anything expressible here runs unchanged on the
 * `FormDependencyEngine`.
 */
@Component({
  selector: 'ngx-rule-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .rules { display: flex; flex-direction: column; gap: 0.75rem; }
    .rules-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .rules-head h4 { margin: 0; font-size: 0.875rem; font-weight: 600; }
    .rules-hint { margin: 0.125rem 0 0; font-size: 0.6875rem; color: var(--ndf-text-muted); }

    .chain-map {
      border-radius: 6px;
      background: var(--ndf-surface-alt);
      padding: 0.5rem;
    }
    :host-context(.app-dark) .chain-map { background: var(--ndf-surface-alt); }
    .chain-map-title {
      margin: 0 0 0.25rem;
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--ndf-text-muted);
    }
    .chain-line {
      display: flex; align-items: center; gap: 0.25rem;
      font-size: 0.6875rem; color: var(--ndf-text);
    }
    .chain-line i { font-size: 0.625rem; color: var(--p-primary-500); }

    .rule-empty {
      text-align: center;
      padding: 1rem;
      border: 1px dashed var(--ndf-border-strong);
      border-radius: 6px;
    }
    :host-context(.app-dark) .rule-empty { border-color: var(--ndf-border); }
    .rule-empty p { margin: 0; }

    .rule-card {
      border: 1px solid var(--ndf-border);
      border-radius: 8px;
      background: var(--p-surface-0);
      padding: 0.75rem;
      box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
    }
    :host-context(.app-dark) .rule-card { background: var(--ndf-surface); border-color: var(--ndf-border); }

    .rule-top { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
    .rule-top .sentence-word { font-size: 0.8125rem; white-space: nowrap; }
    .require-toggle {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .conditions {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--ndf-surface-alt);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    :host-context(.app-dark) .conditions { border-top-color: var(--ndf-surface-alt); }
    .conditions-label {
      font-size: 0.6875rem;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--ndf-text-faint);
    }
    .condition-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    .add-condition { align-self: flex-start; }
    .rule-select { width: auto; min-width: 8.5rem; padding-top: 0.35rem; padding-bottom: 0.35rem; }
    .logic-select { min-width: 4.5rem; }
    .value-input { width: 8rem; }
    .value-input.wide { width: 12rem; }
    .icon-btn {
      display: inline-flex;
      border: none;
      background: transparent;
      padding: 0.25rem;
      border-radius: 6px;
      cursor: pointer;
      color: var(--ndf-text-muted);
    }
    .icon-btn:hover { background: var(--ndf-surface-alt); color: var(--ndf-text); }
    .icon-btn.danger:hover { color: var(--ndf-danger); }
  `,
    imports: [FormsModule, NdfIcon],
  templateUrl: './rule-editor.html',
})
export class RuleEditor {
  readonly definition = input.required<FormDefinition>();
  readonly dependencies = model.required<Dependency[]>();
  /**
   * When set, the editor shows only rules targeting this field and new
   * rules are created for it — used by the property panel's "Rules" tab.
   * Leave undefined to edit every rule on the form.
   */
  readonly scopeTarget = input<string | undefined>();

  readonly rules = signal<UiRule[]>([]);

  readonly operators = RULE_OPERATORS;
  readonly ruleActions = RULE_ACTIONS;
  readonly LOGIC_CHOICES = [
    { label: 'AND', value: 'AND' },
    { label: 'OR', value: 'OR' },
  ];

  /** Rules rendered under the current scope. */
  readonly visibleRules = computed(() => {
    const scope = this.scopeTarget();
    return scope ? this.rules().filter((r) => r.target === scope) : this.rules();
  });

  /** "Parent → child" chains for the dependency map panel. */
  readonly chains = computed(() => {
    const deps = this.dependencies();
    const def = this.definition();
    if (!def || deps.length === 0) return [];
    return describeChains({ ...def, dependencies: deps });
  });

  readonly answerableFields = computed<FieldDefinition[]>(() => {
    const def = this.definition();
    return def ? def.fields.filter((f) => !VALUELESS.has(f.type)) : [];
  });

  readonly conditionSourceFields = computed<FieldDefinition[]>(() => {
    // hidden fields make great condition sources — include everything but sections
    const def = this.definition();
    return def ? def.fields.filter((f) => !VALUELESS.has(f.type)) : [];
  });

  constructor() {
    effect(() => this.rules.set(this.deserializeAll(this.dependencies())));
  }

  private emit(): void {
    const deps = this.rules().map((rule) => this.serialize(rule));
    this.dependencies.set(deps);
  }

  addRule(): void {
    const fields = this.answerableFields();
    if (fields.length === 0) return;
    const scope = this.scopeTarget();
    this.rules.update((rules) => [
      ...rules,
      {
        id: nextRuleId(),
        action: 'show',
        target: scope ?? fields[rules.length % fields.length].id,
        requireIt: false,
        logic: 'AND',
        conditions: [
          {
            field:
              fields.find((f) => f.id !== (scope ?? ''))?.id ?? '',
            operator: 'equals',
            value: '',
          },
        ],
      },
    ]);
    this.emit();
  }

  removeRule(id: string): void {
    this.rules.update((rules) => rules.filter((r) => r.id !== id));
    this.emit();
  }

  updateRule(id: string, patch: Partial<UiRule>): void {
    this.rules.update((rules) => rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    this.emit();
  }

  addCondition(ruleId: string): void {
    this.rules.update((rules) =>
      rules.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              conditions: [
                ...r.conditions,
                { field: r.conditions[0]?.field ?? '', operator: 'equals', value: '' },
              ],
            }
          : r,
      ),
    );
    this.emit();
  }

  removeCondition(ruleId: string, index: number): void {
    this.rules.update((rules) =>
      rules.map((r) =>
        r.id === ruleId && r.conditions.length > 1
          ? { ...r, conditions: r.conditions.filter((_, i) => i !== index) }
          : r,
      ),
    );
    this.emit();
  }

  updateCondition(ruleId: string, index: number, patch: Partial<UiCondition>): void {
    this.rules.update((rules) =>
      rules.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              conditions: r.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
            }
          : r,
      ),
    );
    this.emit();
  }

  operatorNeedsValue(operator: string): boolean {
    return RULE_OPERATORS.find((o) => o.value === operator)?.needsValue ?? true;
  }

  optionsOf(fieldId: string): Array<{ label: string; value: string | number }> {
    const field = this.definition().fields.find((f) => f.id === fieldId);
    return field?.options ?? [];
  }

  isNumericField(fieldId: string): boolean {
    const field = this.definition().fields.find((f) => f.id === fieldId);
    return !!field && ['number', 'slider', 'rating'].includes(field.type);
  }

  fieldLabel(fieldId: string): string {
    const field = this.definition().fields.find((f) => f.id === fieldId);
    return field ? field.label || field.id : fieldId;
  }

  // ---------- (de)serialization ----------

  private serialize(rule: UiRule): Dependency {
    const conditions = rule.conditions
      .filter((c) => c.field)
      .map((c) => {
        const base = { field: c.field, operator: c.operator } as Record<string, unknown>;
        if (this.operatorNeedsValue(c.operator)) {
          base['value'] = this.coerceValue(c.field, c.operator, c.value);
        }
        return base;
      });

    const when =
      rule.logic === 'OR'
        ? { logic: 'OR', conditions }
        : { logic: 'AND', conditions };

    // A sentence like "Show X when Y" means X stays HIDDEN otherwise —
    // so every action gets its mirror applied on the else-branch.
    const MIRROR: Record<RuleAction, RuleAction> = {
      show: 'hide',
      hide: 'show',
      enable: 'disable',
      disable: 'enable',
    };

    const effects: Array<Record<string, unknown>> = [{ type: rule.action }];
    const elseEffects: Array<Record<string, unknown>> = [{ type: MIRROR[rule.action] }];

    if (rule.requireIt) {
      if (rule.action === 'show' || rule.action === 'enable') {
        effects.push({ type: 'setRequired' });
        elseEffects.push({ type: 'unsetRequired' });
      }
    }

    return {
      id: rule.id,
      target: rule.target,
      when,
      effects,
      elseEffects,
    } as unknown as Dependency;
  }

  private coerceValue(sourceFieldId: string, operator: string, raw: string): unknown {
    if (this.isNumericField(sourceFieldId)) {
      const num = Number(raw);
      return Number.isFinite(num) ? num : raw;
    }
    if ((operator === 'in' || operator === 'notIn') && raw.trim() !== '') {
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      return this.isNumericField(sourceFieldId)
        ? parts.map(Number)
        : parts;
    }
    return raw;
  }

  private deserializeAll(deps: Dependency[]): UiRule[] {
    return deps.map((dep) => this.deserialize(dep));
  }

  private deserialize(dep: Dependency): UiRule {
    // Action comes from the THEN branch; elseEffects are the mirror and must
    // not win when both branches contain opposing actions.
    const thenTypes = new Set(
      (dep.effects ?? []).map((e) => (e as { type?: string }).type ?? ''),
    );
    let action: RuleAction = 'show';
    if (thenTypes.has('show')) action = 'show';
    else if (thenTypes.has('hide')) action = 'hide';
    else if (thenTypes.has('enable')) action = 'enable';
    else if (thenTypes.has('disable')) action = 'disable';

    const allTypes = new Set([
      ...thenTypes,
      ...(dep.elseEffects ?? []).map((e) => (e as { type?: string }).type ?? ''),
    ]);

    const conditionsRaw = (dep.when?.conditions ?? []) as unknown as Array<
      Record<string, unknown>
    >;
    const logic =
      dep.when?.logic === 'OR' ||
      conditionsRaw.some((c) => c['logic'] === 'OR')
        ? 'OR'
        : 'AND';

    return {
      id: dep.id || nextRuleId(),
      action,
      target: dep.target,
      requireIt: allTypes.has('setRequired'),
      logic,
      conditions: conditionsRaw
        .filter((c) => typeof c['field'] === 'string')
        .map((c) => ({
          field: String(c['field']),
          operator: String(c['operator'] ?? 'equals'),
          value:
            c['value'] === undefined
              ? ''
              : Array.isArray(c['value'])
                ? c['value'].join(', ')
                : String(c['value']),
        })),
    };
  }
}
