import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import {
  DefinitionListQuery,
  FORM_DEFINITION_REPOSITORY,
  FORM_RESPONSE_REPOSITORY,
  FormDefinitionRepository,
  FormResponseRepository,
  ResponseListQuery,
} from './repository';
import type {
  FormDefinition,
  FormResponse,
  FormResponseDraft,
  FormVersionSummary,
} from '../models/field-definition';

/**
 * REST adapters for the repository ports. The wire contract is documented so
 * any backend can implement it:
 *
 * Definitions (`FormDefinition` bodies):
 * - POST   /forms                        upsert working copy
 * - GET    /forms/{id}/versions/{v}      exact version (404 → null)
 * - GET    /forms/{id}/latest            highest version
 * - GET    /forms/{id}/published         highest published version
 * - POST   /forms/{id}/working-copy      get-or-create editable draft
 * - POST   /forms/{id}/publish           { version } freezes it
 * - GET    /forms/{id}/versions          version summaries
 * - GET    /forms?status=&search=        latest of every form
 * - POST   /forms/{id}/archive
 * - GET    /forms/{id}/response-counts   Record<version, count>
 *
 * Responses:
 * - POST   /responses                    save submitted answer
 * - GET    /responses/{id}
 * - GET    /responses?formId=&limit=
 * - DELETE /responses/{id}
 * - PUT    /responses/drafts             upsert draft
 * - GET    /responses/drafts?formId=&respondent={json}
 * - DELETE /responses/drafts/{id}
 */

export interface HttpRepositoryOptions {
  /** Base URL WITHOUT trailing slash, e.g. https://api.example.com/v1 */
  baseUrl: string;
  /** Test seam — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Extra headers (auth etc.). */
  headers?: Record<string, string>;
}

export class HttpError extends Error {
  constructor(readonly status: number, readonly url: string) {
    super(`HTTP ${status} for ${url}`);
  }
}

async function requestJson<T>(
  fetchImpl: typeof fetch,
  baseUrl: string,
  path: string,
  init: RequestInit & { headers?: Record<string, string> },
): Promise<T | null> {
  const url = `${baseUrl}${path}`;
  const response = await fetchImpl(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new HttpError(response.status, url);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T | null;
}

function notFoundAsNull<T>(promise: Promise<T | null>): Promise<T | null> {
  return promise.catch((error) => {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  });
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
};

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

export class HttpFormDefinitionRepository implements FormDefinitionRepository {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpRepositoryOptions) {
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  saveWorkingCopy(def: FormDefinition): Promise<FormDefinition> {
    return this.send<FormDefinition>('/forms', 'POST', def);
  }

  getById(id: string, version?: number): Promise<FormDefinition | null> {
    const path = version ? `/forms/${id}/versions/${version}` : `/forms/${id}/latest`;
    return notFoundAsNull(this.send<FormDefinition>(path, 'GET'));
  }

  getLatest(id: string): Promise<FormDefinition | null> {
    return notFoundAsNull(this.send<FormDefinition>(`/forms/${id}/latest`, 'GET'));
  }

  getLatestPublished(id: string): Promise<FormDefinition | null> {
    return notFoundAsNull(this.send<FormDefinition>(`/forms/${id}/published`, 'GET'));
  }

  getOrCreateWorkingCopy(id: string, actor?: string): Promise<FormDefinition> {
    return this.send<FormDefinition>(
      `/forms/${id}/working-copy`,
      'POST',
      actor ? { actor } : undefined,
    );
  }

  publish(id: string, version: number): Promise<FormDefinition> {
    return this.send<FormDefinition>(`/forms/${id}/publish`, 'POST', { version });
  }

  listVersions(id: string): Promise<FormVersionSummary[]> {
    return this.send<FormVersionSummary[]>(`/forms/${id}/versions`, 'GET');
  }

  list(query?: DefinitionListQuery): Promise<FormDefinition[]> {
    const path = `/forms${qs({ status: query?.status, search: query?.search })}`;
    return this.send<FormDefinition[]>(path, 'GET');
  }

  async archive(id: string): Promise<void> {
    await this.send(`/forms/${id}/archive`, 'POST');
  }

  countResponsesByVersion(id: string): Promise<Record<number, number>> {
    return this.send<Record<number, number>>(`/forms/${id}/response-counts`, 'GET');
  }

  private send<T>(path: string, method: string, body?: unknown): Promise<T> {
    return requestJson<T>(this.fetchImpl, this.options.baseUrl, path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: this.options.headers,
    }) as Promise<T>;
  }
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export class HttpFormResponseRepository implements FormResponseRepository {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpRepositoryOptions) {
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  save(response: FormResponse): Promise<FormResponse> {
    return this.send<FormResponse>('/responses', 'POST', response);
  }

  getById(id: string): Promise<FormResponse | null> {
    return notFoundAsNull(this.send<FormResponse>(`/responses/${id}`, 'GET'));
  }

  listByForm(formId: string, query?: ResponseListQuery): Promise<FormResponse[]> {
    return this.send<FormResponse[]>(`/responses${qs({ formId, limit: query?.limit })}`, 'GET');
  }

  async delete(id: string): Promise<void> {
    await this.send(`/responses/${id}`, 'DELETE');
  }

  saveDraft(draft: FormResponseDraft): Promise<FormResponseDraft> {
    return this.send<FormResponseDraft>('/responses/drafts', 'PUT', draft);
  }

  getDraft(formId: string, respondentContext?: unknown): Promise<FormResponseDraft | null> {
    const respondent =
      respondentContext === undefined ? undefined : JSON.stringify(respondentContext);
    return notFoundAsNull(
      this.send<FormResponseDraft>(`/responses/drafts${qs({ formId, respondent })}`, 'GET'),
    );
  }

  async discardDraft(draftId: string): Promise<void> {
    await this.send(`/responses/drafts/${draftId}`, 'DELETE');
  }

  private send<T>(path: string, method: string, body?: unknown): Promise<T> {
    return requestJson<T>(this.fetchImpl, this.options.baseUrl, path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: this.options.headers,
    }) as Promise<T>;
  }
}

/**
 * Wires BOTH repository tokens to the REST adapters.
 * ```ts
 * provideNgxFormsHttpApi('https://api.example.com/v1', { headers: auth() })
 * ```
 */
export function provideNgxFormsHttpApi(
  baseUrl: string,
  options?: Omit<HttpRepositoryOptions, 'baseUrl'>,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: FORM_DEFINITION_REPOSITORY,
      useFactory: () => new HttpFormDefinitionRepository({ baseUrl, ...(options ?? {}) }),
    },
    {
      provide: FORM_RESPONSE_REPOSITORY,
      useFactory: () => new HttpFormResponseRepository({ baseUrl, ...(options ?? {}) }),
    },
  ]);
}

/** Runtime reconfiguration seam (rarely needed — see {@link provideNgxFormsHttpApi}). */
export const NGX_FORMS_HTTP_OPTIONS = new InjectionToken<HttpRepositoryOptions>(
  '@n0n3br/ngx-dynamic-forms-core HTTP repository options',
);
