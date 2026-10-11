import { join, resolve } from 'node:path';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { MOKINA_STABLE_PROFILE, prepareMokinaStableProfile, type MokinaProfileMigrationReport } from '@open-design/desktop/main';
import type { PackagedConfig } from './config.js';
import type { PackagedNamespacePaths } from './paths.js';

type Prompt = { title: string; message: string; detail: string; buttons: string[]; defaultId: number; cancelId: number; noLink: boolean };
export type MokinaProfileStartupUi = { locale: string; ready: () => Promise<unknown>; prompt: (options: Prompt) => Promise<{ response: number }> };

/** Electron creates session directories at ready, even without a BrowserWindow.
 * A first-launch chooser must therefore use a disposable session. The existing
 * sidecar bootstrap starts the committed profile in a fresh Electron process. */
export function prepareMokinaProfileElectronPaths(config: Pick<PackagedConfig, 'namespace' | 'namespaceBaseRoot' | 'product'>,
  paths: PackagedNamespacePaths, electronApp: { setPath: (name: 'userData' | 'sessionData' | 'logs', value: string) => void }) {
  if (config.product?.productId !== 'mokina' || config.namespace !== MOKINA_STABLE_PROFILE) return null;
  let bootstrapRoot: string | null = null;
  if (!existsSync(paths.namespaceRoot)) {
    mkdirSync(config.namespaceBaseRoot, { recursive: true });
    bootstrapRoot = mkdtempSync(join(config.namespaceBaseRoot, '.mokina-profile-bootstrap-'));
  } else {
    const stat=lstatSync(paths.namespaceRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Mokina profile 不是普通目录，未启动。');
  }
  const dispose=()=>{if(bootstrapRoot)rmSync(bootstrapRoot,{recursive:true,force:true});};
  try {
    electronApp.setPath('userData', bootstrapRoot ? join(bootstrapRoot, 'user-data') : paths.electronUserDataRoot);
    electronApp.setPath('sessionData', bootstrapRoot ? join(bootstrapRoot, 'session') : paths.electronSessionDataRoot);
    electronApp.setPath('logs', bootstrapRoot ? join(bootstrapRoot, 'logs') : paths.desktopLogsRoot);
  }catch(error){dispose();throw error;}
  return { bootstrapRoot, dispose };
}

/** Assembly-only: business migration and its lock belong to desktop/main. */
export async function preparePackagedMokinaProfile(config: Pick<PackagedConfig, 'namespace' | 'namespaceBaseRoot' | 'product'>,
  paths: Pick<PackagedNamespacePaths, 'dataRoot'>, headless: boolean, ui: MokinaProfileStartupUi): Promise<boolean> {
  if (config.product?.productId !== 'mokina' || config.namespace !== MOKINA_STABLE_PROFILE) return true;
  if (resolve(paths.dataRoot) !== join(resolve(config.namespaceBaseRoot), MOKINA_STABLE_PROFILE, 'data')) {
    throw new Error('Mokina 稳定 profile 的自动迁移不支持独立 OD_DATA_DIR。请使用原 namespace，或在离线统一 profile 副本中迁移。');
  }
  // Same native support-flow convention as desktop mailto-open: OS Chinese or English.
  const t = (zh: string, en: string) => ui.locale.toLowerCase().startsWith('zh') ? zh : en;
  const versionFor = (source: string) => source === 'mokina-local-v004-1' ? '0.0.4-local.1' : '0.0.4-local.4';
  let outcome: Awaited<ReturnType<typeof prepareMokinaStableProfile>>;
  try { outcome = await prepareMokinaStableProfile({ namespaceBaseRoot: config.namespaceBaseRoot, choose: async sources => {
    if (headless) throw new Error('发现旧 Mokina profile。请先使用桌面选择数据来源，或 tools-pack profile-migrate 明确迁移；没有创建空目标。');
    await ui.ready();
    const choice = await ui.prompt({ title: t('Mokina · 保留已有工作', 'Mokina · Keep your work'), message: t('选择这次使用的数据', 'Choose the data for this installation'),
      detail: t('复制旧版项目、版本、设置和未发送草稿到固定的数据位置 mokina-local；原目录保留。请先退出旧版。外部导入文件夹仍指向原位置，定时任务暂停，未知请求不会自动重发。\n\n取消不会创建新 profile；后续版本沿用这次选择。', 'Copy projects, versions, settings and unsent drafts to the stable mokina-local profile. Quit the old app first. The original profile stays intact. Imported folders keep their external paths; scheduled tasks are paused; unknown requests are not resent.\n\nCancel creates no target. Later versions reuse this profile.') + `\n\n${sources.join('\n')}`,
      buttons: [...sources.map(source => t(`复制 ${versionFor(source)} 的工作`, `Copy work from ${versionFor(source)}`)), t('全新开始', 'Start fresh'), t('取消', 'Cancel')], defaultId: sources.length + 1, cancelId: sources.length + 1, noLink: true });
    if (choice.response === sources.length + 1) return null;
    if (choice.response === sources.length) {
      const confirm = await ui.prompt({ title: t('Mokina · 全新开始', 'Mokina · Start fresh'), message: t('创建空的独立数据位置？', 'Create an empty independent profile?'),
        detail: t('旧 profile 会保留，但之后不能合并进这个新 profile。若要保留旧工作，请返回并选择复制。', 'The old profile stays intact, but cannot be merged into this new profile later. To keep existing work, go back and choose Copy.'), buttons: [t('返回', 'Go back'), t('全新开始', 'Start fresh')], defaultId: 0, cancelId: 0, noLink: true });
      return confirm.response === 1 ? 'fresh' : null;
    }
    return sources[choice.response] ?? null;
  } }); } catch(error) {
    if(headless)throw error;
    await ui.ready();
    await ui.prompt({title:t('Mokina · 尚未启用新数据','Mokina · Profile not activated'),message:t('无法安全复制已有工作','Could not safely copy your work'),
      detail:`${error instanceof Error?error.message:String(error)}\n\n${t('原 profile 保留。请根据上述原因处理后重新打开应用；不会自动重试或覆盖既有数据。','The original profile is preserved. Resolve the issue above and reopen the app. Data will not be retried or overwritten automatically.')}`,
      buttons:[t('关闭','Close')],defaultId:0,cancelId:0,noLink:true});
    return false;
  }
  if (outcome === 'cancelled') return false;
  if (!headless && typeof outcome !== 'string' && outcome.status === 'migrated') await reportMigration(outcome, ui);
  return true;
}
async function reportMigration(report: MokinaProfileMigrationReport, ui: MokinaProfileStartupUi) {
  await ui.ready();
  const t = (zh: string, en: string) => ui.locale.toLowerCase().startsWith('zh') ? zh : en;
  await ui.prompt({ title: t('Mokina · 工作已保留', 'Mokina · Work preserved'), message: t('已复制并验证，可以继续工作', 'Copy verified. Your work is ready.'),
    detail: t(`${report.projects} 个项目、${report.conversations} 个会话、${report.recoveryRecords} 条恢复记录已保留。\n外部导入目录：${report.externalProjectIds.length} 个，仍使用原路径。已暂停定时任务：${report.disabledRoutines} 个。\n原 profile 未修改；迁移摘要保存在 mokina-local/profile-migration.json。`, `${report.projects} projects, ${report.conversations} conversations and ${report.recoveryRecords} recovery records preserved.\n${report.externalProjectIds.length} imported projects keep their external paths. ${report.disabledRoutines} scheduled tasks paused.\nOriginal profile unchanged. See mokina-local/profile-migration.json for the report.`),
    buttons: [t('开始工作', 'Continue')], defaultId: 0, cancelId: 0, noLink: true });
}
