# Releasing the MockMob Android app

Package `in.mockmob.app`. Everything below runs from `flutter_app` in Git Bash, except the key
script (PowerShell). Flutter commands always go through `bash tool/flutter_locked.sh <args>`
(it shares build slots with other agents on this PC).

## Release configuration (verified 13 Oct 2026)

| Item | Value | Why |
|---|---|---|
| applicationId / namespace | `in.mockmob.app` | The Play package name. It can never change after the first upload. |
| versionName / versionCode | from `pubspec.yaml` `version: 1.0.0+1` (name `1.0.0`, code `1`) | Play rejects an upload whose versionCode is not higher than every earlier upload. Bump the number after the `+` for every upload, or pass `--build-number`. |
| compileSdk | 36 (Flutter default) | Plugins need it. |
| targetSdk | 36 (never lower; `maxOf(flutter.targetSdkVersion, 36)`) | Play requires Android 16 (API 36) for new apps and updates submitted from 31 Aug 2026 (extension possible to 1 Nov 2026). Source: Play Console Help, "Target API level requirements for Google Play apps". |
| minSdk | 24 (Android 7.0), pinned | Every plugin we use needs 24 at most; Android 7+ covers virtually all budget phones in India. |
| R8 code shrinking and resource shrinking | on for release (Flutter Gradle plugin) | Rules for plugins that use reflection are in `android/app/proguard-rules.pro` (Gson in flutter_local_notifications, WorkManager workers, Credential Manager, Tink in flutter_secure_storage, home_widget). |
| Native debug symbols | `SYMBOL_TABLE` in the AAB | Lets Play Console symbolicate native crashes. |
| 16 KB page size | see "16 KB check" below | Play requires it for apps targeting Android 15+ (hard deadline 1 Feb 2027; source: developer.android.com/guide/practices/page-sizes). |
| Permissions | 9 in the merged release manifest (aapt2 on the arm64 release APK, 14 Oct 2026). The app declares INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED and WAKE_LOCK. Plugins add VIBRATE (flutter_local_notifications), FOREGROUND_SERVICE and FOREGROUND_SERVICE_SHORT_SERVICE (workmanager), and USE_BIOMETRIC (androidx.biometric; the app never asks for biometrics). | No exact alarms, no location, no contacts, no storage, no ad ID. Short service is not a Play special foreground-service type, but the Play Console foreground-service declaration should say it is used for short background sync of answers; FOREGROUND_SERVICE_DATA_SYNC is not declared. Re-run `aapt2 dump badging` on the exact upload. Matches the Data safety answers below; the reasoning is in `docs/brain/PLAY-LISTING-2026-10-14.md`. |
| Cleartext traffic | only in the debug manifest | Release is HTTPS only. |

## 1. Create the upload key (owner, once)

You own the keys. Nobody else needs the password.

```powershell
cd "C:\Users\atish\Desktop\mockmob copy\mockmob-next\flutter_app"
powershell -ExecutionPolicy Bypass -File tool\make_upload_key.ps1
```

It asks for a password twice (hidden), creates `%USERPROFILE%\mockmob-keys\mockmob-upload.jks`,
writes `android\key.properties` (git-ignored; Gradle needs the password there), and prints the
SHA-1 and SHA-256 of the upload key. Then:

1. Copy the `.jks` file and the password to two separate safe places (password manager plus an
   encrypted USB stick or private vault). Never commit, email or paste them.
2. Keep the printed fingerprints.

If the upload key is ever lost, the app is not lost (Play App Signing holds the real key); you ask
Play support to register a new upload key. That takes days, so back up.

Without `android/key.properties` a release build is debug-signed. Such a file builds and runs but
**Play will reject it. Never upload a debug-signed bundle.**

## 2. Production defines

```powershell
copy dart_defines\prod.json.example dart_defines\prod.json
```

Fill in the production Supabase URL, the production anon key (public, protected by row level
security; never the service role key) and the Google **Web** client id (from `docs/AUTH.md`, step
G1; leave it empty and the app still signs in with Google through the browser). `prod.json` is
git-ignored.

## 3. Build the bundle

**Ship order for the Mistake Lab capture (15 Oct 2026).** The app records how each question was
reached, marks, strike-outs, time away and the end of the paper, and sends `client` and `endedBy`
with the submit (`lib/core/models/session.dart`, `kRichSessionEvents`, on by default). Only the
server from web branch `web/alive-1015` (commit 49760343 and later; the submit page's `sheet` visit
from dd7a45e9) accepts the new event types.
The earlier server validates every event strictly: it refuses the whole in-progress save of a paper
that carries `away`, `back`, `strike` or `end` (`invalid_event_sequence`), and for a paper that is
not from the legacy bank the submit itself is refused. The app no longer loses a paper to that:
`OldServerFallbackApi` (`lib/core/sync/session/old_server_fallback.dart`) sends the refused save or
submit again with the event set the older server knows (answers, visits and, where that server
takes them, marks; a slice-2 server from before web commit dd7a45e9 gets the submit page's visit
without its `sheet` value), and keeps to that set for the rest of the app's run. What such a server never
receives is the new trace (time away, strike-outs, the end). One gap stays: a practice paper (ticket
mode, no save before the submit) is never refused, only scored with its record marked invalid, so
the first one of an app run that reaches the older server has no timing; the app learns from that
reply and sends the older set for the rest of the run. A second gap: when the server is deployed while a
paper is in progress and the app restarts (or the background job submits) before that paper ends, the
app starts again from the full log, which no longer matches the older set the server stored, and the
save and the submit meet `EVENT_CONFLICT`. So deploy that server to production first all the
same; `--dart-define=MOCKMOB_CAPTURE_V2=false` still turns the capture off entirely. NTA papers are
unchanged on screen either way.

```bash
bash tool/flutter_locked.sh build appbundle --release \
  --dart-define-from-file=dart_defines/prod.json \
  --obfuscate --split-debug-info=build/symbols \
  --build-number=<next versionCode>
```

Output: `build/app/outputs/bundle/release/app-release.aab`.

Keep `build/symbols` (Dart symbol files, needed to read obfuscated Dart stack traces) and
`build/app/outputs/mapping/release/mapping.txt` (R8 mapping; Play Console also accepts it) for
every release you upload, named by versionCode. They are not secrets, but nothing else can recreate
them.

Check the 16 KB alignment and the signing before uploading:

```bash
source tool/android_env.sh
python -I tool/check_16kb.py build/app/outputs/bundle/release/app-release.aab
keytool -printcert -jarfile build/app/outputs/bundle/release/app-release.aab   # SHA-1 must equal your upload key; "CN=Android Debug" means key.properties was missing, do NOT upload
```

Upload only the `.aab`. Do not upload APKs built with `--split-per-abi`: Flutter adds an offset to
their versionCode (arm64 shows `2001` for `+1`).

## 4. Fingerprints: where each one goes

There are two keys. Play signs what students install with the **app signing key**; you sign the
bundle you upload with the **upload key**.

| Where | Which fingerprint |
|---|---|
| Google Cloud, Android OAuth client for Google sign-in (`docs/AUTH.md` G2) | SHA-1 of the **app signing key** (needed for Play installs). Add the upload key SHA-1 as a second client for sideloaded release builds. |
| Server env `ANDROID_CERT_SHA256` (Vercel, then redeploy), served at `https://www.mockmob.in/.well-known/assetlinks.json` | SHA-256 of the **app signing key**, comma-separated with the upload key SHA-256 if you want sideloaded builds to verify too. Format `AA:BB:...` (32 pairs). |

Get the app signing key after the first upload: Play Console > your app > Test and release > App
integrity > App signing > "App signing key certificate". Until the server has it, app links open in
the browser instead of the app (nothing breaks).

## 5. Play Console: first upload to a closed test

Google's rule for this app: a personal developer account created after 13 Nov 2023 must run a
**closed test with at least 12 testers opted in continuously for 14 days** before it can apply for
production, and the rule applies **per app**. The 14 days you completed for your other app do not
count for this one. The 14 days start when testers have opted in, so start as early as possible.

1. Play Console > Create app: name MockMob, default language English (India), App, Free.
2. Complete the Dashboard "Set up your app" tasks:
   - **Privacy policy**: the website's privacy policy URL.
   - **App access**: sign-in is needed; give the reviewers a test account (a throwaway email and
     password you create on the site) in "App access".
   - **Ads**: no ads.
   - **Content rating**: questionnaire (education, no violence); expect a rating suitable for all.
   - **Target audience**: 18 and over only (the decision is consenting adults; do not select under-13
     or "appeals to children").
   - **Data safety**: collects email and account identifier, app activity (mock scores and study
     progress), crash and diagnostics if enabled; data encrypted in transit; deletion request at
     https://www.mockmob.in/account-deletion; not shared with third parties for ads. Answer from
     what the build really sends, and re-check after each feature change.
   - **Government apps / Financial features / Health**: none apply. Do not claim affiliation with
     NTA, DU or any government body anywhere in the listing.
   - **Store listing**: title, short and full description, 512x512 icon, 1024x500 feature graphic,
     at least 2 phone screenshots, contact email support@mockmob.in. Disclaimer text lives in the
     listing description, not in the app UI.
3. Test and release > Testing > **Closed testing** > Create track > Create release. Turn on
   **Play App Signing** when prompted (default for new apps). Upload `app-release.aab`, write
   release notes, save, review, **Start rollout to Closed testing**.
4. Closed testing > Testers: create an email list (Google accounts or a Google Group) with **at
   least 12, aim for 15 to 20** because people drop out. Save, copy the **opt-in link**.
5. Send every tester the opt-in link. Each must open it on the Android phone's Google account, tap
   **Become a tester**, then install from the Play Store listing it leads to. The 14-day count
   needs them to stay opted in; if one opts out and back in the count restarts for that tester.
6. Ask them to open the app now and then (Google reviews tester engagement) and to send feedback
   to support@mockmob.in.
7. After 14 continuous days with 12 or more opted in: Dashboard > **Apply for production**, answer
   the three sections (about your closed test, about your app, about production readiness). Google
   usually answers within 7 days. Then create the production release (upload a new bundle with a
   higher versionCode if you fixed things).

New uploads during the test: bump versionCode, build, upload to the same closed track. Testers
update automatically; the 14-day clock keeps running.

## 6. Build sizes and download estimate

Measured on 13 Oct 2026, Flutter 3.44.6, debug-fallback signing, `--obfuscate --split-debug-info`:

| Artifact | Size |
|---|---|
| `app-release.aab` (what you upload) | 69.4 MiB as Flutter reports it (72.7 million bytes). About 37 MB of it is native debug symbols and the R8 mapping, which Play keeps for crash reports and never sends to phones. |
| Estimated download per phone (arm64, the large majority of devices) | about 15.7 MB (armeabi-v7a 15.3 MB, x86_64 15.9 MB). Computed from the AAB: shared code and assets 5.7 MB plus that ABI's native libraries 10 MB, compressed. Play Console shows the exact figure per device after upload (Test and release > App bundle explorer). |
| `app-arm64-v8a-release.apk` (sideload test only) | 27.8 MB. Larger because native libraries are stored uncompressed (required for 16 KB alignment and faster start). |

Largest parts: Flutter engine 5.4 MB, the app's Dart code 3.7 MB, sqlite 0.9 MB, Android classes
(R8 shrunk) 1.9 MB, per ABI, compressed.

## 7. 16 KB check (done)

`python -I tool/check_16kb.py <aab or apk>` reads the ELF headers of every 64-bit native library and, for an
APK, runs `zipalign -c -P 16 -v 4`.

| Library | Source | LOAD alignment |
|---|---|---|
| libflutter.so | Flutter 3.44 engine | 65536 (OK) |
| libapp.so | the Dart code | 65536 (OK) |
| libsqlite3.so | sqlite3 package | 16384 (OK) |
| libdartjni.so | jni package | 16384 (OK) |
| libdatastore_shared_counter.so | androidx datastore | 16384 (OK) |

All five pass in the AAB (arm64-v8a and x86_64) and in the arm64 APK, which also reports
`zipalign ... Verification successful`. No plugin needed upgrading. Android Gradle Plugin is 9.0.1 and NDK 28.2,
both well above the 16 KB minimums. Re-run the check after every plugin upgrade: a new native library is the only
thing that can break it. (32-bit armeabi-v7a libraries are exempt from the requirement.)

## 8. If a release build misbehaves but debug does not

R8 is the usual cause. Rules live in `android/app/proguard-rules.pro`. Get the real crash with
`adb logcat`, look for `ClassNotFoundException` or `NoSuchMethodError`, and add a `-keep` for that class.
The last release build produced no R8 "missing rules" report.

## Hand-off checklist for the owner

1. Run `tool\make_upload_key.ps1`, back up the keystore and password.
2. `copy dart_defines\prod.json.example dart_defines\prod.json` and fill it in.
3. Build the AAB (section 3), check it (section 3), confirm the signer is your key.
4. Play Console: create app, finish the Dashboard tasks, create the closed test, upload the AAB (section 5).
5. Recruit 15 to 20 testers, send the opt-in link, keep them opted in 14 days.
6. After the first upload, copy the Play App Signing SHA-1 and SHA-256 into the Google Cloud Android
   client and `ANDROID_CERT_SHA256` (section 4).
7. Day 14 or later: Apply for production.
