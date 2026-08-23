import { describe, expect, it, vi } from 'vitest';
import { makeField, makeForm } from '../../testing/definition-fixtures';
import {
  HttpFormDefinitionRepository,
  HttpFormResponseRepository,
} from './http-repositories';

const def = () => makeForm([makeField('a')], [], { id: 'f1', version: 2 });
const response = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  formId: 'f1',
  formVersion: 1,
  values: { a: 'x' },
  submittedAt: new Date().toISOString(),
  ...overrides,
});

/** fetch stub capturing calls; replies `routes[url-key]` JSON. */
function stubFetch(routes: Record<string, unknown>, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    return new Response(JSON.stringify(routes[url] ?? null), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('HttpFormDefinitionRepository', () => {
  const base = 'https://api.test/v1';

  it('saveWorkingCopy POSTs the definition to /forms', async () => {
    const { impl, calls } = stubFetch({ [`${base}/forms`]: def() });
    const repo = new HttpFormDefinitionRepository({ baseUrl: base, fetchImpl: impl });

    await repo.saveWorkingCopy(def());

    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body)).id).toBe('f1');
  });

  it('getById hits exact version or latest', async () => {
    const { impl, calls } = stubFetch({});
    const repo = new HttpFormDefinitionRepository({ baseUrl: base, fetchImpl: impl });

    await repo.getById('f1', 3);
    await repo.getById('f1');

    expect(calls[0].url).toBe(`${base}/forms/f1/versions/3`);
    expect(calls[1].url).toBe(`${base}/forms/f1/latest`);
  });

  it('maps 404 to null on singular reads and throws otherwise', async () => {
    const missing = stubFetch({}, 404);
    const repo404 = new HttpFormDefinitionRepository({ baseUrl: base, fetchImpl: missing.impl });
    await expect(repo404.getLatestPublished('ghost')).resolves.toBeNull();

    const boom = stubFetch({}, 500);
    const repo500 = new HttpFormDefinitionRepository({ baseUrl: base, fetchImpl: boom.impl });
    await expect(repo500.getLatestPublished('ghost')).rejects.toThrow(/HTTP 500/);
  });

  it('publish posts the frozen version; list encodes query params', async () => {
    const routes: Record<string, unknown> = {
      [`${base}/forms/f1/publish`]: def(),
      [`${base}/forms?status=published&search=feed`]: [],
    };
    const { impl, calls } = stubFetch(routes);
    const repo = new HttpFormDefinitionRepository({ baseUrl: base, fetchImpl: impl });

    await repo.publish('f1', 2);
    await repo.list({ status: 'published', search: 'feed' });

    expect(JSON.parse(String(calls[0].init.body))).toEqual({ version: 2 });
    expect(calls[1].url).toContain('status=published');
    expect(calls[1].url).toContain('search=feed');
  });
});

describe('HttpFormResponseRepository', () => {
  const base = 'https://api.test/v1';

  it('saves responses and lists by form with limit', async () => {
    const routes: Record<string, unknown> = {
      [`${base}/responses`]: response(),
      [`${base}/responses?formId=f1&limit=5`]: [response()],
    };
    const { impl, calls } = stubFetch(routes);
    const repo = new HttpFormResponseRepository({ baseUrl: base, fetchImpl: impl });

    await repo.save(response());
    await repo.listByForm('f1', { limit: 5 });

    expect(calls[0].init.method).toBe('POST');
    expect(calls[1].url).toContain('limit=5');
  });

  it('upserts drafts via PUT and discards via DELETE', async () => {
    const draft = {
      id: 'd1',
      formId: 'f1',
      formVersion: 1,
      values: {},
      updatedAt: new Date().toISOString(),
    };
    const { impl, calls } = stubFetch({ [`${base}/responses/drafts`]: draft });
    const repo = new HttpFormResponseRepository({ baseUrl: base, fetchImpl: impl });

    await repo.saveDraft(draft);
    await repo.discardDraft('d1');

    expect(calls[0].init.method).toBe('PUT');
    expect(calls[1].url).toBe(`${base}/responses/drafts/d1`);
    expect(calls[1].init.method).toBe('DELETE');
  });

  it('JSON-encodes the opaque respondent context in getDraft', async () => {
    const { impl, calls } = stubFetch({}, 404);
    const repo = new HttpFormResponseRepository({ baseUrl: base, fetchImpl: impl });

    const result = await repo.getDraft('f1', { userId: 'u 1', role: 'a/b' });

    expect(result).toBeNull();
    const sentUrl = new URL(calls[0].url);
    expect(sentUrl.searchParams.get('formId')).toBe('f1');
    expect(JSON.parse(sentUrl.searchParams.get('respondent')!)).toEqual({
      userId: 'u 1',
      role: 'a/b',
    });
  });
});
