import { inject, Injectable } from '@angular/core';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';
import {
  FieldDefinition,
  FieldType,
  FormDefinition,
  FormResponse,
  FormResponseDraft,
  FormValues,
} from '../models/field-definition';
import { DefinitionListQuery, FORM_DEFINITION_REPOSITORY, FORM_RESPONSE_REPOSITORY } from './repository';
import { classifyChange, ChangeImpact } from '../versioning/fingerprint';
import { validateDefinition } from '../validation/validate-definition';

export interface PublishReport {
  published: FormDefinition;
  /** Impact relative to the previous published state ('none' for first publish). */
  impact: ChangeImpact;
  /** Responses pinned to each earlier version — powers the "your edit won't
   * affect existing answers" warning. */
  responsesPerVersion: Record<number, number>;
}

export interface SubmitResult {
  response: FormResponse;
  discardedDraft: boolean;
}

/**
 * Thin orchestration layer shared by the builder/responder/viewer components.
 * All persistence goes through the repository ports, so hosts swapping in
 * their own backends get identical behavior for free.
 */
@Injectable({ providedIn: 'root' })
export class NgxFormsService {
  private readonly definitions = inject(FORM_DEFINITION_REPOSITORY);
  private readonly responses = inject(FORM_RESPONSE_REPOSITORY);

  async createForm(title: string, actor?: string): Promise<FormDefinition> {
    const now = new Date().toISOString();
    const draft: FormDefinition = {
      id: crypto.randomUUID(),
      version: 1,
      status: 'draft',
      title,
      fields: [],
      dependencies: [],
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
    };
    return this.definitions.saveWorkingCopy(draft);
  }

  async duplicateForm(sourceId: string, title?: string, actor?: string): Promise<FormDefinition> {
    const source = await this.definitions.getLatest(sourceId);
    if (!source) throw new Error(`Form "${sourceId}" not found.`);
    const now = new Date().toISOString();
    return this.definitions.saveWorkingCopy({
      ...structuredClone(source),
      id: crypto.randomUUID(),
      version: 1,
      status: 'draft',
      title: title ?? `${source.title} (copy)`,
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      publishedAt: undefined,
    });
  }

  listForms(query?: DefinitionListQuery): Promise<FormDefinition[]> {
    return this.definitions.list(query);
  }

  getDefinition(id: string, version?: number): Promise<FormDefinition | null> {
    return this.definitions.getById(id, version);
  }

  getLatestPublished(id: string): Promise<FormDefinition | null> {
    return this.definitions.getLatestPublished(id);
  }

  getOrCreateWorkingCopy(id: string, actor?: string): Promise<FormDefinition> {
    return this.definitions.getOrCreateWorkingCopy(id, actor);
  }

  listVersions(id: string) {
    return this.definitions.listVersions(id);
  }

  archive(id: string): Promise<void> {
    return this.definitions.archive(id);
  }

  validate(def: FormDefinition) {
    return validateDefinition(def);
  }

  /**
   * Persists the working copy after running full validation. Throws an
   * aggregate error listing all blocking issues when validation fails.
   */
  async saveWorkingCopy(def: FormDefinition): Promise<{ saved: FormDefinition }> {
    const issues = validateDefinition(def);
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      throw new Error(
        `Cannot save — ${errors.length} blocking issue(s):\n${errors.map((e) => `- ${e.message}`).join('\n')}`,
      );
    }
    return { saved: await this.definitions.saveWorkingCopy(def) };
  }

  /**
   * Publishes a draft version and reports what changed plus how many
   * historical responses remain pinned to earlier versions.
   */
  async publish(id: string, version: number): Promise<PublishReport> {
    const [draft, previousPublished] = await Promise.all([
      this.definitions.getById(id, version),
      this.definitions.getLatestPublished(id),
    ]);
    if (!draft) throw new Error(`Version ${version} not found for form "${id}".`);
    if (draft.status !== 'draft') throw new Error('Only drafts can be published.');

    const errors = validateDefinition(draft).filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      throw new Error(
        `Cannot publish — ${errors.length} blocking issue(s):\n${errors.map((e) => `- ${e.message}`).join('\n')}`,
      );
    }

    const published = await this.definitions.publish(id, version);
    const responsesPerVersion = (await this.definitions.countResponsesByVersion?.(id)) ?? {};
    delete responsesPerVersion[version];

    return {
      published,
      impact: previousPublished ? classifyChange(previousPublished, published) : 'none',
      responsesPerVersion,
    };
  }

  async submitResponse(input: {
    definition: FormDefinition;
    values: FormValues;
    respondentContext?: unknown;
  }): Promise<SubmitResult> {
    const now = new Date().toISOString();
    const response: FormResponse = {
      id: crypto.randomUUID(),
      formId: input.definition.id,
      formVersion: input.definition.version,
      respondentContext: input.respondentContext,
      values: input.values,
      submittedAt: now,
    };
    const saved = await this.responses.save(response);

    let discardedDraft = false;
    const draft = await this.responses.getDraft(input.definition.id, input.respondentContext);
    if (draft) {
      await this.responses.discardDraft(draft.id);
      discardedDraft = true;
    }
    return { response: saved, discardedDraft };
  }

  saveDraft(input: {
    definition: FormDefinition;
    values: FormValues;
    respondentContext?: unknown;
    existingDraftId?: string;
  }): Promise<FormResponseDraft> {
    return this.responses.saveDraft({
      id: input.existingDraftId ?? crypto.randomUUID(),
      formId: input.definition.id,
      formVersion: input.definition.version,
      respondentContext: input.respondentContext,
      values: input.values,
      updatedAt: new Date().toISOString(),
    });
  }

  getDraft(formId: string, respondentContext?: unknown): Promise<FormResponseDraft | null> {
    return this.responses.getDraft(formId, respondentContext);
  }

  discardDraft(draftId: string): Promise<void> {
    return this.responses.discardDraft(draftId);
  }

  getResponse(id: string): Promise<FormResponse | null> {
    return this.responses.getById(id);
  }

  listResponses(formId: string) {
    return this.responses.listByForm(formId);
  }
}

export type { Dependency, FieldDefinition, FieldType };
