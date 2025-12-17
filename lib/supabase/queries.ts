export type PageDirection = 'asc' | 'desc';

export type PagedOptions<Row> = {
  limit?: number;
  cursorField?: keyof Row & string;
  cursorValue?: Row[keyof Row] | null;
  direction?: PageDirection;
};

type PagedCapableQuery = {
  order: (column: string, options?: { ascending?: boolean }) => unknown;
  range: (from: number, to: number) => unknown;
  gt?: (column: string, value: unknown) => unknown;
  lt?: (column: string, value: unknown) => unknown;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function devWarn(message: string, meta?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.warn(message, meta ?? {});
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

export function enforceListLimit(limit: number | undefined): number {
  if (limit == null) {
    devWarn('[supabase][paged] Missing limit (defaulting to 20). Pass a limit explicitly for list queries.');
    return DEFAULT_LIMIT;
  }

  const clamped = clampLimit(limit);
  if (clamped !== limit) {
    devWarn('[supabase][paged] Limit clamped for safety.', { requested: limit, applied: clamped, max: MAX_LIMIT });
  }
  return clamped;
}

export function paged<Row>(query: PagedCapableQuery, options: PagedOptions<Row>) {
  const limit = enforceListLimit(options.limit);
  const direction: PageDirection = options.direction ?? 'desc';

  let q = query as any;

  const cursorField = options.cursorField;
  const cursorValue = options.cursorValue;

  if (cursorField && cursorValue != null) {
    if (direction === 'asc') {
      q = q.gt(cursorField, cursorValue as any);
    } else {
      q = q.lt(cursorField, cursorValue as any);
    }
  } else if ((cursorField && cursorValue == null) || (!cursorField && cursorValue != null)) {
    devWarn('[supabase][paged] cursorField/cursorValue must be provided together. Ignoring cursor.', {
      cursorField,
      cursorValue,
    });
  }

  q = q.order(cursorField ?? ('created_at' as any), { ascending: direction === 'asc' });

  // PostgREST uses an inclusive range (0..limit-1)
  q = q.range(0, limit - 1);

  return q;
}
