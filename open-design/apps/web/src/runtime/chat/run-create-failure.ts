/** Only a daemon admission proof (or its legacy explicit 503 guard) permits restoring a draft. */
export function isDefinitiveRunCreateRefusal(status: number, body: unknown): boolean {
  if (status < 400 || status > 599 || !body || typeof body !== 'object') return false;
  const error = (body as { error?: { code?: string; details?: { runAcceptance?: string } } }).error;
  if (!error || typeof error !== 'object') return false;
  if (error.details?.runAcceptance === 'unknown') return false;
  if (error.details?.runAcceptance === 'not-accepted') return true;
  return status === 503 && (error.code === 'WORKSPACE_AUTHORITY_UNAVAILABLE' || error.code === 'UPSTREAM_UNAVAILABLE');
}
