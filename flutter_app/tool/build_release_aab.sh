#!/usr/bin/env bash
# One command to a signed Play bundle, once the owner has the upload key.
#
#   cd flutter_app
#   bash tool/build_release_aab.sh            # build with the current pubspec version
#   bash tool/build_release_aab.sh --bump     # raise the versionCode by one first (every upload needs this)
#   bash tool/build_release_aab.sh --bump --name 1.1.0
#   bash tool/build_release_aab.sh --bump --sell   # a bundle that sells Pro and credit packs
#
# --sell turns on Google Play Billing in the app (PLAY_BILLING=true). Without it the bundle sells
# nothing: every Get Pro and top-up entry is drawn as it was before billing existed. The licence-
# tester test on the internal track needs --sell. Ship a selling bundle to everyone only after the
# server's PLAY_BILLING_ENABLED is true on production and the products are active in Play Console
# (docs/brain/PLAY-BILLING-PLAN-1018.md, deploy order). The flag lives here, never in prod.json, so
# a bundle sells only when someone asked for it on the command line.
#
# It refuses to build when the build would be rejected or unsafe:
#   - android/key.properties is missing, or its keystore file is missing (a debug-signed bundle
#     is useless to Play);
#   - dart_defines/prod.json is missing or still holds placeholders;
#   - the working tree's SDK pins (targetSdk 36, minSdk 24) were changed.
# After the build it prints the signer fingerprint (it must be the upload key), checks the 16 KB
# alignment, and copies the Dart symbols and the R8 mapping into build/release-archive/<versionCode>.
# Flutter runs through tool/flutter_locked.sh, the shared build lock. Nothing is uploaded or pushed.
set -euo pipefail
cd "$(dirname "$0")/.."
source tool/android_env.sh

BUMP=0; NAME_ARG=(); SELL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --bump) BUMP=1 ;;
    --name) shift; NAME_ARG=(--name "$1") ;;
    --sell) SELL=1 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

fail() { echo "STOP: $*" >&2; exit 1; }

# 1. Signing key.
[ -f android/key.properties ] || fail "android/key.properties is missing. Run tool\make_upload_key.ps1 (owner) or copy android/key.properties.example."
STORE_FILE=$(sed -n 's/^storeFile=//p' android/key.properties | tr -d '\r')
[ -n "$STORE_FILE" ] || fail "key.properties has no storeFile line."
[ -f "$STORE_FILE" ] || fail "the keystore named in key.properties does not exist: $STORE_FILE"
for k in storePassword keyPassword keyAlias; do
  grep -q "^$k=." android/key.properties || fail "key.properties has no $k value."
done
grep -q "PASSWORD-OF-THE" android/key.properties && fail "key.properties still holds the template passwords."

# 2. Production defines.
[ -f dart_defines/prod.json ] || fail "dart_defines/prod.json is missing. Copy prod.json.example and fill it in."
if grep -q -E "YOUR-PRODUCTION|PASTE-THE" dart_defines/prod.json; then
  fail "dart_defines/prod.json still holds placeholders."
fi
for k in API_BASE_URL SUPABASE_URL SUPABASE_ANON_KEY; do
  grep -q "\"$k\": *\"[^\"]\+\"" dart_defines/prod.json || fail "prod.json needs a value for $k."
done
grep -q '"API_BASE_URL": *"https://www\.mockmob\.in"' dart_defines/prod.json || fail "API_BASE_URL must be https://www.mockmob.in (never the apex, never http)."
grep -q "service_role\|SERVICE_ROLE" dart_defines/prod.json && fail "prod.json must never hold a service role key."
grep -q '"GOOGLE_WEB_CLIENT_ID": *"[^"]\+"' dart_defines/prod.json || echo "note: GOOGLE_WEB_CLIENT_ID is empty, so Google sign-in is hidden in this build."
grep -q '"PLAY_BILLING"' dart_defines/prod.json && fail "prod.json must not set PLAY_BILLING. Use --sell for a bundle that sells."
BILLING_ARG=()
if [ "$SELL" = 1 ]; then
  BILLING_ARG=(--dart-define=PLAY_BILLING=true)
  echo "SELLING bundle: Google Play Billing is ON (Pro and credit packs)."
else
  echo "note: this bundle does not sell (PLAY_BILLING off). Add --sell for the licence-tester or selling bundle."
fi

# 3. SDK pins.
grep -q "maxOf(flutter.targetSdkVersion, 36)" android/app/build.gradle.kts || fail "targetSdk pin (36) was changed."
grep -q "minSdk = 24" android/app/build.gradle.kts || fail "minSdk pin (24) was changed."

# 4. Version.
if [ "$BUMP" = 1 ]; then python -I tool/bump_version.py "${NAME_ARG[@]}"; fi
VERSION=$(python -I tool/bump_version.py --show)
CODE=${VERSION#*+}
echo "Building MockMob $VERSION (versionCode $CODE)"

# 5. Build.
bash tool/flutter_locked.sh build appbundle --release \
  --dart-define-from-file=dart_defines/prod.json "${BILLING_ARG[@]}" \
  --obfuscate --split-debug-info=build/symbols

AAB=build/app/outputs/bundle/release/app-release.aab
[ -f "$AAB" ] || fail "the bundle was not produced."

# 6. Checks. The signer must be the upload key, never "Android Debug".
SIGNER=$(keytool -printcert -jarfile "$AAB" 2>/dev/null || true)
echo "$SIGNER" | grep -E "Owner|SHA1|SHA256" || true
echo "$SIGNER" | grep -q "CN=Android Debug" && fail "the bundle is debug-signed. Do not upload it."
python -I tool/check_16kb.py "$AAB"

# 7. Archive what cannot be recreated later.
OUT="build/release-archive/$CODE"
mkdir -p "$OUT"
SUFFIX=""; [ "$SELL" = 1 ] && SUFFIX="-sells"
cp "$AAB" "$OUT/mockmob-$VERSION$SUFFIX.aab"
[ -f build/app/outputs/mapping/release/mapping.txt ] && cp build/app/outputs/mapping/release/mapping.txt "$OUT/mapping.txt"
[ -d build/symbols ] && cp -r build/symbols "$OUT/symbols"
echo "Done. Upload $OUT/mockmob-$VERSION$SUFFIX.aab to Play Console. Keep $OUT (symbols and mapping)."
