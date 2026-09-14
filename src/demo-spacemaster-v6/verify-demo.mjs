// Domain-only story verification; no browser navigation or pixel claims.
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
console.log('V6.2 story: business-state integration only. Browser/visual/offline-open checks are not run.');
const result=spawnSync(process.execPath,['--test','tests/v62-integration.test.cjs'],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
