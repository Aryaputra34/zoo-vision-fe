const PROBE = 'http://next.invalid';

// A same-origin path for the redirect after login, or '/'. Resolving it the way the browser will is the only
// safe check: the URL parser drops tabs and newlines, so '/\t/evil.test' would become '//evil.test'.
export function safeNext(v: string | null): string {
  if (!v || typeof v !== 'string') {
    return '/';
  }
  const trimmed = v.trim();
  // Control characters and backslashes (which the URL parser reads as '/') are never in a path we link to.
  if (!trimmed.startsWith('/') || /[\u0000-\u001F\u007F]/.test(trimmed) || trimmed.includes('\\')) {
    return '/';
  }
  let url: URL;
  try {
    url = new URL(trimmed, PROBE);
  } catch {
    return '/';
  }
  if (url.origin !== PROBE) {
    return '/';
  }
  return url.pathname + url.search + url.hash;
}
