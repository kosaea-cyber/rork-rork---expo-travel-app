type AnyError = {
  message?: unknown;
  error_description?: unknown;
  status?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  name?: unknown;
};

function getString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return null;
}

function stringify(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value == null) return null;
  try {
    const s = JSON.stringify(value);
    return typeof s === 'string' && s.trim().length > 0 ? s : null;
  } catch {
    return String(value);
  }
}

function getNestedMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return (
    getString(v.message) ??
    getString(v.error_description) ??
    getString(v.details) ??
    getString(v.hint) ??
    null
  );
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

export function normalizeSupabaseError(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.';

  const e: AnyError = typeof error === 'object' ? (error as AnyError) : { message: String(error) };

  const message =
    getString(e.error_description) ??
    getString(e.message) ??
    getNestedMessage(e.message) ??
    getNestedMessage((e as unknown as { error?: unknown }).error) ??
    (typeof error === 'string' ? error : null) ??
    stringify(error) ??
    'Something went wrong. Please try again.';

  const status = getNumber(e.status);
  const code = getString(e.code);

  if (status === 401 || code === 'PGRST301') {
    return 'You are not signed in. Please log in and try again.';
  }

  if (status === 403) {
    return 'You don’t have permission to do that.';
  }

  if (status === 404) {
    return 'Not found.';
  }

  if (status === 409) {
    return 'This item already exists.';
  }

  if (status === 429) {
    return 'Too many requests. Please slow down and try again.';
  }

  if (status && status >= 500) {
    return 'Server error. Please try again in a moment.';
  }

  // Storage “Object not found” / 404 cases often come through as message strings.
  const lower = message.toLowerCase();
  if (lower.includes('not found') || lower.includes('does not exist')) {
    return 'Not found.';
  }

  if (lower.includes('jwt') || lower.includes('token') || lower.includes('unauthorized')) {
    return 'You are not signed in. Please log in and try again.';
  }

  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('timeout')) {
    return 'Network error. Check your connection and try again.';
  }

  if (lower.includes('permission') || lower.includes('row level security') || lower.includes('rls')) {
    return 'You don’t have permission to do that.';
  }

  return message;
}
