import { Button } from '@open-design/components';
import type { MokinaQualitySnapshot } from '@open-design/contracts';
import { useT } from '../../i18n';
import styles from './MokinaVersionQuality.module.css';

/** Data comes from the same selected-version response as the editor, never the current file. */
export function MokinaVersionQuality({ quality, versionId, onLocate, requestState, onRetry, locateDisabled, locationFailed, locatedSection, onRevise }: {
  quality?: MokinaQualitySnapshot; versionId: string; onLocate: (sectionId: string) => void;
  requestState?: 'loading' | 'ready' | 'error'; onRetry?: () => void; locateDisabled?: boolean;
  locationFailed?: boolean; locatedSection?: string | null; onRevise?: () => void;
}) {
  const t = useT();
  if (quality && quality.versionId !== versionId) quality = undefined;
  const state = requestState ?? (quality ? 'ready' : 'error');
  if (state !== 'ready') quality = undefined;
  return <details className={styles.panel} data-testid="mokina-version-quality">
    <summary>{t('mokina.quality.title')} · {state === 'loading' ? t('mokina.quality.loading') : quality ? t(`mokina.quality.${quality.status}`) : t('mokina.quality.unavailable')}</summary>
    <p>{t('mokina.quality.scope')}</p>
    {state === 'error' && onRetry ? <Button variant="ghost" onClick={onRetry}>{t('mokina.quality.retry')}</Button> : null}
    {locationFailed ? <p role="alert">{t('mokina.quality.locationFailed')}</p> : null}
    {locatedSection ? <p role="status">{t('mokina.quality.located')} {locatedSection} {onRevise ? <Button variant="ghost" onClick={onRevise}>{t('mokina.quality.revise')}</Button> : null}</p> : null}
    {quality ? <>
      {quality.resources?.status === 'incomplete' ? <p role="alert">{t('mokina.quality.resourcesIncomplete')} {quality.resources.reasons.join('; ')}</p> : null}
      <code className={styles.identity}>{quality.versionId} · {quality.contentDigest}</code>
      {quality.issues.length ? <ul>{quality.issues.map((issue, index) => <li key={index}>
        <strong>{issue.code}</strong> {issue.message} {issue.sectionId ? <Button variant="ghost" disabled={locateDisabled} onClick={() => onLocate(issue.sectionId!)}>{t('mokina.quality.locate')} {issue.sectionId}</Button> : null}
      </li>)}</ul> : null}
      {quality.calculations.map((calculation, index) => <p key={index}>{calculation.expression} = <strong>{calculation.result}</strong></p>)}
      {quality.sources.map(source => <details key={source.id}>
        <summary>{source.id} · {source.kind} · {source.path}</summary>
        <p>{source.locator} · {source.limitation}</p>
        {source.methodVersion ? <p>{t('mokina.quality.method')} {source.methodVersion}</p> : null}
        {source.webCapture ? <>
          {/* A source that failed this reference's checks must not read as verified. */}
          <p>{t(source.error ? 'mokina.web.capturedUnverified' : 'mokina.web.captured')} · {source.webCapture.resolvedUrl} · {source.webCapture.retrievedAt}</p>
          <p>{t(source.webCapture.scope === 'plain-text' ? 'mokina.web.plain' : 'mokina.web.static')}</p>
          {source.webCapture.limitations.map(item => <p key={item}>{item}</p>)}
        </> : source.url ? <p>{t('mokina.web.declared')}</p> : null}
        {source.url ? <p><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a> · {source.accessedAt}</p> : null}
        {source.versionId ? <code className={styles.identity}>{t('mokina.web.sourceVersion')} {source.versionId}</code> : null}
        {source.excerpt ? <blockquote>{source.excerpt}</blockquote> : null}
        <Button variant="ghost" disabled={locateDisabled} onClick={() => onLocate(source.sectionId)}>{t('mokina.web.locateQuote')} {source.sectionId}</Button>
        <code className={styles.identity}>{source.sha256}</code>
        {source.error ? <p role="alert">{source.error}</p> : null}{source.text !== undefined ? <pre>{source.text}</pre> : null}
      </details>)}
    </> : null}
  </details>;
}
