export function pickPackageTitle(
  pkg: { title_de?: string | null; title_en?: string | null; title_ar?: string | null } | null,
  lang: 'de' | 'en' | 'ar' | null | undefined,
) {
  if (!pkg) return '';
  const l = (lang ?? 'en').toLowerCase();
  if (l.startsWith('ar')) return (pkg.title_ar ?? pkg.title_en ?? pkg.title_de ?? '').trim();
  if (l.startsWith('de')) return (pkg.title_de ?? pkg.title_en ?? pkg.title_ar ?? '').trim();
  return (pkg.title_en ?? pkg.title_de ?? pkg.title_ar ?? '').trim();
}
