export function safeNext(v: string | null): string {
  if (!v || typeof v !== 'string') {
    return '/';
  }
  const trimmed = v.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/';
  }
  if (trimmed.includes('://')) {
    return '/';
  }
  return trimmed;
}
