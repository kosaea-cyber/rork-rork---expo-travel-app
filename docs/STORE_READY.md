# App Store Readiness Checklist (Quick Pass)

Project: **RAWASI Elite**

This is a practical pre-submission checklist to reduce rejections and last-minute surprises. It does **not** automate submission.

## 1) Identity & branding

- [ ] App name matches branding everywhere
  - `app.json` → `expo.name` = **RAWASI Elite**
  - `expo.slug` matches desired project slug
- [ ] App icons + splash look correct on iOS + Android
- [ ] App description, keywords, and screenshots prepared (App Store Connect / Play Console)

## 2) Bundle identifiers / packages (must be non-placeholder)

- [ ] iOS bundle identifier is correct and owned by your Apple Developer team
  - `app.json` → `expo.ios.bundleIdentifier`
- [ ] Android applicationId/package is correct and owned by your Play Console account
  - `app.json` → `expo.android.package`
- [ ] Identifiers are stable (do not change after release)

## 3) Permissions & privacy disclosures

- [ ] Request only the permissions you truly use
  - Camera permission only if you capture images from camera
  - Photo library permission only if you pick/upload images
- [ ] Android: remove legacy / broad storage permissions if not required
  - Prefer scoped access via image picker instead of `WRITE_EXTERNAL_STORAGE`
- [ ] iOS `Info.plist` strings are present and accurate for each permission

## 4) Legal (must be accessible in-app)

- [ ] Privacy Policy page exists and loads from `site_content`
- [ ] Terms page exists and loads from `site_content`
- [ ] Content is available in supported languages (AR/EN/DE) and marked active
- [ ] Ensure the same Privacy Policy URL is configured in App Store Connect / Play Console

## 5) Authentication & account flows

- [ ] If login is required, the app explains why and what users can do without an account
- [ ] Sign out works and clears local state
- [ ] Error states show user-friendly messages and allow retry

## 6) Performance & stability

- [ ] No crashes on cold start
- [ ] Slow network handling: loading states, retries, and offline-ish messaging
- [ ] Large lists are paginated (default 20, max 50) and avoid unbounded rendering
- [ ] Chat sending is rate-limited and server-protected

## 7) Content & moderation (if user-generated content exists)

- [ ] Basic anti-spam / abuse controls are in place for chat
- [ ] Admin moderation tools exist (block users, disable content, etc.)

## 8) Security & data protection

- [ ] RLS enabled and verified for all client-accessible tables
- [ ] No secrets in logs
- [ ] Session handling is consistent

## 9) Operational readiness

- [ ] Support email set up (for “Report” / user support)
- [ ] Privacy requests process (data deletion/export) planned
- [ ] Monitoring / logging strategy in place
