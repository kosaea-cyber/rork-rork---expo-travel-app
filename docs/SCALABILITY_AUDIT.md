# Scalability & Security Audit (Checklist)

This checklist is a living document to keep the app fast, safe, and maintainable as data and traffic grow.

## 1) Data access guardrails

- [ ] All list queries must use explicit pagination (`limit` + optional cursor)
- [ ] Client-side list limits are capped (max **50**)
- [ ] Default list limit is **20** when missing (dev warning is emitted)
- [ ] Prefer cursor pagination over offset pagination for large tables
- [ ] Always order by a stable cursor field (e.g. `created_at`, `id`) and keep indexes aligned

## 2) RLS (Row Level Security) and least privilege

- [ ] Every table used by the client has RLS enabled
- [ ] Policies are reviewed for:
  - [ ] Read access only where needed
  - [ ] Insert/update/delete only for the correct user roles
  - [ ] No broad `true` policies for authenticated users
- [ ] Admin-only tables are not accessible from the client anon key

## 3) Input validation & sanitization

- [ ] Validate all user-controlled inputs before writing to DB
- [ ] Avoid trusting client-provided role / userId
- [ ] Use allowlists for enum-like fields (language, status, etc.)

## 4) Error handling & observability

- [ ] Normalize Supabase/PostgREST/Storage errors into readable user messages
- [ ] Log errors with stable prefixes and enough context (screen + query key)
- [ ] Avoid logging secrets, tokens, or raw PII

## 5) Performance & scalability

- [ ] Queries select only required columns (avoid `select('*')` for hot paths)
- [ ] Add DB indexes for cursor fields, foreign keys, and search patterns
- [ ] Avoid N+1 fetch patterns; batch where possible
- [ ] Cache server state with React Query and set appropriate stale times

## 6) Storage & media

- [ ] Public URLs are cache-busted when replaced
- [ ] Upload paths include uniqueness (`{Date.now()}-{random}`)
- [ ] Avoid oversized images; use server-side resizing if needed

## 7) Security

- [ ] Keys are never hardcoded in the repo
- [ ] No secrets are logged
- [ ] Avoid exposing internal admin routes/controls without guards
- [ ] Confirm auth session handling is consistent (sign-out clears local state)

## 8) Web compatibility

- [ ] Any native-only APIs are behind platform checks or known polyfills
- [ ] Pagination and error handling utilities work on web + native
