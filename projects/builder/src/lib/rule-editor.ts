import { ChangeDetectionStrategy, Component, computed, effect, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import {
  FieldDefinition,
  FormDefinition,
  describeChains,
} from '@n0n3br/ngx-dynamic-forms-core';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';

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
  imports: [
    FormsModule,
    ButtonModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    TooltipModule,
  ],
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

    const effects: Array<Record<string, unknown>> = [{ type: rule.action }];
    const elseEffects: Array<Record<string, unknown>> = [];

    if (rule.action === 'hide' || rule.action === 'disable') {
      // mirror-op on the else branch so toggling back restores state
      effects.push({ type: 'unsetRequired' });
    }
    if (rule.requireIt) {
      effects.push({ type: 'setRequired' });
      elseEffects.push({ type: 'unsetRequired' });
    }

    return {
      id: rule.id,
      target: rule.target,
      when,
      effects,
      ...(elseEffects.length > 0 ? { elseEffects } : {}),
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
    const effectTypes = new Set(
      [...(dep.effects ?? []), ...(dep.elseEffects ?? [])].map(
        (e) => (e as { type?: string }).type ?? '',
      ),
    );
    let action: RuleAction = 'show';
    if (effectTypes.has('show')) action = 'show';
    else if (effectTypes.has('hide')) action = 'hide';
    else if (effectTypes.has('enable')) action = 'enable';
    else if (effectTypes.has('disable')) action = 'disable';

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
      requireIt: effectTypes.has('setRequired'),
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
