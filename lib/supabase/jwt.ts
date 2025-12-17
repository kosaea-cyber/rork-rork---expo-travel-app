export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const base64Url = parts[1] ?? '';
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLength);

    const atobFn: ((data: string) => string) | undefined = (globalThis as unknown as { atob?: (s: string) => string })
      .atob;

    if (!atobFn) {
      console.warn('[jwt] atob is not available; cannot decode jwt');
      return null;
    }

    const json = atobFn(padded);
    const payload = JSON.parse(json) as Record<string, unknown>;
    return payload;
  } catch (e) {
    console.error('[jwt] decodeJwtPayload failed', e);
    return null;
  }
}

export function getJwtClaimString(token: string | null | undefined, claim: string): string | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const value = payload?.[claim];
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}
