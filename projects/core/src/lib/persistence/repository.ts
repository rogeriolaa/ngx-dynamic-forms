import { InjectionToken } from '@angular/core';
import {
  FormDefinition,
  FormResponse,
  FormResponseDraft,
  FormStatus,
  FormVersionSummary,
} from '../models/field-definition';

export interface DefinitionListQuery {
  status?: Extract<FormStatus, 'draft' | 'published'>;
  search?: string;
}

/**
 * Port for persisting form definitions. Implementations must uphold the
 * versioning invariants:
 * - versions are immutable once published
 * - at most one draft ("working copy") per form
 */
export interface FormDefinitionRepository {
  /** Insert or update a working-copy draft version. */
  saveWorkingCopy(def: FormDefinition): Promise<FormDefinition>;
  getById(id: string, version?: number): Promise<FormDefinition | null>;
  /** Highest existing version regardless of status. */
  getLatest(id: string): Promise<FormDefinition | null>;
  /** Highest published version, or null when never published. */
  getLatestPublished(id: string): Promise<FormDefinition | null>;
  /**
   * Returns the editable draft version, creating one from the latest state
   * when only published versions exist (new version number).
   */
  getOrCreateWorkingCopy(id: string, actor?: string): Promise<FormDefinition>;
  /** Freezes a draft version as published and immutable. */
  publish(id: string, version: number): Promise<FormDefinition>;
  listVersions(id: string): Promise<FormVersionSummary[]>;
  /** Latest version of every non-archived form. */
  list(query?: DefinitionListQuery): Promise<FormDefinition[]>;
  archive(id: string): Promise<void>;
  /** Response counts keyed by definition version — powers publish warnings. */
  countResponsesByVersion?(id: string): Promise<Record<number, number>>;
}

export interface ResponseListQuery {
  limit?: number;
}

export interface FormResponseRepository {
  save(response: FormResponse): Promise<FormResponse>;
  getById(id: string): Promise<FormResponse | null>;
  listByForm(formId: string, query?: ResponseListQuery): Promise<FormResponse[]>;
  delete(id: string): Promise<void>;

  saveDraft(draft: FormResponseDraft): Promise<FormResponseDraft>;
  getDraft(formId: string, respondentContext?: unknown): Promise<FormResponseDraft | null>;
  discardDraft(draftId: string): Promise<void>;
}

export const FORM_DEFINITION_REPOSITORY = new InjectionToken<FormDefinitionRepository>(
  '@n0n3br/ngx-dynamic-forms-core FORM_DEFINITION_REPOSITORY',
);

export const FORM_RESPONSE_REPOSITORY = new InjectionToken<FormResponseRepository>(
  '@n0n3br/ngx-dynamic-forms-core FORM_RESPONSE_REPOSITORY',
);
