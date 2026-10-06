import { describe, expect, it } from 'vitest';

import {
  buildMokinaContinuationV2,
  readMokinaContinuationJournal,
  resolveMokinaContinuationTarget,
} from '../../src/components/FileViewer';

describe('continuation v2 payload and creation journal', () => {
  it('builds a v2 payload with stable identity, source digest and state', () => {
    const payload = buildMokinaContinuationV2({
      projectId: 'p1',
      fileName: 'plan.html',
      versionId: 'v3',
      versionState: 'historical',
      contentDigest: 'a'.repeat(64),
      operationId: 'op-1',
      targetProjectId: 'p2',
      sections: [{ id: 'strategy', text: '聚焦门店' }],
      background: '预算 50 万',
      productionIntent: 'discuss',
    });
    expect(payload).toMatchObject({
      schemaVersion: 2,
      operationId: 'op-1',
      targetProjectId: 'p2',
      productionIntent: 'discuss',
      source: { projectId: 'p1', fileName: 'plan.html', versionId: 'v3', versionState: 'historical' },
    });
    expect(payload.sections[0]).toEqual({ id: 'strategy', text: '聚焦门店' });
  });

  it('parses only well-formed journals so a retry can reuse the same target', () => {
    const journal = {
      schemaVersion: 2,
      operationId: 'op-1',
      targetProjectId: 'p2',
      checkpoint: 'project-created',
      updatedAt: new Date().toISOString(),
    };
    expect(readMokinaContinuationJournal(JSON.stringify(journal))).toEqual(journal);
    expect(readMokinaContinuationJournal(null)).toBeNull();
    expect(readMokinaContinuationJournal('{ not json')).toBeNull();
    expect(readMokinaContinuationJournal(JSON.stringify({ ...journal, schemaVersion: 1 }))).toBeNull();
    expect(readMokinaContinuationJournal(JSON.stringify({ ...journal, targetProjectId: '' }))).toBeNull();
  });

  it('maps a continuation intent to its target scenario and prompt lead', () => {
    expect(resolveMokinaContinuationTarget('discuss')).toEqual({
      pluginId: 'mokina-marketing-plan',
      promptLead: expect.stringContaining('继续工作'),
    });
    expect(resolveMokinaContinuationTarget('landing-page')).toEqual({
      pluginId: 'mokina-landing-page',
      promptLead: expect.stringContaining('活动页'),
    });
  });

  it('keeps the landing-page intent in the v2 payload', () => {
    const payload = buildMokinaContinuationV2({
      projectId: 'p1',
      fileName: 'plan.html',
      versionId: 'v1',
      versionState: 'current',
      operationId: 'op-2',
      targetProjectId: 'p3',
      sections: [{ id: 'strategy', text: '门店' }],
      background: '',
      productionIntent: 'landing-page',
    });
    expect(payload.productionIntent).toBe('landing-page');
  });
});
