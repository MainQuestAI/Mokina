/** SHA256 of the bytes selected by the user, rather than a file name or timestamp. */
export async function mokinaBytesDigest(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}
