/**
 * Cryptographic Utilities for ChatNova
 * Simulates Curve25519 / AES-GCM-256 / Post-Quantum Safety verification
 */

export function generateFingerprint(input?: string): string {
  const seed = input || Math.random().toString(36).substring(2);
  const segments: string[] = [];
  for (let i = 0; i < 6; i++) {
    let segment = '';
    for (let j = 0; j < 5; j++) {
      segment += Math.floor(Math.random() * 10).toString();
    }
    segments.push(segment);
  }
  return segments.join(' ');
}

export function generatePublicKey(): string {
  const chars = '0123456789ABCDEF';
  let key = 'NOVA-256-';
  for (let i = 0; i < 32; i++) {
    if (i > 0 && i % 8 === 0) key += '-';
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

export function maskCustomId(customId: string): string {
  if (!customId) return '@anonymous';
  if (customId.startsWith('@')) return customId;
  return `@${customId}`;
}
