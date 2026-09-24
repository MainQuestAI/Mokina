/** Mokina local runtime is the default; upstream compatibility suites opt out explicitly. */
export function isMokinaLocalEdition(): boolean {
  return process.env.MOKINA_LOCAL_EDITION !== 'off';
}
