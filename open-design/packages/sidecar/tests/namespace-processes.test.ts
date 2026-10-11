import { afterEach, describe, expect, it, vi } from 'vitest';
import * as platform from '@open-design/platform';
import { findSidecarProcessesInNamespace } from '../src/namespace-processes.js';
import { createSidecarLauncherArgs } from '../src/stamp.js';
vi.mock('@open-design/platform', async importOriginal => ({...await importOriginal<typeof platform>(),captureProcessSnapshot:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
describe('strict namespace writer discovery',()=>{
  it('includes any channel/source/app/mode and launcher for the exact namespace',async()=>{
    const stamp={namespace:'mokina-local',channel:'old',source:'different',app:'daemon',mode:'headless'};
    const args=(namespace:string)=>createSidecarLauncherArgs({...stamp,namespace}).join(' ');
    vi.mocked(platform.captureProcessSnapshot).mockResolvedValue([{pid:10,ppid:1,command:`node ${args('mokina-local')} --od-sidecar-lifecycle=launcher`},{pid:11,ppid:1,command:`node ${args('mokina-local-qa')}`}]);
    expect((await findSidecarProcessesInNamespace('mokina-local')).map(p=>p.pid)).toEqual([10]);
  });
  it('propagates enumeration failure instead of reporting an idle profile',async()=>{
    vi.mocked(platform.captureProcessSnapshot).mockRejectedValue(new Error('ps denied'));
    await expect(findSidecarProcessesInNamespace('mokina-local')).rejects.toThrow('ps denied');
  });
});
