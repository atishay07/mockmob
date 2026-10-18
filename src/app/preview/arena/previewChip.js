// The shell's top-bar chip reads one number; on the wallet fixture it must be the same total the page shows (108, or 0 when
// ?wallet=zero|unknown), not the held-only figure the other preview views use.
export function previewChipCredits(params, fallback) {
  if (params.get('view') !== 'wallet') return fallback;
  return params.get('wallet') === 'zero' || params.get('wallet') === 'unknown' ? 0 : 108;
}
