import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareMokinaStableProfile } from '@open-design/desktop/main';
import { prepareMokinaProfileElectronPaths, preparePackagedMokinaProfile, type MokinaProfileStartupUi } from '../src/mokina-profile-startup.js';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePackagedNamespacePaths } from '../src/paths.js';
vi.mock('@open-design/desktop/main', () => ({MOKINA_STABLE_PROFILE:'mokina-local',prepareMokinaStableProfile:vi.fn()}));
const product = {productId:'mokina' as const,productName:'Mokina',productVersion:'0.0.4-local.5',releaseKind:'local-preview' as const,automaticUpdates:false as const,upstreamNews:false as const,defaultTelemetry:false as const,requiresUpstreamAccount:false as const,registersOdScheme:false as const};
const config={namespace:'mokina-local',namespaceBaseRoot:'/isolated/namespaces',product};
const paths={dataRoot:'/isolated/namespaces/mokina-local/data'};
const ui = ():MokinaProfileStartupUi => ({locale:'zh-CN',ready:vi.fn(async()=>undefined),prompt:vi.fn(async()=>({response:1}))});
afterEach(()=>vi.resetAllMocks());
describe('native stable profile startup',()=>{
  it('chooses a disposable session before ready and preserves the absent target; later launches use the committed session',()=>{
    const root=mkdtempSync(join(tmpdir(),'mokina-r04-path-order-'));
    try {
      const nextConfig={...config,namespaceBaseRoot:root};
      const paths=resolvePackagedNamespacePaths({...nextConfig,resourceRoot:root} as Parameters<typeof resolvePackagedNamespacePaths>[0]);
      const assigned=new Map<string,string>(); const app={setPath:(name:string,value:string)=>{assigned.set(name,value);}};
      const chooser=prepareMokinaProfileElectronPaths(nextConfig,paths,app)!;
      expect(chooser.bootstrapRoot).not.toBeNull(); expect(existsSync(paths.namespaceRoot)).toBe(false);
      // Simulate Electron ready creating its configured session root.
      mkdirSync(assigned.get('sessionData')!,{recursive:true}); expect(existsSync(paths.namespaceRoot)).toBe(false);
      chooser.dispose(); expect(existsSync(chooser.bootstrapRoot!)).toBe(false);
      mkdirSync(paths.namespaceRoot); const committed=prepareMokinaProfileElectronPaths(nextConfig,paths,app)!;
      expect(committed.bootstrapRoot).toBeNull();expect(assigned.get('sessionData')).toBe(paths.electronSessionDataRoot);
    }finally{rmSync(root,{recursive:true,force:true});}
  });
  it('QA namespaces never discover or migrate a user profile',async()=>{
    expect(await preparePackagedMokinaProfile({...config,namespace:'mokina-local-qa'},paths,false,ui())).toBe(true);
    expect(prepareMokinaStableProfile).not.toHaveBeenCalled();
  });
  it('cancellation returns before runtime initialization and fresh start needs separate confirmation',async()=>{
    vi.mocked(prepareMokinaStableProfile).mockImplementation(async options=>(await options.choose(['mokina-local-v004-1']))===null?'cancelled':'existing');
    const dialog=ui(); vi.mocked(dialog.prompt).mockResolvedValueOnce({response:2});
    expect(await preparePackagedMokinaProfile(config,paths,false,dialog)).toBe(false);
    vi.mocked(dialog.prompt).mockResolvedValueOnce({response:1}).mockResolvedValueOnce({response:0});
    expect(await preparePackagedMokinaProfile(config,paths,false,dialog)).toBe(false);
    vi.mocked(dialog.prompt).mockResolvedValueOnce({response:1}).mockResolvedValueOnce({response:1});
    expect(await preparePackagedMokinaProfile(config,paths,false,dialog)).toBe(true);
  });
  it('uses native OS English fallback without reading another profile settings',async()=>{
    vi.mocked(prepareMokinaStableProfile).mockImplementation(async options=>{await options.choose(['mokina-local-v004-1']);return 'cancelled';});
    const dialog={...ui(),locale:'en-US'}; vi.mocked(dialog.prompt).mockResolvedValue({response:2});
    await preparePackagedMokinaProfile(config,paths,false,dialog);
    expect(dialog.prompt).toHaveBeenCalledWith(expect.objectContaining({message:'Choose the data for this installation',buttons:['Copy work from 0.0.4-local.1','Start fresh','Cancel']}));
  });
  it('existing/fresh headless starts never show a migration dialog; legacy choice fails explicitly',async()=>{
    const dialog=ui(); vi.mocked(prepareMokinaStableProfile).mockResolvedValue('existing');
    expect(await preparePackagedMokinaProfile(config,paths,true,dialog)).toBe(true);expect(dialog.prompt).not.toHaveBeenCalled();
    vi.mocked(prepareMokinaStableProfile).mockImplementation(async options=>{await options.choose(['mokina-local-v004-1']);return 'cancelled';});
    await expect(preparePackagedMokinaProfile(config,paths,true,dialog)).rejects.toThrow('没有创建空目标');expect(dialog.prompt).not.toHaveBeenCalled();
  });
  it('shows the actual migration failure with a recovery path and returns without activating the profile',async()=>{
    vi.mocked(prepareMokinaStableProfile).mockRejectedValue(new Error('source is still open'));
    const dialog=ui();
    expect(await preparePackagedMokinaProfile(config,paths,false,dialog)).toBe(false);
    expect(dialog.prompt).toHaveBeenCalledWith(expect.objectContaining({message:'无法安全复制已有工作',detail:expect.stringContaining('source is still open')}));
  });
  it('refuses split data-root migration instead of opening an empty misleading target',async()=>{
    await expect(preparePackagedMokinaProfile(config,{dataRoot:'/other/data'},false,ui())).rejects.toThrow('OD_DATA_DIR');expect(prepareMokinaStableProfile).not.toHaveBeenCalled();
  });
});
