import { en } from '../../src/i18n/locales/en';
import { zhCN } from '../../src/i18n/locales/zh-CN';
import { buildSocialSharePayload, MOKINA_GITHUB_REPO_URL } from '@open-design/contracts';
import { expect, it, vi } from 'vitest';
vi.mock('../../src/mokina-edition', () => ({ MOKINA_LOCAL_EDITION: true }));
import { mokinaProductCopy } from '../../src/i18n/product-brand';

it('brands product copy while preserving instructions, service identity and interpolation', () => {
  expect(mokinaProductCopy('settings.welcomeTitle', 'Welcome to OpenDesign')).toBe('Welcome to Mokina');
  expect(mokinaProductCopy('app.brand', 'open design')).toBe('Mokina');
  expect(mokinaProductCopy('settings.welcomeTitle', 'Üdvözöljük az OpenDesignban')).toBe('Üdvözöljük a Mokinában');
  expect(mokinaProductCopy('settings.mcpServerHint', 'Tedd elérhetővé az OpenDesignt')).toBe('Tedd elérhetővé a Mokinát');
  expect(mokinaProductCopy('entry.followXLabel', '@OpenDesignHQ')).toBe('@OpenDesignHQ');
  expect(mokinaProductCopy('settings.agentInstall.pathHint', 'der Open-Design-Daemon erbt')).toBe('der Mokina-Daemon erbt');
  expect(mokinaProductCopy('useEverywhere.section.mcp.footer', 'in der Open-Design-App')).toBe('in der Mokina-App');
  expect(mokinaProductCopy('useEverywhere.section.skills.snippet1', 'Open-Design-Extras; @open-design/contracts')).toBe('Mokina-Extras; @open-design/contracts');
  expect(mokinaProductCopy('chat.contextPrompt.referenceProject', 'Use the OpenDesign project {name}')).toBe('Use the OpenDesign project {name}');
  expect(mokinaProductCopy('handoff.promptIntro', 'OpenDesign project folder:')).toBe('OpenDesign project folder:');
  expect(mokinaProductCopy('settings.cloudCalloutTitle', 'OpenDesign Cloud')).toBe('OpenDesign Cloud');
  expect(mokinaProductCopy('library.openDesignSystem', 'Open design system')).toBe('Open design system');
  expect(mokinaProductCopy('project.title', 'Open Design · {name}').replace('{name}', 'OpenDesign customer report')).toBe('Mokina · OpenDesign customer report');
});

it.each([en, zhCN])('pairs translated Mokina share copy with its repository without rewriting user content', dict => {
  const values: Record<string, string> = { title: 'OpenDesign customer title', url: 'https://example.com/OpenDesign/result', repo: MOKINA_GITHUB_REPO_URL };
  const translate = (key: 'socialShare.projectTitle' | 'socialShare.projectText' | 'socialShare.projectCopyText') =>
    mokinaProductCopy(key, dict[key]).replace(/\{(\w+)\}/g, (_match, name: string) => values[name]!);
  const payload = buildSocialSharePayload({ kind: 'project-html', edition: 'mokina', url: values.url,
    title: translate('socialShare.projectTitle'), text: translate('socialShare.projectText'), copyText: translate('socialShare.projectCopyText') });
  expect(payload.title).toContain(values.title);
  expect(payload.text).toContain(MOKINA_GITHUB_REPO_URL);
  expect(payload.copyText).toContain(values.url);
  expect(payload.copyText).toContain(values.title);
  expect(payload.copyText).toContain('Mokina');
  expect(payload.copyText).not.toContain('nexu-io');
});
