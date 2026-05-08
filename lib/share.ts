import type { BacktestRequest } from './types';

const HASH_PREFIX = 'config=';
const VERSION = 1;

interface ShareConfig {
  v: number;
  requests: BacktestRequest[];
}

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToUtf8(s: string): string {
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeShareLink(requests: BacktestRequest[]): string {
  const payload: ShareConfig = { v: VERSION, requests };
  return utf8ToBase64Url(JSON.stringify(payload));
}

export function decodeHash(hash: string): BacktestRequest[] | null {
  try {
    const cleaned = hash.replace(/^#/, '');
    if (!cleaned.startsWith(HASH_PREFIX)) return null;
    const encoded = cleaned.slice(HASH_PREFIX.length);
    if (!encoded) return null;
    const json = base64UrlToUtf8(encoded);
    const parsed = JSON.parse(json) as Partial<ShareConfig>;
    if (parsed?.v !== VERSION || !Array.isArray(parsed.requests)) return null;
    return parsed.requests as BacktestRequest[];
  } catch {
    return null;
  }
}

export function shareUrl(requests: BacktestRequest[]): string {
  if (typeof window === 'undefined') return '';
  const encoded = encodeShareLink(requests);
  return `${window.location.origin}${window.location.pathname}#${HASH_PREFIX}${encoded}`;
}

export function writeHash(requests: BacktestRequest[]): void {
  if (typeof window === 'undefined') return;
  if (requests.length === 0) {
    window.history.replaceState(null, '', window.location.pathname);
    return;
  }
  const encoded = encodeShareLink(requests);
  window.history.replaceState(null, '', `#${HASH_PREFIX}${encoded}`);
}
