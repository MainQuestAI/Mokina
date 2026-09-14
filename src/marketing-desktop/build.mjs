import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../demo-spacemaster-v6/build.mjs',import.meta.url));
const result=spawnSync(process.execPath,[script,'--marketing'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
