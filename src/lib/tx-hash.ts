// Deterministic short hash for a transaction id (8 chars, base36 uppercase).
// Se muestra como identificador único visible en listados y expediente.
export function txHash(id: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  const n = ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36))
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .padEnd(8, "X")
    .slice(0, 8);
  return `#${n}`;
}
