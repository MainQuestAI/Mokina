import type { MokinaQualitySnapshot } from '@open-design/contracts';
import { useT } from '../../i18n';
import styles from './MokinaVersionQuality.module.css';

/** Data comes from the same selected-version response as the editor, never the current file. */
export function MokinaVersionQuality({ quality, versionId, onLocate }: {
  quality?: MokinaQualitySnapshot; versionId: string; onLocate: (sectionId: string) => void;
}) {
  const t = useT();
  if (quality && quality.versionId !== versionId) return null;
  return <details className={styles.panel} data-testid="mokina-version-quality">
    <summary>{t('mokina.quality.title')} · {quality ? t(`mokina.quality.${quality.status}`) : t('mokina.quality.unavailable')}</summary>
    <p>{t('mokina.quality.scope')}</p>
    {quality ? <>
      <code className={styles.identity}>{quality.versionId} · {quality.contentDigest}</code>
      {quality.issues.length ? <ul>{quality.issues.map((issue, index) => <li key={index}>
        <strong>{issue.code}</strong> {issue.message} {issue.sectionId ? <button type="button" onClick={() => onLocate(issue.sectionId!)}>{t('mokina.quality.locate')} {issue.sectionId}</button> : null}
      </li>)}</ul> : null}
      {quality.calculations.map((calculation, index) => <p key={index}>{calculation.expression} = <strong>{calculation.result}</strong></p>)}
      {quality.sources.map(source => <details key={source.id}>
        <summary>{source.id} · {source.kind} · {source.path}</summary>
        <p>{source.locator} · {source.limitation}</p>
        {source.methodVersion ? <p>{t('mokina.quality.method')} {source.methodVersion}</p> : null}
        {source.url ? <p><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a> · {source.accessedAt}</p> : null}
        <code className={styles.identity}>{source.sha256}</code>
        {source.error ? <p role="alert">{source.error}</p> : <pre>{source.text}</pre>}
      </details>)}
    </> : null}
  </details>;
}
