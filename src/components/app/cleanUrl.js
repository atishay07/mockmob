// Shared by the server CTA and the client nudge so both agree on what counts as a usable link.
// No imports on purpose: it must stay safe to bundle into client code.
export function cleanUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}
