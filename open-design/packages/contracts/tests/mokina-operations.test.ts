import { expect, it } from 'vitest';
import { parseMokinaOperationRequest } from '../src/api/mokina-operations.js';
const request = { operationId: 'op', baseVersionId: 'v', contentDigest: 'a'.repeat(64), edits: [{ id: 'strategy', value: '修改' }] };
it('requires a fixed identity, explicit changes and unique targets', () => {
  expect(parseMokinaOperationRequest(request)).toEqual(request);
  for (const patch of [{ contentDigest: 'x' }, { edits: [] }, { edits: [request.edits[0], request.edits[0]] }, { combine: { versionId: 'v2', contentDigest: 'b'.repeat(64), sections: ['s', 's'] } }]) expect(() => parseMokinaOperationRequest({ ...request, ...patch })).toThrow();
});
it('separates combination from field edits so replacement cannot retarget ordinal budget fields', () => {
  expect(() => parseMokinaOperationRequest({ ...request, combine: { versionId: 'v2', contentDigest: 'b'.repeat(64), sections: ['budget'] } })).toThrow();
});
