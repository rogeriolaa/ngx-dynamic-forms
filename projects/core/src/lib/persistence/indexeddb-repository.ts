import { IDBPDatabase, openDB } from 'idb';
import {
  FormDefinition,
  FormResponse,
  FormResponseDraft,
  FormVersionSummary,
} from '../models/field-definition';
import {
  DefinitionListQuery,
  FormDefinitionRepository,
  FormResponseRepository,
  ResponseListQuery,
} from './repository';

const DEFAULT_DB_NAME = 'ngx-dynamic-forms';
const DB_VERSION = 1;

const STORE_DEFINITIONS = 'definitions';
const STORE_RESPONSES = 'responses';
const STORE_DRAFTS = 'drafts';

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Shared low-level storage over raw IndexedDB (promise-based via `idb`). */
export class IndexedDbFormsStore {
  private db: Promise<IDBPDatabase> | null = null;

  constructor(readonly dbName: string = DEFAULT_DB_NAME) {}

  private connect(): Promise<IDBPDatabase> {
    if (!this.db) {
      this.db = openDB(this.dbName, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE_DEFINITIONS)) {
            const store = database.createObjectStore(STORE_DEFINITIONS, {
              keyPath: ['id', 'version'],
            });
            store.createIndex('byId', 'id');
          }
          if (!database.objectStoreNames.contains(STORE_RESPONSES)) {
            const store = database.createObjectStore(STORE_RESPONSES, { keyPath: 'id' });
            store.createIndex('byForm', 'formId');
          }
          if (!database.objectStoreNames.contains(STORE_DRAFTS)) {
            const store = database.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
            store.createIndex('byForm', 'formId');
          }
        },
      });
    }
    return this.db;
  }

  /** Clears every object store — test isolation helper. */
  async wipe(): Promise<void> {
    const db = await this.connect();
    await Promise.all([
      db.clear(STORE_DEFINITIONS),
      db.clear(STORE_RESPONSES),
      db.clear(STORE_DRAFTS),
    ]);
  }

  // ---------- definitions ----------

  async putDefinition(def: FormDefinition): Promise<FormDefinition> {
    const db = await this.connect();
    await db.put(STORE_DEFINITIONS, def);
    return def;
  }

  async getDefinition(id: string, version?: number): Promise<FormDefinition | null> {
    const db = await this.connect();
    if (version !== undefined) {
      const found = await db.get(STORE_DEFINITIONS, [id, version]);
      return found ?? null;
    }
    return this.getLatest(id);
  }

  async getLatest(id: string): Promise<FormDefinition | null> {
    const all = await this.definitionsFor(id);
    return all[0] ?? null;
  }

  async getLatestPublished(id: string): Promise<FormDefinition | null> {
    const all = await this.definitionsFor(id);
    return all.find((d) => d.status === 'published') ?? null;
  }

  private async definitionsFor(id: string): Promise<FormDefinition[]> {
    const db = await this.connect();
    const all: FormDefinition[] = await db.getAllFromIndex(STORE_DEFINITIONS, 'byId', id);
    // archived flag lives on the row but never sorts above live versions
    all.sort((a, b) => b.version - a.version);
    return all;
  }

  async listVersions(id: string): Promise<FormVersionSummary[]> {
    const db = await this.connect();
    const all: FormDefinition[] = await db.getAllFromIndex(STORE_DEFINITIONS, 'byId', id);
    return all
      .sort((a, b) => a.version - b.version)
      .map(({ version, status, updatedAt, createdBy }) => ({
        version,
        status,
        updatedAt,
        createdBy,
      }));
  }

  async listDefinitions(query?: DefinitionListQuery): Promise<FormDefinition[]> {
    const db = await this.connect();
    const all: Array<FormDefinition & { archived?: boolean }> = await db.getAll(
      STORE_DEFINITIONS,
    );
    const latestPerForm = new Map<string, FormDefinition & { archived?: boolean }>();
    for (const def of all) {
      const current = latestPerForm.get(def.id);
      if (!current || def.version > current.version) {
        latestPerForm.set(def.id, def);
      }
    }
    let out = [...latestPerForm.values()].filter((d) => !d.archived);
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (query?.status) out = out.filter((d) => d.status === query.status);
    if (query?.search) {
      const needle = query.search.toLowerCase();
      out = out.filter(
        (d) =>
          d.title.toLowerCase().includes(needle) ||
          d.description?.toLowerCase().includes(needle),
      );
    }
    return out;
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    const db = await this.connect();
    const all: FormDefinition[] = await db.getAllFromIndex(STORE_DEFINITIONS, 'byId', id);
    for (const def of all) {
      await db.put(STORE_DEFINITIONS, { ...def, archived });
    }
  }

  // ---------- responses ----------

  async putResponse(response: FormResponse): Promise<FormResponse> {
    const db = await this.connect();
    await db.put(STORE_RESPONSES, response);
    return response;
  }

  async getResponse(id: string): Promise<FormResponse | null> {
    const db = await this.connect();
    const found = await db.get(STORE_RESPONSES, id);
    return found ?? null;
  }

  async listResponses(formId: string, query?: ResponseListQuery): Promise<FormResponse[]> {
    const db = await this.connect();
    const all: FormResponse[] = await db.getAllFromIndex(STORE_RESPONSES, 'byForm', formId);
    all.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return query?.limit ? all.slice(0, query.limit) : all;
  }

  async deleteResponse(id: string): Promise<void> {
    const db = await this.connect();
    await db.delete(STORE_RESPONSES, id);
  }

  async countResponsesByVersion(id: string): Promise<Record<number, number>> {
    const responses = await this.listResponses(id);
    const counts: Record<number, number> = {};
    for (const response of responses) {
      counts[response.formVersion] = (counts[response.formVersion] ?? 0) + 1;
    }
    return counts;
  }

  // ---------- drafts ----------

  async putDraft(draft: FormResponseDraft): Promise<FormResponseDraft> {
    const db = await this.connect();
    await db.put(STORE_DRAFTS, draft);
    return draft;
  }

  async getDraft(formId: string, respondentContext?: unknown): Promise<FormResponseDraft | null> {
    const db = await this.connect();
    const all: FormResponseDraft[] = await db.getAllFromIndex(STORE_DRAFTS, 'byForm', formId);
    return (
      all.find((d) => JSON.stringify(d.respondentContext) === JSON.stringify(respondentContext)) ??
      null
    );
  }

  async deleteDraft(draftId: string): Promise<void> {
    const db = await this.connect();
    await db.delete(STORE_DRAFTS, draftId);
  }

  /** Bulk loader used by demo seeding and test fixtures. */
  async seed(forms: FormDefinition[], responses: FormResponse[]): Promise<void> {
    const db = await this.connect();
    for (const form of forms) await db.put(STORE_DEFINITIONS, form);
    for (const response of responses) await db.put(STORE_RESPONSES, response);
  }
}

function newId(): string {
  return uuid();
}

/**
 * Port adapter implementing {@link FormDefinitionRepository} on top of
 * {@link IndexedDbFormsStore}. Enforces the versioning invariants:
 * versions are immutable once published; at most one working-copy draft.
 */
export function createIndexedDbDefinitionRepository(
  store: IndexedDbFormsStore,
): FormDefinitionRepository {
  const now = () => new Date().toISOString();

  return {
    async saveWorkingCopy(def) {
      return store.putDefinition({ ...def, status: 'draft', updatedAt: now() });
    },

    getById: (id, version) => store.getDefinition(id, version),
    getLatest: (id) => store.getLatest(id),
    getLatestPublished: (id) => store.getLatestPublished(id),

    async getOrCreateWorkingCopy(id, actor) {
      const existing = await store.getLatest(id);
      if (!existing) throw new Error(`Form "${id}" not found.`);
      if (existing.status === 'draft') return existing;

      const copy: FormDefinition = {
        ...structuredClone(existing),
        version: existing.version + 1,
        status: 'draft',
        publishedAt: undefined,
        updatedAt: now(),
        createdBy: actor ?? existing.createdBy,
      };
      return store.putDefinition(copy);
    },

    async publish(id, version) {
      const draft = await store.getDefinition(id, version);
      if (!draft) throw new Error(`Form "${id}" version ${version} not found.`);
      if (draft.status === 'published') return draft;
      return store.putDefinition({
        ...draft,
        status: 'published',
        publishedAt: now(),
        updatedAt: now(),
      });
    },

    listVersions: (id) => store.listVersions(id),
    list: (query) => store.listDefinitions(query),
    archive: (id) => store.setArchived(id, true),
    countResponsesByVersion: (id) =>
      typeof store.countResponsesByVersion === 'function'
        ? store.countResponsesByVersion(id)
        : Promise.resolve({}),
  };
}

/** Port adapter implementing {@link FormResponseRepository}. */
export function createIndexedDbResponseRepository(
  store: IndexedDbFormsStore,
): FormResponseRepository {
  return {
    async save(response) {
      return store.putResponse({ ...response, id: response.id || newId() });
    },
    getById: (id) => store.getResponse(id),
    listByForm: (formId, query) => store.listResponses(formId, query),
    delete: (id) => store.deleteResponse(id),

    async saveDraft(draft) {
      const stored: FormResponseDraft = {
        ...draft,
        id: draft.id || newId(),
        updatedAt: new Date().toISOString(),
      };
      return store.putDraft(stored);
    },
    getDraft: (formId, respondentContext) => store.getDraft(formId, respondentContext),
    discardDraft: (draftId) => store.deleteDraft(draftId),
  };
}
