import { expect, it, vi } from 'vitest';
vi.mock('../../src/mokina-edition', () => ({ MOKINA_LOCAL_EDITION: true }));
import { mokinaProductCopy } from '../../src/i18n/product-brand';

it('brands product copy while preserving instructions, service identity and interpolation', () => {
  expect(mokinaProductCopy('settings.welcomeTitle', 'Welcome to OpenDesign')).toBe('Welcome to Mokina');
  expect(mokinaProductCopy('app.brand', 'open design')).toBe('Mokina');
  expect(mokinaProductCopy('settings.welcomeTitle', 'Üdvözöljük az OpenDesignban')).toBe('Üdvözöljük a Mokinában');
  expect(mokinaProductCopy('settings.mcpServerHint', 'Tedd elérhetővé az OpenDesignt')).toBe('Tedd elérhetővé a Mokinát');
  expect(mokinaProductCopy('entry.followXLabel', '@OpenDesignHQ')).toBe('@OpenDesignHQ');
  expect(mokinaProductCopy('chat.contextPrompt.referenceProject', 'Use the OpenDesign project {name}')).toBe('Use the OpenDesign project {name}');
  expect(mokinaProductCopy('handoff.promptIntro', 'OpenDesign project folder:')).toBe('OpenDesign project folder:');
  expect(mokinaProductCopy('settings.cloudCalloutTitle', 'OpenDesign Cloud')).toBe('OpenDesign Cloud');
  expect(mokinaProductCopy('library.openDesignSystem', 'Open design system')).toBe('Open design system');
  expect(mokinaProductCopy('project.title', 'Open Design · {name}').replace('{name}', 'OpenDesign customer report')).toBe('Mokina · OpenDesign customer report');
});
