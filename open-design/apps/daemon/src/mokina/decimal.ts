/** Exact decimal inputs: unsupported precision is rejected, never rounded on read. */
export function decimal(value: string, digits = 8): bigint | null {
  const text = value.trim();
  if (!new RegExp(`^-?\\d+(?:\\.\\d{1,${digits}})?$`, 'u').test(text)) return null;
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  const scale = 10n ** BigInt(digits);
  const units = BigInt(whole!) * scale + BigInt(fraction.padEnd(digits, '0'));
  return units <= 1_000_000_000_000n * scale ? (text.startsWith('-') ? -units : units) : null;
}
export function formatDecimal(value: bigint, digits: number): string {
  const absolute = value < 0n ? -value : value; const scale = 10n ** BigInt(digits);
  const fraction = String(absolute % scale).padStart(digits, '0').replace(/0+$/, '');
  return `${value < 0n ? '-' : ''}${absolute / scale}${fraction ? '.' + fraction : ''}`;
}
