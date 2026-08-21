import type { Translation } from '../types';

/**
 * Map a raw `translations` DB row to a `Translation`. Kept pure and free of any
 * database driver so it can be unit-tested and shared by both providers.
 * SQLite has no boolean type, so the flag columns are stored as 0/1 integers and
 * coerced back to booleans here; empty text columns become `undefined`.
 */
export function toTranslation(r: Record<string, unknown>): Translation {
  return {
    id: Number(r.id),
    abbrev: String(r.abbrev),
    name: String(r.name),
    language: String(r.language),
    publicDomain: !!r.public_domain,
    licenseName: String(r.license ?? ''),
    licenseUrl: (r.license_url as string) || undefined,
    copyright: (r.copyright as string) || undefined,
    attribution: (r.attribution as string) || undefined,
    sourceUrl: (r.source_url as string) || undefined,
    textVersion: (r.text_version as string) || undefined,
    hasStrongs: !!r.has_strongs,
    isLocal: !!r.is_local,
  };
}
