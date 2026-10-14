# Build defines

The app reads its configuration from `--dart-define` values (see `lib/core/config/app_config.dart`).
Keep real value files here as `*.json`. They are ignored by git (`dart_defines/.gitignore`).

| Define | Meaning | Default |
|---|---|---|
| `API_BASE_URL` | MockMob API host. Use `www` directly, never the apex (it redirects and a redirect can drop the Authorization header). | `https://www.mockmob.in` |
| `SUPABASE_URL` | Supabase project URL (public). | none, required |
| `SUPABASE_ANON_KEY` | Supabase anon key (public, protected by row level security). | none, required |
| `GOOGLE_WEB_CLIENT_ID` | Google OAuth web client id. When empty, Google sign-in is hidden. | empty |
| `FRESH_CHECKS_LIVE` | Content gate for fresh-question checks. Keep `false` until the owner opens it. | `false` |

## Development against the local staging server

Run the staging server on port 3101 on the PC. From the Android emulator the PC is `10.0.2.2`.
Use the staging Supabase project: copy the public URL and anon key from the `STAGING_SUPABASE_URL`
and `STAGING_SUPABASE_ANON_KEY` lines of `.env.staging` in the repo root. Never copy the
`STAGING_SUPABASE_SERVICE_ROLE_KEY` value anywhere in the app.

`dart_defines/dev.json`:

```json
{
  "API_BASE_URL": "http://10.0.2.2:3101",
  "SUPABASE_URL": "<STAGING_SUPABASE_URL value>",
  "SUPABASE_ANON_KEY": "<STAGING_SUPABASE_ANON_KEY value>",
  "GOOGLE_WEB_CLIENT_ID": "",
  "FRESH_CHECKS_LIVE": "false"
}
```

```bash
source tool/android_env.sh
flutter run --dart-define-from-file=dart_defines/dev.json
```

A plain `http://` base URL is only for the emulator. The Android debug manifest must allow cleartext
traffic to `10.0.2.2` for it to work (owned by the core Android setup).

## Production

`dart_defines/prod.json`:

```json
{
  "API_BASE_URL": "https://www.mockmob.in",
  "SUPABASE_URL": "<production Supabase URL>",
  "SUPABASE_ANON_KEY": "<production anon key>",
  "GOOGLE_WEB_CLIENT_ID": "<web client id, once Google sign-in is configured>",
  "FRESH_CHECKS_LIVE": "false"
}
```

```bash
flutter build appbundle --release --dart-define-from-file=dart_defines/prod.json
```

Values marked as secrets (service role keys, signing keys) never go in these files.
