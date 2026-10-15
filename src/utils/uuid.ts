/**
 * Local-only identifier for future sync (idea.txt §13.4) and AI payload
 * references. Not cryptographic; collisions are negligible at this scale and
 * the column is only a stable cross-reference, never an auth token.
 */
export function newUuid(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 32; i += 1) {
    out += hex[Math.floor(Math.random() * 16)];
  }
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20)}`;
}
