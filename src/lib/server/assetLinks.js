// Digital Asset Links for Android App Links. Plain module so node tests can load it.
//
// ANDROID_CERT_SHA256 holds one or more SHA-256 certificate fingerprints, comma-separated: the Play app-signing
// key (what a Play-installed app is signed with) and, if wanted, the upload key. Paste them as Play Console shows
// them (App integrity, "SHA-256 certificate fingerprint"): with or without colons, any case, spaces or line breaks
// are fine. Anything that is not 32 bytes of hex is dropped, so a typo cannot publish a broken statement.

export const ANDROID_PACKAGE = 'in.mockmob.app';

/** Each valid fingerprint in `raw`, as AA:BB:... upper-case, without duplicates. */
export function parseCertFingerprints(raw) {
  const out = [];
  for (const piece of String(raw ?? '').split(/[,;\n]/)) {
    const hex = piece.replace(/^\s*sha-?256\s*:?\s*/i, '').replace(/[\s:]/g, '').toUpperCase();
    if (!/^[0-9A-F]{64}$/.test(hex)) continue;
    const colon = hex.match(/.{2}/g).join(':');
    if (!out.includes(colon)) out.push(colon);
  }
  return out;
}

/** The assetlinks.json body: one statement for the app, or [] when no fingerprint is set. */
export function assetLinksBody(raw, packageName = ANDROID_PACKAGE) {
  const fingerprints = parseCertFingerprints(raw);
  if (!fingerprints.length) return [];
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints },
  }];
}
