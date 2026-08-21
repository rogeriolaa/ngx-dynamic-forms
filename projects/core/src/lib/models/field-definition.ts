import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';

/** All field types supported out of the box. */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'date'
  | 'dropdown'
  | 'multi-select'
  | 'radio'
  | 'checkbox'
  | 'checkbox-group'
  | 'rating'
  | 'slider'
  | 'section'
  | 'hidden';

/**
 * How a field participates in rendering.
 * - `input`   – normal answer field, rendered by the responder
 * - `layout`  – purely visual (section), holds no value
 * - `static`  – display-only content block, holds no value
 * - `hidden`  – never rendered; its value lives in the FormGroup and can
 *               drive dependencies (via conditions or setValue effects)
 */
export type FieldCategory = 'input' | 'layout' | 'static' | 'hidden';

export interface FieldOption {
  label: string;
  value: string | number;
}

/**
 * Single flat configuration shape for every field type. Type-specific
 * properties are optional and only consumed by the types that support them —
 * this keeps builder property panels and JSON import/export simple.
 */
export interface FieldDefinition {
  /** Stable identifier. Answers key off this, never off the label. Immutable once created. */
  id: string;
  type: FieldType;
  label?: string;
  placeholder?: string;
  helpText?: string;

  required?: boolean;
  disabled?: boolean;

  /** Grid span (1–12) within the form's responsive grid. Defaults to 12. */
  columns?: number;

  defaultValue?: unknown;

  /** dropdown / multi-select / radio / checkbox-group */
  options?: FieldOption[];

  /** number / slider / rating */
  min?: number;
  max?: number;
  step?: number;

  /** text / textarea / email */
  maxLength?: number;
  /** text — source of a JS RegExp */
  pattern?: string;
  /** textarea */
  rows?: number;
}

export type FormStatus = 'draft' | 'published' | 'archived';

/**
 * One immutable snapshot of a form. Structural changes never mutate an
 * existing definition — they produce a new record with `version + 1`.
 */
export interface FormDefinition {
  id: string;
  version: number;
  status: FormStatus;
  title: string;
  description?: string;
  fields: FieldDefinition[];
  /**
   * Dependency rules in the exact shape consumed by
   * `FormDependencyEngine` from `@n0n3br/ngx-form-dependency-engine`.
   * Only JSON-safe rules may be persisted (no function refs).
   */
  dependencies: Dependency[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  publishedAt?: string;
}

export interface FormVersionSummary {
  version: number;
  status: FormStatus;
  updatedAt: string;
  createdBy?: string;
}

/** Response values are keyed by field id. */
export type FormValues = Record<string, unknown>;

export interface FormResponse {
  id: string;
  formId: string;
  /** Exact definition version this answer was given against. Never rewritten. */
  formVersion: number;
  respondentContext?: unknown;
  values: FormValues;
  submittedAt: string;
}

export interface FormResponseDraft {
  id: string;
  formId: string;
  formVersion: number;
  respondentContext?: unknown;
  values: FormValues;
  updatedAt: string;
}
